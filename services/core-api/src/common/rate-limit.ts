import type { RequestHandler } from 'express';
import { redis } from '../redis/client';
import { clientIp } from './client-ip';
import { HttpError } from './http-error';

// นับคำขอต่อ IP ด้วย Redis: rateLimit('sso', 20, 60) = 20 ครั้ง/นาที
export const rateLimit =
  (name: string, limit: number, windowSec: number): RequestHandler =>
  async (req, _res, next) => {
    const key = `rl:${name}:${clientIp(req)}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec);
    if (count > limit) throw new HttpError(429, 'คำขอถี่เกินไป กรุณาลองใหม่ภายหลัง');
    next();
  };
