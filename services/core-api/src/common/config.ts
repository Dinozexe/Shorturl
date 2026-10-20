import { config as loadEnv } from 'dotenv';

// รันจาก services/core-api → อ่าน .env ของ repo root (ใน docker/Render ใช้ env ที่ inject มาแทน)
loadEnv({ path: ['.env', '../../.env'] });

const isProd = process.env.NODE_ENV === 'production';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`ต้องตั้งค่า env ${name}`);
  return v;
}

function secret(name: string): string {
  const v = required(name);
  if (isProd && v.length < 32) throw new Error(`${name} ต้องยาวอย่างน้อย 32 ตัวอักษรใน production`);
  return v;
}

// บัญชีเดโมสำหรับกรรมการ: เทียบรหัสกับ env ตรงๆ ไม่เก็บรหัส/hash ใน DB (เว้นว่าง = ปิดการล็อกอินด้วยรหัสผ่าน)
const demoAdminEmail = (process.env.DEMO_ADMIN_EMAIL ?? '').trim().toLowerCase();
const demoAdminPassword = process.env.DEMO_ADMIN_PASSWORD ?? '';
if (demoAdminPassword && demoAdminPassword.length < 8) {
  throw new Error('DEMO_ADMIN_PASSWORD ต้องยาวอย่างน้อย 8 ตัวอักษร');
}

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  redisUrl: required('REDIS_URL'),
  jwtAccessSecret: secret('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: secret('JWT_REFRESH_SECRET'),
  accessTtlSec: 15 * 60,
  refreshTtlSec: 7 * 24 * 60 * 60,
  frontendOrigin: required('FRONTEND_ORIGIN'),
  apiBaseUrl: required('API_BASE_URL'),
  behindCloudflare: process.env.BEHIND_CLOUDFLARE === 'true',
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true',
    domain: process.env.COOKIE_DOMAIN || undefined,
  },
  demoAdmin: demoAdminEmail && demoAdminPassword ? { email: demoAdminEmail, password: demoAdminPassword } : null,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID ?? '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
    tenant: process.env.MICROSOFT_TENANT || 'common',
  },
};
