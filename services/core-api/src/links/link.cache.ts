import { Link } from '@prisma/client';
import { redis } from '../redis/client';

// สัญญากับ redirect-service: key `link:{code}` = JSON {i: id, u: url ปลายทาง, e: หมดอายุ (epoch ms) หรือ null}
// ห้ามเปลี่ยนรูปแบบฝั่งเดียว; `0` = negative cache ที่ redirect-service เขียนเอง (TTL 60 วิ)
const MAX_TTL_SEC = 60 * 60;

const key = (code: string) => `link:${code}`;

/** ลิงก์ที่ ACTIVE และยังไม่หมดอายุเท่านั้นที่ถูก cache; อย่างอื่นล้าง key ทิ้งให้ redirect-service ไปถาม DB */
export async function syncLinkCache(link: Link) {
  const now = Date.now();
  const expMs = link.expiresAt ? link.expiresAt.getTime() : null;
  if (link.status !== 'ACTIVE' || (expMs !== null && expMs <= now)) {
    await redis.del(key(link.shortCode));
    return;
  }
  const ttl = expMs === null ? MAX_TTL_SEC : Math.max(1, Math.min(MAX_TTL_SEC, Math.floor((expMs - now) / 1000)));
  await redis.set(key(link.shortCode), JSON.stringify({ i: link.id, u: link.originalUrl, e: expMs }), 'EX', ttl);
}

export async function clearLinkCache(shortCode: string) {
  await redis.del(key(shortCode));
}
