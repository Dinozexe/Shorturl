import { Role, SsoProvider } from '@prisma/client';

// ผู้ใช้ที่ requireAuth แนบไว้ที่ req.user (role/ban อ่านจาก DB ทุก request)
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  jti: string;
  exp: number;
  viaKey: boolean; // true เมื่อมาจาก API key (P8) — ใช้ /api/admin/* ไม่ได้
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface SsoProfile {
  provider: SsoProvider;
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ข้อผิดพลาดที่แสดงให้ผู้ใช้เห็นบนหน้า login (?sso_error=...)
export class SsoError extends Error {}
