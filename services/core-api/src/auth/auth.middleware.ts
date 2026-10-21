import type { RequestHandler } from 'express';
import { Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from '../common/config';
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

/** ตรวจ access token (Bearer) แล้วโหลดผู้ใช้จาก DB — role/ban มีผลทันทีทุก request */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'กรุณาเข้าสู่ระบบ');

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
  };
  next();
};

/** ใช้หลัง requireAuth: requireRole('MODERATOR', 'ADMIN') — ระบุบทบาทที่อนุญาตให้ครบ ไม่มีลำดับชั้นอัตโนมัติ */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    const user = req.user;
    if (!user || !roles.includes(user.role)) {
      return next(new HttpError(403, 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้'));
    }
    next();
  };
