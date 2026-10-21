#!/bin/sh
# เริ่ม core-api บน production (Render): migrate ก่อนเสมอ → seed เมื่อสั่ง → เปิดเซิร์ฟเวอร์
# SEED_ON_START=true ตอน deploy ครั้งแรก (จองอีเมลแอดมิน + สร้างแถวบัญชีเดโม) แล้วปิดได้ — seed รันซ้ำได้ปลอดภัย
set -e
./node_modules/.bin/prisma migrate deploy
if [ "$SEED_ON_START" = "true" ]; then
  ./node_modules/.bin/tsx prisma/seed.ts
fi
exec node dist/main.js
