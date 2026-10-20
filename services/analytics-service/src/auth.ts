import { createHash, timingSafeEqual } from 'crypto';
import type { RequestHandler } from 'express';
import { config } from './config';

const digest = (s: string) => createHash('sha256').update(s).digest();

// service นี้เรียกได้เฉพาะ service ภายในที่ถือ INTERNAL_API_KEY (header x-internal-key)
export const requireInternalKey: RequestHandler = (req, res, next) => {
  const given = req.headers['x-internal-key'];
  if (typeof given !== 'string' || !timingSafeEqual(digest(given), digest(config.internalKey))) {
    res.status(401).json({ statusCode: 401, message: 'ไม่ได้รับอนุญาต' });
    return;
  }
  next();
};
