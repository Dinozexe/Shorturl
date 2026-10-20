// สัญญากับ redirect-service: JSON {l,h,ua,r,c,d,o,b,t} ใน Redis list `clicks:queue`
export const CLICK_QUEUE = 'clicks:queue';
export const DEAD_QUEUE = 'clicks:dead'; // เหตุการณ์ที่ DB ปฏิเสธเพราะข้อมูลผิด (เก็บไว้ตรวจสอบ ไม่เกิน 1000)

const DEVICES = new Set(['desktop', 'mobile', 'tablet', 'bot', 'unknown']);
const MIN_TS = Date.UTC(2020, 0, 1);

export interface ClickEvent {
  linkId: number;
  ipHash: string;
  userAgent: string | null;
  referer: string | null;
  country: string | null;
  device: string;
  os: string | null;
  browser: string | null;
  ts: number; // epoch ms
}

export interface Parsed {
  raw: string;
  ev: ClickEvent;
}

// Postgres text รับ NUL (\u0000) ไม่ได้ → ตัดทิ้ง; จำกัดความยาวกันข้อมูลบวม
const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v ? v.replace(/\u0000/g, '').slice(0, max) || null : null;

/** ตรวจ+แปลงเหตุการณ์ 1 รายการ; ไม่ผ่าน = null (ถูกทิ้ง ไม่ให้ขวางรายการอื่น) */
export function parseEvent(raw: string, now = Date.now()): ClickEvent | null {
  let o: Record<string, unknown>;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    o = v as Record<string, unknown>;
  } catch {
    return null;
  }
  const l = o.l;
  if (typeof l !== 'number' || !Number.isInteger(l) || l <= 0 || l > 2147483647) return null;
  if (typeof o.h !== 'string' || !/^[0-9a-f]{64}$/.test(o.h)) return null;
  const t = o.t;
  if (typeof t !== 'number' || !Number.isFinite(t) || t < MIN_TS || t > now + 24 * 3600 * 1000) return null;

  const c = typeof o.c === 'string' && /^[A-Z]{2}$/.test(o.c) ? o.c : null;
  return {
    linkId: l,
    ipHash: o.h,
    userAgent: str(o.ua, 512),
    referer: str(o.r, 512),
    country: c,
    device: typeof o.d === 'string' && DEVICES.has(o.d) ? o.d : 'unknown',
    os: str(o.o, 64),
    browser: str(o.b, 64),
    ts: Math.floor(t),
  };
}
