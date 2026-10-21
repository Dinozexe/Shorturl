import type { RequestHandler } from 'express';
import { Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from '../common/config';
import { API_KEY_PREFIX, hashApiKey } from './api-key';
import { HttpError } from '../common/http-error';
import { prisma } from '../prisma/client';
import { redis } from '../redis/client';

interface AccessPayload {
  sub: string;
  jti: string;
  iatMs?: number;
  exp: number;
}

const SESSION_EXPIRED = 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';

const LAST_USED_EVERY_MS = 60_000; // อัปเดต last_used_at ไม่ถี่กว่านี้ ไม่ให้ทุก request เขียน DB

/** Bearer `surl_…`: ค้นด้วย sha256 (เก็บแต่ hash) — เพิกถอน = ลบแถว จึงใช้ไม่ได้ทันที; ใช้ได้เฉพาะ endpoint ที่ไม่ต้องมีบทบาทและไม่ใช่การจัดการ key */
async function authByApiKey(raw: string, req: Parameters<RequestHandler>[0]) {
  const key = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(raw) }, include: { user: true } });
  if (!key || (key.expiresAt && key.expiresAt.getTime() <= Date.now())) throw new HttpError(401, 'API key ไม่ถูกต้องหรือหมดอายุ');
  if (key.user.isBanned) throw new HttpError(403, 'บัญชีนี้ถูกระงับการใช้งาน');
  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > LAST_USED_EVERY_MS) {
    void prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
  req.user = { id: key.user.id, email: key.user.email, name: key.user.name, role: key.user.role, jti: `key:${key.id}`, exp: 0, viaKey: true };
}

/** ตรวจ access token (Bearer) หรือ API key แล้วโหลดผู้ใช้จาก DB — role/ban มีผลทันทีทุก request */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'กรุณาเข้าสู่ระบบ');
  if (header.startsWith(`Bearer ${API_KEY_PREFIX}`)) {
    await authByApiKey(header.slice(7).trim(), req);
    return next();
  }

  let payload: AccessPayload;
  try {
    payload = jwt.verify(header.slice(7), config.jwtAccessSecret, { algorithms: ['HS256'] }) as unknown as AccessPayload;
  } catch {
    throw new HttpError(401, SESSION_EXPIRED);
  }

  // คำสั่งเดียว: blacklist ตอน logout + เวลาเพิกถอนทุก session
  const [blacklisted, notBefore] = await redis.mget(`bl:${payload.jti}`, `rtnbf:${payload.sub}`);
  if (blacklisted || (notBefore && (payload.iatMs ?? 0) < Number(notBefore))) {
    throw new HttpError(401, SESSION_EXPIRED);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new HttpError(401, SESSION_EXPIRED);
  if (user.isBanned) throw new HttpError(403, 'บัญชีนี้ถูกระงับการใช้งาน');

  req.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    jti: payload.jti,
    exp: payload.exp,
    viaKey: false,
  };
  next();
};

/** ใช้หลัง requireAuth: requireRole('MODERATOR', 'ADMIN') — ระบุบทบาทที่อนุญาตให้ครบ ไม่มีลำดับชั้นอัตโนมัติ */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    const user = req.user;
    // API key (viaKey) ใช้ endpoint ที่ต้องมีบทบาทไม่ได้
    if (!user || user.viaKey || !roles.includes(user.role)) {
      return next(new HttpError(403, 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้'));
    }
    next();
  };

/** ใช้กับ endpoint ที่ API key ห้ามเรียก (เช่นจัดการ key เอง) */
export const webSessionOnly: RequestHandler = (req, _res, next) => {
  if (req.user?.viaKey) return next(new HttpError(403, 'ทำได้เฉพาะจากหน้าเว็บ ไม่รองรับ API key'));
  next();
};
