import { AuditAction, AuditTarget } from '@prisma/client';
import { prisma } from '../prisma/client';

interface AuditEntry {
  actorId?: string | null;
  targetType?: AuditTarget;
  targetId?: string;
  detail?: string;
}

// บันทึกพลาดต้องไม่ทำให้การกระทำหลัก (เช่นล็อกอิน) ล้ม
export async function audit(action: AuditAction, entry: AuditEntry = {}) {
  try {
    await prisma.auditLog.create({ data: { action, ...entry } });
  } catch (e) {
    console.error(`audit ${action} ล้มเหลว:`, (e as Error).message);
  }
}
