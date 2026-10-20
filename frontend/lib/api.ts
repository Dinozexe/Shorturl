import { translateServerMessage } from './serverMessages';
import type { AuthUser } from './types';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');

// ภาษาที่ UI ใช้อยู่ (ตั้งโดย I18nProvider) — ใช้แปลข้อความ error ของเซิร์ฟเวอร์และข้อความของ api.ts เอง
type ApiLang = 'th' | 'en';
let apiLang: ApiLang = 'th';
export const setApiLang = (l: ApiLang) => {
  apiLang = l;
};
const NETWORK_MSG = { th: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่', en: 'Can\'t reach the server. Check your connection and try again.' };
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
let inflight: Promise<AuthUser | null> | null = null;

async function doRefresh(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (!res.ok) {
      accessToken = null;
      return null;
    }
    const data = (await res.json()) as { accessToken: string; user: AuthUser };
    accessToken = data.accessToken;
    return data.user;
  } catch {
    return null; // เครือข่ายล้มเหลว ≠ session หมด: ไม่ล้าง token เดิม
  }
}

export function refreshSession(): Promise<AuthUser | null> {
  if (!inflight) {
    const run = async (): Promise<AuthUser | null> => {
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
    const user = await refreshSession();
    if (user) {
      res = await send(path, opts);
    } else {
      window.dispatchEvent(new Event(SESSION_LOST_EVENT));
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
