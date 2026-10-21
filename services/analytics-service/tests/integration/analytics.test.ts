import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { pool } from '../../src/db';
import { DEAD_QUEUE, CLICK_QUEUE } from '../../src/events';
import { flush } from '../../src/flush';
import { redis } from '../../src/redis';
import { addLink, call, ev, ipHash, push, resetState, shutdown, startServer } from '../helpers';

let srv: Awaited<ReturnType<typeof startServer>>;
before(async () => {
  srv = await startServer();
});
after(() => shutdown(srv));
beforeEach(() => resetState());

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => Date.now() - n * 864e5;

describe('flush: คิว Redis → Postgres (transaction เดียว)', () => {
  it('เขียน clicks + link_daily_stats + click_count พร้อมกัน และคิวว่างหลังเสร็จ', async () => {
    const id = await addLink();
    await push(ev({ l: id, h: ipHash(1), d: 'mobile', o: 'iOS', b: 'Safari', c: 'TH', r: 'https://t.co' }), ev({ l: id, h: ipHash(2) }), ev({ l: id, h: ipHash(2) }));
    const r = await flush();
    assert.deepEqual({ skipped: r.skipped, inserted: r.inserted, discarded: r.discarded, dead: r.deadLettered }, { skipped: false, inserted: 3, discarded: 0, dead: 0 });
    assert.equal(await redis.llen(CLICK_QUEUE), 0);
    const row = (await pool.query('SELECT click_count FROM links WHERE id = $1', [id])).rows[0];
    assert.equal(row.click_count, 3);
    // ค้นหาด้วยเงื่อนไข ไม่พึ่งลำดับแถว: INSERT…SELECT หลายแถวไม่รับประกันลำดับ id (ต่างกันตามแผนของ Postgres บนแต่ละเครื่อง)
    const c = (await pool.query("SELECT device::text d, os, browser, country, referer FROM clicks WHERE link_id = $1 AND device = 'mobile'", [id])).rows[0];
    assert.deepEqual(c, { d: 'mobile', os: 'iOS', browser: 'Safari', country: 'TH', referer: 'https://t.co' });
    assert.equal((await pool.query('SELECT clicks FROM link_daily_stats WHERE link_id = $1 AND day = $2::date', [id, today()])).rows[0].clicks, 3);
  });

  it('click_count บวกต่อจากเดิม (ไม่ทับ) และยอดรายวันสะสมข้ามรอบ flush', async () => {
    const id = await addLink(10);
    await push(ev({ l: id }));
    await flush();
    await push(ev({ l: id }), ev({ l: id }));
    await flush();
    assert.equal((await pool.query('SELECT click_count FROM links WHERE id = $1', [id])).rows[0].click_count, 13);
    assert.equal((await pool.query('SELECT clicks FROM link_daily_stats WHERE link_id = $1', [id])).rows[0].clicks, 3);
  });

  it('คลิกคนละวัน (ตาม UTC) แยกแถวรายวัน', async () => {
    const id = await addLink();
    await push(ev({ l: id, t: daysAgo(2) }), ev({ l: id, t: daysAgo(2) }), ev({ l: id, t: daysAgo(1) }), ev({ l: id }));
    await flush();
    const rows = (await pool.query('SELECT day::text d, clicks FROM link_daily_stats WHERE link_id = $1 ORDER BY day', [id])).rows;
    assert.deepEqual(rows.map((r) => r.clicks), [2, 1, 1]);
  });

  it('หลายลิงก์ใน batch เดียว: นับแยกกันถูกต้อง', async () => {
    const [a, b] = [await addLink(), await addLink()];
    await push(ev({ l: a }), ev({ l: b }), ev({ l: b }));
    await flush();
    assert.deepEqual((await pool.query('SELECT id, click_count FROM links WHERE id = ANY($1) ORDER BY id', [[a, b]])).rows.map((r) => r.click_count), [1, 2]);
  });

  it('เหตุการณ์ผิดรูปแบบถูกทิ้ง ไม่ขวางรายการดี; ลิงก์ที่ถูกลบไปแล้วก็ถูกทิ้ง ไม่ทำให้ทั้ง batch ล้ม', async () => {
    const id = await addLink();
    const gone = await addLink();
    await pool.query('DELETE FROM links WHERE id = $1', [gone]);
    await push('{broken', ev({ l: id }), ev({ l: gone }), JSON.stringify({ l: id, h: 'bad', t: Date.now() }), ev({ l: id }));
    const r = await flush();
    assert.deepEqual([r.inserted, r.discarded], [2, 3]);
    assert.equal((await pool.query('SELECT click_count FROM links WHERE id = $1', [id])).rows[0].click_count, 2);
  });

  it('ข้อมูลที่ DB ปฏิเสธ (integrity error) → แยกไป clicks:dead เฉพาะตัวนั้น ที่เหลือใน batch เดียวกันบันทึกครบ', async () => {
    const id = await addLink();
    // จำลอง "DB ปฏิเสธข้อมูล" ด้วย constraint ชั่วคราวในฐานทดสอบ (parseEvent ผ่านทุกตัว แต่ INSERT ของตัว POISON ล้ม)
    await pool.query("ALTER TABLE clicks ADD CONSTRAINT t_no_poison CHECK (user_agent IS DISTINCT FROM 'POISON')");
    try {
      await push(ev({ l: id }), ev({ l: id, ua: 'POISON' }), ev({ l: id }), ev({ l: id }));
      const r = await flush();
      assert.deepEqual([r.inserted, r.deadLettered], [3, 1]);
      const dead = await redis.lrange(DEAD_QUEUE, 0, -1);
      assert.equal(dead.length, 1);
      assert.match(dead[0], /POISON/);
      assert.equal((await pool.query('SELECT click_count FROM links WHERE id = $1', [id])).rows[0].click_count, 3);
      assert.equal(await redis.llen(CLICK_QUEUE), 0, 'ตัวพิษต้องไม่ค้างในคิวหลัก (ไม่วนซ้ำไม่รู้จบ)');
    } finally {
      await pool.query('ALTER TABLE clicks DROP CONSTRAINT t_no_poison');
    }
  });

  it('แบ่งเป็น batch ตาม FLUSH_BATCH_SIZE และเขียนครบทุกรายการ', async () => {
    const id = await addLink();
    const events = Array.from({ length: 2500 }, (_, i) => ev({ l: id, h: ipHash(i % 50) }));
    for (let i = 0; i < events.length; i += 500) await push(...events.slice(i, i + 500));
    const r = await flush();
    assert.equal(r.inserted, 2500);
    assert.equal((await pool.query('SELECT click_count FROM links WHERE id = $1', [id])).rows[0].click_count, 2500);
  });

  it('flush พร้อมกัน: มีตัวเดียวทำงาน (lock) ตัวอื่น skipped และไม่เขียนซ้ำ', async () => {
    const id = await addLink();
    await push(...Array.from({ length: 200 }, () => ev({ l: id })));
    const results = await Promise.all([flush(), flush(), flush(), flush()]);
    assert.equal(results.filter((r) => !r.skipped).length >= 1, true);
    assert.equal(results.reduce((s, r) => s + r.inserted, 0), 200);
    assert.equal((await pool.query('SELECT click_count FROM links WHERE id = $1', [id])).rows[0].click_count, 200, 'ห้ามนับซ้ำ');
  });

  it('คิวว่าง → ไม่ทำอะไร', async () => assert.deepEqual(await flush().then((r) => [r.inserted, r.discarded]), [0, 0]));

  it('ลบคลิกดิบเก่ากว่า retention แต่ยอดรายวันและ click_count เก็บไว้ถาวร', async () => {
    const id = await addLink(5);
    await pool.query(`INSERT INTO clicks (link_id, ip_hash, device, clicked_at) VALUES ($1, 'h', 'desktop', now() - interval '120 days'), ($1, 'h', 'desktop', now() - interval '10 days')`, [id]);
    await pool.query(`INSERT INTO link_daily_stats (link_id, day, clicks) VALUES ($1, current_date - 120, 4)`, [id]);
    const r = await flush();
    assert.equal(r.cleaned, 1);
    assert.equal((await pool.query('SELECT count(*)::int n FROM clicks WHERE link_id = $1', [id])).rows[0].n, 1);
    assert.equal((await pool.query('SELECT clicks FROM link_daily_stats WHERE link_id = $1', [id])).rows[0].clicks, 4);
    assert.equal((await pool.query('SELECT click_count FROM links WHERE id = $1', [id])).rows[0].click_count, 5);
    assert.equal((await flush()).cleaned, 0, 'ล้างไม่เกินชั่วโมงละครั้ง');
  });
});

describe('HTTP: สิทธิ์เรียก (internal key)', () => {
  it('/health เปิดสาธารณะ', async () => assert.deepEqual(await (await call(srv.base, '/health', { key: null })).json(), { status: 'ok' }));
  for (const [name, key] of [['ไม่ส่ง key', null], ['key ผิด', 'wrong'], ['key ว่าง', ''], ['key เกือบถูก', 'test-internal-key-0123456780'], ['key ยาวกว่า', 'test-internal-key-0123456789x']] as const) {
    it(`ปฏิเสธ 401: ${name}`, async () => {
      assert.equal((await call(srv.base, '/internal/flush', { method: 'POST', key })).status, 401);
      assert.equal((await call(srv.base, '/internal/links/1/stats', { key })).status, 401);
    });
  }
  it('POST /internal/flush ด้วย key ถูก → รายงานผล', async () => {
    const id = await addLink();
    await push(ev({ l: id }));
    const r = await call(srv.base, '/internal/flush', { method: 'POST' });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).inserted, 1);
  });
  it('เส้นทางอื่น → 404 JSON', async () => assert.equal((await call(srv.base, '/nope', { key: null })).status, 404));
});

describe('สถิติรายลิงก์ GET /internal/links/:id/stats', () => {
  it('flush ให้ก่อนอ่านเสมอ (ตัวเลขล่าสุด) และคืนทุกส่วนถูกต้อง', async () => {
    const id = await addLink();
    await push(
      ev({ l: id, h: ipHash(1), d: 'mobile', o: 'iOS', b: 'Safari', c: 'TH', r: 'https://t.co' }),
      ev({ l: id, h: ipHash(1), d: 'mobile', o: 'iOS', b: 'Safari', c: 'TH', r: 'https://t.co' }),
      ev({ l: id, h: ipHash(2), d: 'desktop', o: 'Windows', b: 'Chrome', c: 'US', r: null }),
    );
    const r = await call(srv.base, `/internal/links/${id}/stats?days=7`);
    assert.equal(r.status, 200);
    const s = await r.json();
    assert.deepEqual([s.linkId, s.days, s.total, s.windowClicks, s.uniqueVisitors], [id, 7, 3, 3, 2]);
    assert.equal(s.daily.length, 7);
    assert.deepEqual(s.daily.at(-1), { day: today(), clicks: 3 });
    assert.ok(s.daily.slice(0, -1).every((d: { clicks: number }) => d.clicks === 0), 'วันที่ไม่มีคลิกต้องเป็น 0 (เติมให้ครบ)');
    assert.deepEqual(s.devices, [{ key: 'mobile', clicks: 2 }, { key: 'desktop', clicks: 1 }]);
    assert.deepEqual(s.countries, [{ key: 'TH', clicks: 2 }, { key: 'US', clicks: 1 }]);
    assert.deepEqual(s.referers, [{ key: 'https://t.co', clicks: 2 }, { key: null, clicks: 1 }]);
    assert.deepEqual(s.os.map((b: { key: string }) => b.key), ['iOS', 'Windows']);
    assert.deepEqual(s.browsers.map((b: { key: string }) => b.key), ['Safari', 'Chrome']);
  });

  it('ช่วงเวลา: คลิกนอกช่วงไม่นับใน windowClicks แต่ total นับทั้งหมด', async () => {
    const id = await addLink();
    await push(ev({ l: id, t: daysAgo(40) }), ev({ l: id, t: daysAgo(3) }), ev({ l: id }));
    const s = await (await call(srv.base, `/internal/links/${id}/stats?days=7`)).json();
    assert.deepEqual([s.total, s.windowClicks], [3, 2]);
    const wide = await (await call(srv.base, `/internal/links/${id}/stats?days=90`)).json();
    assert.equal(wide.windowClicks, 3);
    assert.equal(wide.daily.length, 90);
  });

  it('ค่าเริ่มต้น 30 วัน', async () => {
    const id = await addLink();
    assert.equal((await (await call(srv.base, `/internal/links/${id}/stats`)).json()).days, 30);
  });
  it('ลิงก์ที่ไม่มี → 404; id เพี้ยน → 404; days นอกช่วง/ไม่ใช่เลข → 400', async () => {
    const id = await addLink();
    for (const p of ['/internal/links/999999/stats', '/internal/links/abc/stats', '/internal/links/0/stats', '/internal/links/-1/stats']) assert.equal((await call(srv.base, p)).status, 404, p);
    for (const d of ['0', '366', '1.5', 'abc', '-3']) assert.equal((await call(srv.base, `/internal/links/${id}/stats?days=${d}`)).status, 400, d);
  });
  it('ลิงก์ไม่มีคลิกเลย → ศูนย์ทั้งหมด ไม่ error', async () => {
    const s = await (await call(srv.base, `/internal/links/${await addLink()}/stats?days=7`)).json();
    assert.deepEqual([s.total, s.windowClicks, s.uniqueVisitors, s.devices.length], [0, 0, 0, 0]);
  });
});
