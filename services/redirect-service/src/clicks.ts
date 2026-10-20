import { createHash } from 'crypto';
import type { Request } from 'express';
import { config } from './config';
import { redis } from './redis';
import { parseUa } from './ua';

// สัญญากับ analytics-service: ต่อท้ายคิว Redis list `clicks:queue` เป็น JSON {l,h,ua,r,c,d,o,b,t}
//   l=link id  h=sha256(ip+salt)  ua=user agent (≤512)  r=origin ของ referer  c=ประเทศ ISO2
//   d=device  o=OS  b=browser  t=epoch ms
export const CLICK_QUEUE = 'clicks:queue';
const FLUSH_LOCK = 'clicks:flush:ping'; // กันหลาย instance ping พร้อมกัน

export interface ClickEvent {
  l: number;
  h: string;
  ua: string | null;
  r: string | null;
  c: string | null;
  d: string;
  o: string | null;
  b: string | null;
  t: number;
}

function clientIp(req: Request): string {
  if (config.behindCloudflare) {
    const cf = req.headers['cf-connecting-ip'];
    if (typeof cf === 'string' && cf) return cf;
  }
  // ::ffff:1.2.3.4 → 1.2.3.4 ให้ hash ตรงกันไม่ว่า socket เป็น IPv4/IPv6
  return (req.ip ?? 'unknown').replace(/^::ffff:/, '');
}

function country(req: Request): string | null {
  if (!config.behindCloudflare) return null;
  const c = req.headers['cf-ipcountry'];
  return typeof c === 'string' && /^[A-Z]{2}$/.test(c) && c !== 'XX' && c !== 'T1' ? c : null;
}

// เก็บเฉพาะ origin ของ referer (ตัด path/query ที่อาจมีข้อมูลส่วนตัว)
function refererOrigin(req: Request): string | null {
  const ref = req.headers.referer;
  if (typeof ref !== 'string' || !ref) return null;
  try {
    const o = new URL(ref).origin;
    return o === 'null' ? null : o.slice(0, 512);
  } catch {
    return null;
  }
}

export function buildClickEvent(req: Request, linkId: number): ClickEvent {
  const rawUa = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined;
  const { device, os, browser } = parseUa(rawUa);
  return {
    l: linkId,
    h: createHash('sha256').update(clientIp(req) + config.ipHashSalt).digest('hex'), // ไม่เก็บ IP ดิบ
    ua: rawUa ? rawUa.slice(0, 512) : null,
    r: refererOrigin(req),
    c: country(req),
    d: device,
    o: os,
    b: browser,
    t: Date.now(),
  };
}

// ---- ping analytics-service ให้ flush คิว (ไม่รอผล ไม่ polling) ----
let lastPing = 0;
let trailing: NodeJS.Timeout | null = null;

// ตั้ง timer ping ครั้งเดียว (ซ้อนไม่ได้) — ใช้ทั้งตอนคลิกถี่ในรอบเดิม และตอนชน lock
function scheduleTrailing(delayMs: number) {
  if (trailing) return;
  trailing = setTimeout(() => {
    trailing = null;
    void ping();
  }, delayMs);
  trailing.unref();
}

async function ping() {
  lastPing = Date.now();
  if (!config.analyticsUrl) return;
  try {
    // lock ข้าม instance: ≤ 1 ping ต่อช่วง — อายุ lock สั้นกว่ารอบเล็กน้อย (90%) ไม่งั้น trailing timer ที่ยิงตอนครบรอบพอดีจะชน lock ตัวเองแล้วถูกข้าม
    const lockMs = Math.max(500, Math.floor(config.clickFlushSeconds * 1000 * 0.9));
    const got = await redis.set(FLUSH_LOCK, '1', 'PX', lockMs, 'NX');
    if (got !== 'OK') {
      // ชน lock (instance อื่น/รอบก่อน ping ไปแล้ว) แต่คลิกของเราอาจเข้าคิวหลัง flush รอบนั้น → ลองใหม่เมื่อ lock หมด ไม่งั้นคลิกท้ายๆ ค้างจนกว่าจะมีคนคลิกอีก
      scheduleTrailing(Math.max(await redis.pttl(FLUSH_LOCK), 0) + 100);
      return;
    }
    const res = await fetch(`${config.analyticsUrl}/internal/flush`, {
      method: 'POST',
      headers: { 'x-internal-key': config.internalKey },
      signal: AbortSignal.timeout(60_000), // รองรับ cold start ของ Render free
    });
    if (!res.ok) console.error(`analytics flush ตอบ ${res.status}`);
  } catch (e) {
    console.error('analytics flush ล้มเหลว (คิวยังอยู่ใน Redis จะ flush รอบหน้า):', (e as Error).message);
  }
}

/** เรียกหลังคลิก: ping ทันทีถ้าพ้นช่วงแล้ว ไม่งั้นตั้ง timer เดียวไว้ ping ตอนครบช่วง (คลิกท้ายๆ จึงไม่ค้าง) */
function scheduleFlush() {
  const windowMs = config.clickFlushSeconds * 1000;
  const elapsed = Date.now() - lastPing;
  if (elapsed >= windowMs) void ping();
  else scheduleTrailing(windowMs - elapsed);
}

/** เข้าคิวคลิก — เรียกแบบ fire-and-forget หลังตอบ redirect แล้ว; ผิดพลาดต้องไม่กระทบผู้ใช้ */
export async function enqueueClick(req: Request, linkId: number) {
  try {
    const len = await redis.rpush(CLICK_QUEUE, JSON.stringify(buildClickEvent(req, linkId)));
    // analytics ล่มนาน → ทิ้งคลิกเก่าสุดแทนปล่อยให้ Redis เต็ม
    if (len > config.clickQueueMax) await redis.ltrim(CLICK_QUEUE, -config.clickQueueMax, -1);
    scheduleFlush();
  } catch (e) {
    console.error('เข้าคิวคลิกไม่สำเร็จ:', (e as Error).message);
  }
}
