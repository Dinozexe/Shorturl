import express, { type Request, type Response } from 'express';
import { config } from './config';
import { enqueueClick } from './clicks';
import { findLink } from './db';
import { notFoundPage } from './pages';
import { redis } from './redis';

// สัญญาแคชกับ core-api: `link:{code}` = JSON {i: id, u: url, e: หมดอายุ epoch ms | null}; `0` = ไม่พบ/ปิด (negative cache)
const POSITIVE_TTL_SEC = 60 * 60;
const NEGATIVE_TTL_SEC = 60;
const CODE_RE = /^[A-Za-z0-9_-]{3,30}$/; // alias 3–30 ตัว; รหัสสุ่มสั้นกว่านั้น — ผิดรูปแบบไม่ต้องแตะ Redis/DB

interface CachedLink {
  i: number;
  u: string;
  e: number | null;
}

function sendNotFound(res: Response) {
  res.status(404).set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).type('html').send(notFoundPage());
}

function sendRedirect(req: Request, res: Response, link: CachedLink) {
  res.status(302).set('Cache-Control', 'no-store'); // ห้าม 301 เพราะ browser จะแคชแล้วนับคลิกไม่ครบ
  res.redirect(302, link.u);
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

  app.get('/:code', async (req, res) => {
    const code = String(req.params.code);
    if (!CODE_RE.test(code)) return sendNotFound(res);

    const cached = await readCache(code);
    if (cached === 0) return sendNotFound(res);
    if (cached) {
      if (cached.e !== null && cached.e <= Date.now()) return sendNotFound(res); // หมดอายุตามเวลาแล้วแต่แคชยังไม่หมด
      return sendRedirect(req, res, cached);
    }

    // cache miss → ถาม DB
    let link;
    try {
      link = await findLink(code);
    } catch (e) {
      console.error('query DB ไม่สำเร็จ:', (e as Error).message);
      return res.status(503).set('Retry-After', '5').type('text').send('ระบบขัดข้องชั่วคราว กรุณาลองใหม่');
    }

    const expMs = link?.expiresAt ? link.expiresAt.getTime() : null;
    if (!link || link.status !== 'ACTIVE' || (expMs !== null && expMs <= Date.now())) {
      await writeCache(code, 0, NEGATIVE_TTL_SEC);
      return sendNotFound(res);
    }

    const ttl = expMs === null ? POSITIVE_TTL_SEC : Math.max(1, Math.min(POSITIVE_TTL_SEC, Math.floor((expMs - Date.now()) / 1000)));
    const value: CachedLink = { i: link.id, u: link.url, e: expMs };
    await writeCache(code, value, ttl);
    sendRedirect(req, res, value);
  });

  // path อื่นที่ไม่ใช่ /:code (เช่น /a/b)
  app.use((_req, res) => sendNotFound(res));
  return app;
}
