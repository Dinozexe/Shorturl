import { randomUUID } from 'crypto';
import { config } from './config';
import { pool } from './db';
import { CLICK_QUEUE, DEAD_QUEUE, parseEvent, type Parsed } from './events';
import { redis } from './redis';

const LOCK = 'clicks:flush:lock';
const LOCK_TTL_SEC = 30;
const CLEANUP_LOCK = 'clicks:cleanup:lock';
const CLEANUP_EVERY_SEC = 60 * 60;
const CLEANUP_CHUNK = 5000;
const MAX_BATCHES_PER_FLUSH = 50;
const MAX_FLUSH_MS = 20_000; // < อายุ lock

export interface FlushResult {
  skipped: boolean; // true = มี flush อื่นถือ lock อยู่
  inserted: number; // บันทึกลง clicks จริง
  discarded: number; // ทิ้ง: รูปแบบผิด / ลิงก์ถูกลบแล้ว
  deadLettered: number; // DB ปฏิเสธข้อมูล → เก็บไว้ใน clicks:dead
  cleaned: number; // คลิกดิบเก่ากว่า retention ที่ลบ
}

// ทั้งหมดอยู่ในคำสั่งเดียว (CTE ที่แก้ข้อมูล) = transaction เดียว: clicks + link_daily_stats + links.click_count
// กรองลิงก์ที่ถูกลบไปแล้วออกด้วย EXISTS (ไม่งั้น FK ล้มทั้ง batch); เวลาเก็บเป็น UTC ใน timestamp (ไม่มี tz)
const WRITE_SQL = `
WITH ev AS (
  SELECT t.link_id, t.ip_hash, t.ua, t.ref, t.country, t.device, t.os, t.browser,
         (to_timestamp(t.ms / 1000.0) AT TIME ZONE 'UTC') AS ts
  FROM unnest($1::int[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::bigint[])
       AS t(link_id, ip_hash, ua, ref, country, device, os, browser, ms)
  WHERE EXISTS (SELECT 1 FROM links l WHERE l.id = t.link_id)
),
ins AS (
  INSERT INTO clicks (link_id, ip_hash, user_agent, referer, country, device, os, browser, clicked_at)
  SELECT link_id, ip_hash, ua, ref, country, device::"Device", os, browser, ts FROM ev
  RETURNING 1
),
daily AS (
  INSERT INTO link_daily_stats (link_id, day, clicks)
  SELECT link_id, ts::date, count(*)::int FROM ev GROUP BY link_id, ts::date
  ON CONFLICT (link_id, day) DO UPDATE SET clicks = link_daily_stats.clicks + EXCLUDED.clicks
  RETURNING 1
),
cnt AS (
  UPDATE links l SET click_count = l.click_count + c.n
  FROM (SELECT link_id, count(*)::int AS n FROM ev GROUP BY link_id) c
  WHERE l.id = c.link_id
  RETURNING 1
)
SELECT (SELECT count(*) FROM ins)::int AS inserted`;

async function writeBatch(items: Parsed[]): Promise<number> {
  const col = <T>(f: (p: Parsed) => T) => items.map(f);
  const { rows } = await pool.query(WRITE_SQL, [
    col((p) => p.ev.linkId),
    col((p) => p.ev.ipHash),
    col((p) => p.ev.userAgent),
    col((p) => p.ev.referer),
    col((p) => p.ev.country),
    col((p) => p.ev.device),
    col((p) => p.ev.os),
    col((p) => p.ev.browser),
    col((p) => p.ev.ts),
  ]);
  return rows[0].inserted as number;
}

// ข้อมูลผิด (class 22 = data exception, 23 = integrity) ต่างจากปัญหาการเชื่อมต่อ (ต้องคืนคิวแล้วลองใหม่)
const isDataError = (e: unknown) => /^(22|23)/.test(String((e as { code?: unknown })?.code ?? ''));

/** เขียน batch; ถ้า DB ปฏิเสธเพราะข้อมูลผิด → แบ่งครึ่งหาตัวที่พัง แล้วย้ายตัวนั้นไป clicks:dead */
async function writeResilient(items: Parsed[]): Promise<{ inserted: number; dead: number }> {
  try {
    return { inserted: await writeBatch(items), dead: 0 };
  } catch (e) {
    if (!isDataError(e)) throw e;
    if (items.length === 1) {
      await redis.lpush(DEAD_QUEUE, items[0].raw);
      await redis.ltrim(DEAD_QUEUE, 0, 999);
      console.error('เหตุการณ์ที่ DB ปฏิเสธ → clicks:dead:', (e as Error).message);
      return { inserted: 0, dead: 1 };
    }
    const mid = Math.ceil(items.length / 2);
    const a = await writeResilient(items.slice(0, mid));
    const b = await writeResilient(items.slice(mid));
    return { inserted: a.inserted + b.inserted, dead: a.dead + b.dead };
  }
}

/** คืนเหตุการณ์ไปหัวคิวตามลำดับเดิม (LPUSH ทีละตัวจึงต้องกลับด้าน) */
async function requeue(items: Parsed[]) {
  if (items.length) await redis.lpush(CLICK_QUEUE, ...items.map((p) => p.raw).reverse());
}

const RELEASE_LUA = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0`;

/** ลบคลิกดิบที่เก่ากว่า retention ทีละก้อน และไม่เกินชั่วโมงละครั้ง (ยอดรายวันเก็บถาวร) ไม่ใช้ cron — ทำพ่วงกับ flush */
async function cleanupOld(): Promise<number> {
  const got = await redis.set(CLEANUP_LOCK, '1', 'EX', CLEANUP_EVERY_SEC, 'NX');
  if (got !== 'OK') return 0;
  let total = 0;
  for (let i = 0; i < 10; i++) {
    const r = await pool.query(
      `DELETE FROM clicks WHERE id IN (
         SELECT id FROM clicks WHERE clicked_at < (now() AT TIME ZONE 'UTC') - make_interval(days => $1) ORDER BY clicked_at LIMIT $2)`,
      [config.clickRetentionDays, CLEANUP_CHUNK],
    );
    total += r.rowCount ?? 0;
    if ((r.rowCount ?? 0) < CLEANUP_CHUNK) break;
  }
  return total;
}

/** ดึงคิวมาเขียนลง DB เป็นชุด; lock กันหลายตัว flush พร้อมกัน; พังแล้วคืนคิว (ไม่หาย ไม่ซ้ำ) */
export async function flush(): Promise<FlushResult> {
  const result: FlushResult = { skipped: false, inserted: 0, discarded: 0, deadLettered: 0, cleaned: 0 };
  const token = randomUUID();
  if ((await redis.set(LOCK, token, 'EX', LOCK_TTL_SEC, 'NX')) !== 'OK') return { ...result, skipped: true };

  try {
    const deadline = Date.now() + MAX_FLUSH_MS;
    for (let b = 0; b < MAX_BATCHES_PER_FLUSH && Date.now() < deadline; b++) {
      const raws = await redis.lpop(CLICK_QUEUE, config.batchSize);
      if (!raws || raws.length === 0) break;

      const items: Parsed[] = [];
      for (const raw of raws) {
        const ev = parseEvent(raw);
        if (ev) items.push({ raw, ev });
        else result.discarded++;
      }

      if (items.length) {
        try {
          const w = await writeResilient(items);
          result.inserted += w.inserted;
          result.deadLettered += w.dead;
          result.discarded += items.length - w.inserted - w.dead; // ลิงก์ที่ถูกลบไปแล้ว
        } catch (e) {
          await requeue(items); // DB ล่ม/หลุด: คืนคิว รอบหน้าลองใหม่
          throw e;
        }
      }
      if (raws.length < config.batchSize) break;
    }
    result.cleaned = await cleanupOld().catch((e) => {
      console.error('ลบคลิกเก่าไม่สำเร็จ:', (e as Error).message);
      return 0;
    });
    return result;
  } finally {
    await redis.eval(RELEASE_LUA, 1, LOCK, token).catch(() => undefined);
  }
}

/** ใช้ก่อนอ่านสถิติ: flush ให้ตัวเลขล่าสุด; ถ้ามีตัวอื่นกำลัง flush อยู่ รอสักครู่ให้เสร็จ */
export async function flushBeforeRead(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const r = await flush();
    if (!r.skipped) return;
    await new Promise((res) => setTimeout(res, 300));
  }
}
