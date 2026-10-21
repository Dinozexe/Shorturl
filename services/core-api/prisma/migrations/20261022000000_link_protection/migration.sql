-- ป้องกันลิงก์: รหัสผ่าน (scrypt hash) · จำกัดจำนวนคลิก · วันเริ่มใช้งาน (ทั้งหมดไม่บังคับ)
ALTER TABLE "links" ADD COLUMN "password_hash" TEXT,
ADD COLUMN "max_clicks" INTEGER,
ADD COLUMN "starts_at" TIMESTAMP(3);
