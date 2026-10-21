import { createHash } from 'crypto';
import express, { type Request, type Response } from 'express';
import { config } from './config';
import { clientIp, enqueueClick } from './clicks';
import { getClickCount, findLink, getPasswordHash } from './db';
import { limitReachedPage, notFoundPage, notStartedPage, passwordPage, type PasswordProblem } from './pages';
import { verifyLinkPassword } from './password';
import { redis } from './redis';

// สัญญาแคชกับ core-api: `link:{code}` = JSON {i: id, u: url, e: หมดอายุ epoch ms | null, s?: วันเริ่ม epoch ms, m?: จำกัดคลิก, p?: 1 = มีรหัสผ่าน}; `0` = ไม่พบ/ปิด (negative cache)
// ตัวนับคลิกของลิงก์ที่จำกัด: `lim:{id}`
const POSITIVE_TTL_SEC = 60 * 60;
const NEGATIVE_TTL_SEC = 60;
const CODE_RE = /^[A-Za-z0-9_-]{3,30}$/; // alias 3–30 ตัว; รหัสสุ่มสั้นกว่านั้น — ผิดรูปแบบไม่ต้องแตะ Redis/DB

interface CachedLink {
  i: number;
  u: string;
  e: number | null;
  s?: number;
  m?: number;
  p?: 1;
}

const PW_TRIES = 5; // ลองรหัสผิดได้กี่ครั้งต่อ IP ต่อลิงก์ ในช่วง PW_WINDOW_SEC
const PW_TRIES_ANY_IP = 100; // เพดานรวมทุก IP ต่อลิงก์ (กันเดาแบบกระจาย IP)
const PW_WINDOW_SEC = 10 * 60;

function sendNotFound(res: Response) {
  res.status(404).set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).type('html').send(notFoundPage());
}

function sendRedirect(req: Request, res: Response, link: CachedLink, status: 302 | 303 = 302) {
  res.status(status).set('Cache-Control', 'no-store'); // ห้าม 301 เพราะ browser จะแคชแล้วนับคลิกไม่ครบ
  res.redirect(status, link.u);
  // HEAD (เช่น ตัวพรีวิวลิงก์) ไม่นับเป็นคลิก; เข้าคิวหลังตอบไปแล้ว ไม่หน่วง redirect
  if (req.method !== 'HEAD') void enqueueClick(req, link.i);
}

async function readCache(code: string): Promise<CachedLink | 0 | null> {
  try {
    const raw = await redis.get(`link:${code}`);
    if (raw === null) return null;
    if (raw === '0') return 0;
    const v = JSON.parse(raw) as CachedLink;
    return typeof v.i === 'number' && typeof v.u === 'string' ? v : null; // รูปแบบพัง = ถือว่า miss
  } catch (e) {
    console.error('อ่าน cache ไม่ได้ (ไปถาม DB แทน):', (e as Error).message);
    return null;
  }
}

async function writeCache(code: string, value: CachedLink | 0, ttl: number) {
  try {
    await redis.set(`link:${code}`, value === 0 ? '0' : JSON.stringify(value), 'EX', ttl);
  } catch (e) {
    console.error('เขียน cache ไม่ได้:', (e as Error).message);
  }
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // หลัง proxy ของ Render

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/favicon.ico', (_req, res) => {
    res.status(204).end();
  });
  app.get('/', (_req, res) => {
    res.redirect(302, config.frontendOrigin);
  });

  // หา link จาก cache → DB; null = ไม่พบ/ปิด/หมดอายุ (ตอบ 404 แล้ว); ระบบขัดข้อง = ตอบ 503 แล้ว
  async function resolve(code: string, res: Response): Promise<CachedLink | null> {
    const cached = await readCache(code);
    if (cached === 0) return sendNotFound(res), null;
    if (cached) {
      if (cached.e !== null && cached.e <= Date.now()) return sendNotFound(res), null; // หมดอายุตามเวลาแล้วแต่แคชยังไม่หมด
      return cached;
    }

    // cache miss → ถาม DB
    let link;
    try {
      link = await findLink(code);
    } catch (e) {
      console.error('query DB ไม่สำเร็จ:', (e as Error).message);
      res.status(503).set('Retry-After', '5').type('text').send('ระบบขัดข้องชั่วคราว กรุณาลองใหม่');
      return null;
    }

    const expMs = link?.expiresAt ? link.expiresAt.getTime() : null;
    if (!link || link.status !== 'ACTIVE' || (expMs !== null && expMs <= Date.now())) {
      await writeCache(code, 0, NEGATIVE_TTL_SEC);
      sendNotFound(res);
      return null;
    }

    const ttl = expMs === null ? POSITIVE_TTL_SEC : Math.max(1, Math.min(POSITIVE_TTL_SEC, Math.floor((expMs - Date.now()) / 1000)));
    const value: CachedLink = {
      i: link.id,
      u: link.url,
      e: expMs,
      ...(link.startsAt ? { s: link.startsAt.getTime() } : {}),
      ...(link.maxClicks !== null ? { m: link.maxClicks } : {}),
      ...(link.hasPassword ? { p: 1 as const } : {}),
    };
    await writeCache(code, value, ttl);
    return value;
  }

  const sendPage = (res: Response, status: number, html: string) =>
    res.status(status).set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' }).type('html').send(html);

  // เงื่อนไขก่อนถึงขั้นรหัสผ่าน: ยังไม่ถึงวันเริ่ม / เปิดครบจำนวนแล้ว → ตอบหน้าข้อความแล้วคืน true
  async function blocked(res: Response, link: CachedLink): Promise<boolean> {
    if (link.s !== undefined && link.s > Date.now()) return sendPage(res, 403, notStartedPage(link.s)), true;
    if (link.m !== undefined) {
      const used = Number(await redis.get(`lim:${link.i}`));
      if (used >= link.m) return sendPage(res, 410, limitReachedPage()), true;
    }
    return false;
  }

  // ถึงขั้น redirect จริง: ลิงก์ที่จำกัดจำนวนต้องจองสิทธิ์ก่อน (INCR เป็น atomic กันเปิดเกินเมื่อมีคนเปิดพร้อมกัน)
  async function finish(req: Request, res: Response, link: CachedLink, status: 302 | 303) {
    if (link.m !== undefined && req.method !== 'HEAD') { // HEAD (ตัวพรีวิว) ไม่กินสิทธิ์ เหมือนที่ไม่นับเป็นคลิก
      const k = `lim:${link.i}`;
      try {
        if ((await redis.exists(k)) === 0) await redis.set(k, String(await getClickCount(link.i)), 'NX'); // Redis ถูกล้าง → เริ่มนับต่อจากยอดใน DB
        if ((await redis.incr(k)) > link.m) return void sendPage(res, 410, limitReachedPage());
      } catch (e) {
        console.error('นับสิทธิ์ลิงก์ที่จำกัดไม่สำเร็จ:', (e as Error).message);
        return void res.status(503).set('Retry-After', '5').type('text').send('ระบบขัดข้องชั่วคราว กรุณาลองใหม่');
      }
    }
    sendRedirect(req, res, link, status);
  }

  app.get('/:code', async (req, res) => {
    const code = String(req.params.code);
    if (!CODE_RE.test(code)) return sendNotFound(res);
    const link = await resolve(code, res);
    if (!link || (await blocked(res, link))) return;
    if (link.p) return sendPage(res, 200, passwordPage(code));
    await finish(req, res, link, 302);
  });

  // ส่งรหัสผ่านของลิงก์ (ฟอร์มจากหน้ารหัสผ่าน) — ไม่มี cookie/session จึงไม่ต้องมี CSRF token
  app.post('/:code', express.urlencoded({ extended: false, limit: '2kb' }), async (req, res) => {
    const code = String(req.params.code);
    if (!CODE_RE.test(code)) return sendNotFound(res);
    const link = await resolve(code, res);
    if (!link || (await blocked(res, link))) return;
    if (!link.p) return void res.redirect(303, `/${code}`);

    const ipKey = `pw:${link.i}:${createHash('sha256').update(clientIp(req)).digest('hex').slice(0, 24)}`;
    const anyKey = `pwa:${link.i}`;
    let problem: PasswordProblem = 'wrong';
    try {
      const [mine, all] = [await redis.incr(ipKey), await redis.incr(anyKey)];
      if (mine === 1) await redis.expire(ipKey, PW_WINDOW_SEC);
      if (all === 1) await redis.expire(anyKey, PW_WINDOW_SEC);
      if (mine > PW_TRIES || all > PW_TRIES_ANY_IP) problem = 'locked';
    } catch (e) {
      console.error('นับครั้งที่ลองรหัสไม่สำเร็จ:', (e as Error).message);
      return void res.status(503).set('Retry-After', '5').type('text').send('ระบบขัดข้องชั่วคราว กรุณาลองใหม่');
    }
    if (problem === 'locked') return sendPage(res, 429, passwordPage(code, 'locked'));

    const given = typeof req.body?.password === 'string' ? req.body.password : '';
    let ok = false;
    try {
      const hash = await getPasswordHash(link.i);
      ok = !!hash && given.length > 0 && given.length <= 64 && (await verifyLinkPassword(given, hash));
    } catch (e) {
      console.error('ตรวจรหัสผ่านไม่สำเร็จ:', (e as Error).message);
      return void res.status(503).set('Retry-After', '5').type('text').send('ระบบขัดข้องชั่วคราว กรุณาลองใหม่');
    }
    if (!ok) return sendPage(res, 401, passwordPage(code, 'wrong'));
    await redis.del(ipKey).catch(() => undefined);
    await finish(req, res, link, 303);
  });

  // path อื่นที่ไม่ใช่ /:code (เช่น /a/b)
  app.use((_req, res) => sendNotFound(res));
  return app;
}
