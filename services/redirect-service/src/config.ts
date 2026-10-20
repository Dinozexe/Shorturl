import { config as loadEnv } from 'dotenv';

// รันจาก services/redirect-service → อ่าน .env ของ repo root (ใน docker/Render ใช้ env ที่ inject มาแทน)
loadEnv({ path: ['.env', '../../.env'] });

const isProd = process.env.NODE_ENV === 'production';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`ต้องตั้งค่า env ${name}`);
  return v;
}

function int(name: string, fallback: number, min: number, max: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= min && n <= max ? Math.floor(n) : fallback;
}

const ipHashSalt = required('IP_HASH_SALT');
if (isProd && ipHashSalt.length < 16) throw new Error('IP_HASH_SALT ต้องยาวอย่างน้อย 16 ตัวอักษรใน production');

export const config = {
  port: int('PORT', 4001, 1, 65535),
  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),
  frontendOrigin: required('FRONTEND_ORIGIN'),
  behindCloudflare: process.env.BEHIND_CLOUDFLARE === 'true',
  ipHashSalt,
  clickFlushSeconds: int('CLICK_FLUSH_SECONDS', 60, 1, 3600),
  clickQueueMax: int('CLICK_QUEUE_MAX', 50000, 1, 10_000_000), // กันคิวโตไม่จำกัดเมื่อ analytics ล่มนาน
  analyticsUrl: (process.env.ANALYTICS_URL ?? '').replace(/\/+$/, ''),
  internalKey: process.env.INTERNAL_API_KEY ?? '',
};
