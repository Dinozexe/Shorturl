// โหลดก่อนทุกไฟล์ทดสอบ (node --import ./tests/setup.ts): ตั้ง env ให้ชี้ "ฐานทดสอบ" เสมอ ไม่ใช้ DATABASE_URL/REDIS_URL ของ .env
// (dotenv ใน config.ts ไม่ทับตัวแปรที่ตั้งไว้แล้ว) และปฏิเสธการรันถ้าฐานไม่ใช่ฐานทดสอบ — กันลบข้อมูลจริงโดยไม่ตั้งใจ
const DB = process.env.TEST_DATABASE_URL ?? 'postgresql://shorturl:shorturl@localhost:5442/shorturl_test';
const REDIS = process.env.TEST_REDIS_URL ?? 'redis://localhost:6380/14';

const dbName = new URL(DB).pathname.replace(/^\//, '');
if (!/test/i.test(dbName)) throw new Error(`ปฏิเสธรันทดสอบ: ชื่อฐาน "${dbName}" ต้องมีคำว่า test (ตั้ง TEST_DATABASE_URL)`);
const redisDb = Number(new URL(REDIS).pathname.replace(/^\//, '') || 0);
if (redisDb === 0 && !process.env.CI) throw new Error('ปฏิเสธรันทดสอบ: Redis db 0 เป็นของระบบจริง ใช้ db อื่น เช่น redis://localhost:6380/14 (ตั้ง TEST_REDIS_URL)');

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: DB,
  REDIS_URL: REDIS,
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef0123456789',
  JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef012345678',
  PUBLIC_BASE_URL: 'https://s.example.test',
  API_BASE_URL: 'https://api.example.test',
  FRONTEND_ORIGIN: 'https://app.example.test',
  COOKIE_SECURE: 'false',
  COOKIE_DOMAIN: '',
  BEHIND_CLOUDFLARE: 'false',
  SHORT_CODE_LENGTH: '5',
  ANALYTICS_URL: '',
  INTERNAL_API_KEY: 'test-internal-key-0123456789',
  IP_HASH_SALT: 'test-salt-0123456789abcdef',
  ADMIN_EMAIL: 'owner@example.test',
  DEMO_ADMIN_EMAIL: 'demo@example.test',
  DEMO_ADMIN_PASSWORD: 'demo-password-123',
  GOOGLE_CLIENT_ID: 'test.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'test-google-secret',
  MICROSOFT_CLIENT_ID: '',
  MICROSOFT_CLIENT_SECRET: '',
});
