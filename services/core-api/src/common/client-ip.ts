import type { Request } from 'express';
import { config } from './config';

export function clientIp(req: Request): string {
  if (config.behindCloudflare) {
    const cf = req.headers['cf-connecting-ip'];
    if (typeof cf === 'string' && cf) return cf;
  }
  return req.ip ?? 'unknown';
}
