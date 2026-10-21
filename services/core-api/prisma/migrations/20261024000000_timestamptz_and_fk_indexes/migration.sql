-- เวลาทุกคอลัมน์เปลี่ยนเป็น timestamptz (best practice ของ Postgres)
-- ข้อมูลเดิมเก็บเป็น UTC อยู่แล้ว จึงระบุ AT TIME ZONE 'UTC' ตอนแปลง ไม่พึ่ง timezone ของ session
ALTER TABLE "users" ALTER COLUMN "last_login_at" SET DATA TYPE TIMESTAMPTZ(3) USING "last_login_at" AT TIME ZONE 'UTC';
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "sso_identities" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "sso_identities" ALTER COLUMN "last_login_at" SET DATA TYPE TIMESTAMPTZ(3) USING "last_login_at" AT TIME ZONE 'UTC';
ALTER TABLE "links" ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMPTZ(3) USING "expires_at" AT TIME ZONE 'UTC';
ALTER TABLE "links" ALTER COLUMN "starts_at" SET DATA TYPE TIMESTAMPTZ(3) USING "starts_at" AT TIME ZONE 'UTC';
ALTER TABLE "links" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "clicks" ALTER COLUMN "clicked_at" SET DATA TYPE TIMESTAMPTZ(3) USING "clicked_at" AT TIME ZONE 'UTC';
ALTER TABLE "blocked_domains" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "audit_logs" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- index ให้ FK ที่ใช้ตอนลบผู้ใช้ (ON DELETE SET NULL) ไม่ต้องสแกนทั้งตาราง
CREATE INDEX "blocked_domains_created_by_id_idx" ON "blocked_domains"("created_by_id");
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");
