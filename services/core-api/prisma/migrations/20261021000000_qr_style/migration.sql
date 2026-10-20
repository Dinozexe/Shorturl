-- สไตล์ QR Code ที่ผู้ใช้ตั้งไว้ต่อลิงก์ (JSON ที่ผ่านการตรวจ/กรองฟิลด์แล้ว; ไม่เก็บรูปโลโก้ที่อัปโหลด)
ALTER TABLE "links" ADD COLUMN "qr_style" JSONB;
