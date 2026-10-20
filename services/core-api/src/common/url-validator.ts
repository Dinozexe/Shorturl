import { randomInt } from 'crypto';
import { config } from './config';
import { HttpError } from './http-error';

// ---------- alias / short code ----------

// ชื่อที่ห้ามใช้เป็น alias — ถ้าเพิ่ม route ระดับ root ใหม่ ต้องเพิ่มคำนั้นที่นี่ด้วย
export const RESERVED_ALIASES = new Set([
  'api', 'admin', 'app', 'auth', 'login', 'logout', 'register', 'signup', 'signin', 'dashboard',
  'keys', 'settings', 'health', 'status', 'static', 'assets', 'public', 'www', 'qr', 'internal',
  'docs', 'help', 'about', 'terms', 'privacy', 'robots', 'sitemap', 'favicon', '_next', 'null', 'undefined',
]);

// 3–30 ตัว: A–Z a–z 0–9 _ - ; ขึ้นต้น/ลงท้ายด้วยตัวอักษรหรือตัวเลข (แยกตัวพิมพ์เล็กใหญ่)
const ALIAS_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{1,28}[A-Za-z0-9]$/;

export function validateAlias(alias: string): string {
  if (!ALIAS_RE.test(alias)) {
    throw new HttpError(400, 'alias ต้องยาว 3–30 ตัว ใช้ได้เฉพาะ A–Z a–z 0–9 _ - และขึ้นต้น/ลงท้ายด้วยตัวอักษรหรือตัวเลข');
  }
  if (RESERVED_ALIASES.has(alias.toLowerCase())) throw new HttpError(400, 'alias นี้เป็นคำสงวน กรุณาใช้ชื่ออื่น');
  return alias;
}

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function generateShortCode(length: number): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < length; i++) code += BASE62[randomInt(BASE62.length)];
    if (!RESERVED_ALIASES.has(code.toLowerCase())) return code;
  }
}

// ---------- target URL ----------

const MAX_URL_LENGTH = 2048;
const INTERNAL_TLDS = new Set(['local', 'localhost', 'internal', 'lan', 'intranet', 'corp', 'home']);

export interface TargetUrl {
  href: string;
  host: string; // hostname แบบ lowercase ไม่มีจุดท้าย (ใช้ตรวจโดเมนต้องห้าม)
}

function ipv4ToInt(host: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

// [เริ่ม, mask bits] — ช่วง IP ที่ไม่ใช่ปลายทางสาธารณะ
const NON_PUBLIC_V4: Array<[string, number]> = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
];

function isNonPublicV4(ip: number): boolean {
  return NON_PUBLIC_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return ((ip & mask) >>> 0) === ((ipv4ToInt(base)! & mask) >>> 0);
  });
}

function ownHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const u of [config.publicBaseUrl, config.apiBaseUrl, config.frontendOrigin]) {
    try {
      hosts.add(new URL(u).hostname.toLowerCase());
    } catch {
      /* env ไม่ถูกต้องจะถูกจับตอนใช้งานจริง */
    }
  }
  return hosts;
}

/** ตรวจ URL ปลายทาง: http/https เท่านั้น, ไม่มี credentials, ไม่ใช่ host ภายใน/IP ส่วนตัว, ไม่ชี้ตัวเอง */
export function validateTargetUrl(input: string): TargetUrl {
  const raw = input.trim();
  if (!raw || raw.length > MAX_URL_LENGTH) throw new HttpError(400, `URL ต้องไม่ว่างและยาวไม่เกิน ${MAX_URL_LENGTH} ตัวอักษร`);

  let url: URL;
  try {
    url = new URL(raw); // WHATWG แปลง IP รูปแบบแปลก (เลขฐาน 10/16/8) เป็น dotted decimal ให้แล้ว
  } catch {
    throw new HttpError(400, 'URL ไม่ถูกต้อง (ต้องขึ้นต้นด้วย http:// หรือ https://)');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, 'รองรับเฉพาะลิงก์ http:// และ https://');
  }
  if (url.username || url.password) throw new HttpError(400, 'URL ต้องไม่มีชื่อผู้ใช้/รหัสผ่านฝังอยู่');

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (host.startsWith('[')) throw new HttpError(400, 'ไม่รองรับ URL ที่ใช้ IPv6 โดยตรง');

  const ip = ipv4ToInt(host);
  if (ip !== null) {
    if (isNonPublicV4(ip)) throw new HttpError(400, 'ไม่รองรับ URL ที่ชี้ไปยัง IP ภายในหรือ IP ที่สงวนไว้');
  } else {
    const labels = host.split('.');
    if (labels.length < 2 || INTERNAL_TLDS.has(labels[labels.length - 1]) || /^\d+$/.test(labels[labels.length - 1])) {
      throw new HttpError(400, 'ไม่รองรับ URL ที่ชี้ไปยังโฮสต์ภายใน');
    }
  }
  if (ownHosts().has(host)) throw new HttpError(400, 'ไม่สามารถย่อลิงก์ที่ชี้กลับมายังระบบนี้ได้');

  return { href: url.href, host };
}

/** รายการโดเมนที่ต้องเช็คกับ blocked_domains: a.b.com → [a.b.com, b.com, com] */
export function hostSuffixes(host: string): string[] {
  const labels = host.split('.');
  return labels.map((_, i) => labels.slice(i).join('.'));
}
