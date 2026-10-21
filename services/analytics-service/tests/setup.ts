// ชี้ฐาน/Redis ทดสอบเสมอ และปฏิเสธถ้าไม่ใช่ฐานทดสอบ (ดู core-api/tests/setup.ts)
const DB = process.env.TEST_DATABASE_URL ?? 'postgresql://shorturl:shorturl@localhost:5442/shorturl_test';
const REDIS = process.env.TEST_REDIS_URL ?? 'redis://localhost:6380/14';
const dbName = new URL(DB).pathname.replace(/^\//, '');
if (!/test/i.test(dbName)) throw new Error(`ปฏิเสธรันทดสอบ: ชื่อฐาน "${dbName}" ต้องมีคำว่า test (ตั้ง TEST_DATABASE_URL)`);
if (Number(new URL(REDIS).pathname.replace(/^\//, '') || 0) === 0 && !process.env.CI) throw new Error('ปฏิเสธรันทดสอบ: Redis db 0 เป็นของระบบจริง (ตั้ง TEST_REDIS_URL เช่น redis://localhost:6380/14)');

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: DB,
  REDIS_URL: REDIS,
  INTERNAL_API_KEY: 'test-internal-key-0123456789',
  CLICK_RETENTION_DAYS: '90',
  FLUSH_BATCH_SIZE: '1000',
});
