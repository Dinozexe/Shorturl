// โหลดก่อนทุกไฟล์ทดสอบ: ชี้ฐาน/Redis ทดสอบเสมอ (ไม่ใช้ .env) และปฏิเสธถ้าไม่ใช่ฐานทดสอบ
const DB = process.env.TEST_DATABASE_URL ?? 'postgresql://shorturl:shorturl@localhost:5442/shorturl_test';
const REDIS = process.env.TEST_REDIS_URL ?? 'redis://localhost:6380/14';
const dbName = new URL(DB).pathname.replace(/^\//, '');
if (!/test/i.test(dbName)) throw new Error(`ปฏิเสธรันทดสอบ: ชื่อฐาน "${dbName}" ต้องมีคำว่า test (ตั้ง TEST_DATABASE_URL)`);
if (Number(new URL(REDIS).pathname.replace(/^\//, '') || 0) === 0 && !process.env.CI) throw new Error('ปฏิเสธรันทดสอบ: Redis db 0 เป็นของระบบจริง (ตั้ง TEST_REDIS_URL เช่น redis://localhost:6380/14)');

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: DB,
  REDIS_URL: REDIS,
  FRONTEND_ORIGIN: 'https://app.example.test',
  IP_HASH_SALT: 'test-salt-0123456789abcdef',
  BEHIND_CLOUDFLARE: 'false',
  ANALYTICS_URL: '', // ไม่ ping analytics ระหว่างทดสอบ
  INTERNAL_API_KEY: 'test-internal-key-0123456789',
  CLICK_FLUSH_SECONDS: '60',
});
