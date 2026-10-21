-- เลิกใช้ API key (ถอด CLI ส่วนจัดการลิงก์): ลบตาราง + ค่า enum ที่เกี่ยวข้อง
DROP TABLE "api_keys";

-- แถว audit ของการสร้าง/เพิกถอน key ไม่มีความหมายแล้ว (enum ใหม่ไม่มีค่าเหล่านี้)
DELETE FROM "audit_logs" WHERE "action" IN ('API_KEY_CREATE', 'API_KEY_REVOKE') OR "target_type" = 'API_KEY';

-- Postgres ลบค่าออกจาก enum ตรงๆ ไม่ได้ → สร้างชนิดใหม่แล้วสลับคอลัมน์
DROP INDEX "audit_logs_action_created_at_idx";
CREATE TYPE "AuditAction_new" AS ENUM ('USER_REGISTER', 'USER_LOGIN', 'USER_LOGIN_BLOCKED', 'USER_BAN', 'USER_UNBAN', 'USER_ROLE_CHANGE', 'LINK_DISABLE', 'LINK_ENABLE', 'DOMAIN_BLOCK', 'DOMAIN_UNBLOCK');
ALTER TABLE "audit_logs" ALTER COLUMN "action" TYPE "AuditAction_new" USING ("action"::text::"AuditAction_new");
DROP TYPE "AuditAction";
ALTER TYPE "AuditAction_new" RENAME TO "AuditAction";
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);

CREATE TYPE "AuditTarget_new" AS ENUM ('USER', 'LINK', 'DOMAIN');
ALTER TABLE "audit_logs" ALTER COLUMN "target_type" TYPE "AuditTarget_new" USING ("target_type"::text::"AuditTarget_new");
DROP TYPE "AuditTarget";
ALTER TYPE "AuditTarget_new" RENAME TO "AuditTarget";
