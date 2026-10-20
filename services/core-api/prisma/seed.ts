import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1) จองอีเมลแอดมินคนแรก (ไม่มีรหัสผ่าน; เจ้าของล็อกอิน Google ครั้งแรกแล้วถูกผูกเข้าบัญชีนี้)
async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    console.log('ADMIN_EMAIL ไม่ได้ตั้งค่า ข้าม');
    return;
  }
  await prisma.user.upsert({ where: { email }, update: { role: 'ADMIN' }, create: { email, role: 'ADMIN' } });
  console.log(`seed: ADMIN ${email}`);
}

// 2) บัญชีเดโมสำหรับกรรมการ: สร้างแถว user ไว้เฉพาะตัวตน/บทบาท — รหัสผ่านอยู่ใน env (DEMO_ADMIN_PASSWORD) ไม่เก็บใน DB
async function seedDemoAdmin() {
  const email = process.env.DEMO_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || !process.env.DEMO_ADMIN_PASSWORD) {
    console.log('DEMO_ADMIN_EMAIL/PASSWORD ไม่ได้ตั้งค่า ข้ามบัญชีเดโม');
    return;
  }
  await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN', isBanned: false },
    create: { email, name: 'Demo Admin', role: 'ADMIN' },
  });
  console.log(`seed: DEMO ADMIN ${email}`);
}

seedAdmin()
  .then(seedDemoAdmin)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
