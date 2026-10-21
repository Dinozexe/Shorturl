import { translateServerMessage } from './serverMessages';
import type { AuthUser } from './types';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');

// ภาษาที่ UI ใช้อยู่ (ตั้งโดย I18nProvider) — ใช้แปลข้อความ error ของเซิร์ฟเวอร์และข้อความของ api.ts เอง
type ApiLang = 'th' | 'en';
let apiLang: ApiLang = 'th';
export const setApiLang = (l: ApiLang) => {
  apiLang = l;
};
const NETWORK_MSG = {
  th: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ซึ่งอาจเป็นเพราะเซิร์ฟเวอร์กำลังเริ่มทำงาน (ใช้เวลาไม่เกิน 1 นาที) กรุณารอสักครู่แล้วลองใหม่ หรือตรวจสอบอินเทอร์เน็ต',
  en: 'Can\'t reach the server. It may still be starting up (up to a minute) — wait a moment and try again, or check your connection.',
};
const GENERIC_MSG = { th: 'เกิดข้อผิดพลาด กรุณาลองใหม่', en: 'Something went wrong. Please try again.' };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// access token อยู่ใน memory เท่านั้น (ไม่ใส่ localStorage กัน XSS ขโมย); refresh token เป็น httpOnly cookie ที่เบราว์เซอร์จัดการเอง
let accessToken: string | null = null;
export const SESSION_LOST_EVENT = 'surl:session-lost';

export const setAccessToken = (t: string | null) => {
  accessToken = t;
};

// ---- refresh แบบ single-flight ----
// refresh token ใช้ได้ครั้งเดียว: ถ้าเรียกซ้อนกัน (React StrictMode ตอน dev, หลาย request 401 พร้อมกัน, หลายแท็บ)
// ตัวที่สองจะถูกมองว่า "ใช้ซ้ำ" แล้วเซิร์ฟเวอร์เตะออกทุกอุปกรณ์ → ต้องรวมเป็นคำขอเดียวทั้งในแท็บและข้ามแท็บ
export type RefreshResult = { kind: 'ok'; user: AuthUser } | { kind: 'anon' } | { kind: 'unreachable' };
let inflight: Promise<RefreshResult> | null = null;

const REFRESH_TIMEOUT_MS = 30_000;

async function doRefresh(): Promise<RefreshResult> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REFRESH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, { method: 'POST', credentials: 'include', signal: ctl.signal });
    if (res.ok) {
      const data = (await res.json()) as { accessToken: string; user: AuthUser };
      accessToken = data.accessToken;
      return { kind: 'ok', user: data.user };
    }
    // 5xx (รวม 502/503/504 ตอน Render กำลังปลุก service) ไม่ใช่ "session หมด": เก็บ token เดิมไว้ ห้ามเตะผู้ใช้ออก
    if (res.status >= 500) return { kind: 'unreachable' };
    accessToken = null;
    return { kind: 'anon' };
  } catch {
    return { kind: 'unreachable' }; // เครือข่ายล้ม/หมดเวลา/ถูกบล็อกเพราะเซิร์ฟเวอร์ยังไม่ตื่น ≠ session หมด: ไม่ล้าง token เดิม
  } finally {
    clearTimeout(timer);
  }
}

export function refreshSessionDetailed(): Promise<RefreshResult> {
  if (!inflight) {
    const run = async (): Promise<RefreshResult> => {
      if (typeof navigator !== 'undefined' && navigator.locks) {
        return navigator.locks.request('surl-refresh', async () => doRefresh());
      }
      return doRefresh();
    };
    inflight = run().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** ผลแบบย่อ: ผู้ใช้ หรือ null (ทั้งกรณีไม่ได้ล็อกอินและติดต่อไม่ได้) — ใช้ในที่ที่แยกสองกรณีไม่จำเป็น */
export async function refreshSession(): Promise<AuthUser | null> {
  const r = await refreshSessionDetailed();
  return r.kind === 'ok' ? r.user : null;
}

// ---- รอเซิร์ฟเวอร์ตื่น (Render ฟรีหลับเมื่อไม่มีคนใช้ ปลุก 30–50 วินาที) ----
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** เวลารอสูงสุดก่อนยอมแพ้ (ms) — ทดสอบปรับผ่าน window.__SURL_WAKE_MS ได้ */
export const wakeMaxMs = (): number => {
  const v = typeof window !== 'undefined' ? (window as unknown as { __SURL_WAKE_MS?: number }).__SURL_WAKE_MS : undefined;
  return typeof v === 'number' && v > 0 ? v : 90_000;
};

export interface WakeOptions {
  maxMs?: number;
  intervalMs?: number;
  probeMs?: number;
}

/** ยิง /api/health ซ้ำจนตอบ ok (หรือหมดเวลา) — เรียกซ้ำได้ปลอดภัย (ไม่แตะ token) จึงไม่เสี่ยงทำ refresh token ถูกใช้ซ้ำ */
export async function waitForServer({ maxMs = wakeMaxMs(), intervalMs = 2500, probeMs = 8000 }: WakeOptions = {}): Promise<boolean> {
  const end = Date.now() + maxMs;
  while (Date.now() < end) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), probeMs);
    try {
      const res = await fetch(`${API_URL}/api/health`, { cache: 'no-store', signal: ctl.signal });
      if (res.ok) return true;
    } catch {
      /* ยังไม่ตื่น */
    } finally {
      clearTimeout(timer);
    }
    await sleep(intervalMs);
  }
  return false;
}

/** ตรวจ session ตอนเปิดหน้า: ถ้าติดต่อเซิร์ฟเวอร์ไม่ได้ ให้รอจนตื่นแล้วลองใหม่ครั้งเดียว (ไม่เตะผู้ใช้ออกเพราะเซิร์ฟเวอร์แค่หลับ) */
export async function refreshWithWake(opts: WakeOptions = {}): Promise<RefreshResult> {
  let r = await refreshSessionDetailed();
  if (r.kind === 'unreachable' && (await waitForServer(opts))) r = await refreshSessionDetailed();
  return r;
}

// ---- ปลุกล่วงหน้า: ยิงแบบ no-cors ทิ้งไว้เฉยๆ (ไม่รอผล ไม่แสดง error) เพื่อให้ service ตื่นก่อนผู้ใช้จะใช้จริง ----
const warmedAt = new Map<string, number>();
const WARM_EVERY_MS = 4 * 60_000;

export function warmUp(url: string = `${API_URL}/api/health`): void {
  const now = Date.now();
  if (now - (warmedAt.get(url) ?? 0) < WARM_EVERY_MS) return;
  warmedAt.set(url, now);
  void fetch(url, { mode: 'no-cors', cache: 'no-store' }).catch(() => undefined);
}

/** ปลุก redirect-service จาก URL ของลิงก์สั้นที่เพิ่งสร้าง (ผู้ใช้มักจะกดทดสอบลิงก์นั้นต่อทันที) */
export function warmShortLink(shortUrl: string): void {
  try {
    warmUp(`${new URL(shortUrl).origin}/health`);
  } catch {
    /* URL ไม่ถูกต้อง: ข้าม */
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.auth !== false && accessToken) headers.authorization = `Bearer ${accessToken}`;
  return fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'include',
  });
}

/** เรียก API; ถ้า 401 จะลอง refresh หนึ่งครั้งแล้วยิงซ้ำ ถ้ายังไม่ได้ถือว่า session หมด */
async function request(path: string, opts: RequestOptions): Promise<Response> {
  let res: Response;
  try {
    res = await send(path, opts);
  } catch {
    throw new ApiError(0, NETWORK_MSG[apiLang]);
  }
  if (res.status === 401 && opts.auth !== false) {
    const r = await refreshSessionDetailed();
    if (r.kind === 'ok') {
      res = await send(path, opts);
    } else if (r.kind === 'anon') {
      window.dispatchEvent(new Event(SESSION_LOST_EVENT));
    } else {
      throw new ApiError(0, NETWORK_MSG[apiLang]); // ติดต่อเซิร์ฟเวอร์ไม่ได้ ≠ session หมด: ไม่ประกาศว่าออกจากระบบ
    }
  }
  return res;
}

async function toError(res: Response): Promise<ApiError> {
  let message = GENERIC_MSG[apiLang];
  try {
    const data = (await res.json()) as { message?: string };
    if (data.message) message = translateServerMessage(data.message, apiLang);
  } catch {
    /* ไม่ใช่ JSON */
  }
  return new ApiError(res.status, message);
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await request(path, opts);
  if (!res.ok) throw await toError(res);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** ดึงไฟล์ (เช่น QR) พร้อม Authorization — ใช้ <img src> ตรงๆ ไม่ได้เพราะส่ง header ไม่ได้ */
export async function apiBlob(path: string): Promise<Blob> {
  const res = await request(path, {});
  if (!res.ok) throw await toError(res);
  return res.blob();
}

// ---- auth ----
export async function loginWithPassword(email: string, password: string): Promise<AuthUser> {
  const data = await api<{ accessToken: string; user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
  accessToken = data.accessToken;
  return data.user;
}

export async function logoutRequest(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
    });
  } finally {
    accessToken = null;
  }
}
