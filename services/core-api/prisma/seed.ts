import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// จองอีเมลแอดมินคนแรก (ไม่มีรหัสผ่าน; เจ้าของล็อกอิน Google ครั้งแรกแล้วถูกผูกเข้าบัญชีนี้)
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    console.log('ADMIN_EMAIL ไม่ได้ตั้งค่า ข้าม seed');
    return;
  }
  await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN' },
    create: { email, role: 'ADMIN' },
  });
  console.log(`seed: ADMIN ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
