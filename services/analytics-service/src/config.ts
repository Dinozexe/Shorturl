import { config as loadEnv } from 'dotenv';

// รันจาก services/analytics-service → อ่าน .env ของ repo root (ใน docker/Render ใช้ env ที่ inject มาแทน)
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

const internalKey = required('INTERNAL_API_KEY');
if (isProd && internalKey.length < 16) throw new Error('INTERNAL_API_KEY ต้องยาวอย่างน้อย 16 ตัวอักษรใน production');

export const config = {
  port: int('ANALYTICS_PORT', int('PORT', 4002, 1, 65535), 1, 65535),
  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),
  internalKey,
  clickRetentionDays: int('CLICK_RETENTION_DAYS', 90, 1, 3650),
  batchSize: int('FLUSH_BATCH_SIZE', 1000, 1, 10000),
};
