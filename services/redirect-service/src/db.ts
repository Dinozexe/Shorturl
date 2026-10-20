import { Pool } from 'pg';
import { config } from './config';

// pool เล็กๆ (Neon free จำกัด connection); redirect แตะ DB เฉพาะตอน cache miss เท่านั้น
export const pool = new Pool({ connectionString: config.databaseUrl, max: 5, idleTimeoutMillis: 30_000 });
pool.on('error', (e) => console.error('pg pool error:', e.message));

export interface LinkRow {
  id: number;
  url: string;
  status: 'ACTIVE' | 'DISABLED' | 'ADMIN_DISABLED';
  expiresAt: Date | null;
}

export async function findLink(code: string): Promise<LinkRow | null> {
  const { rows } = await pool.query(
    // Prisma เก็บเวลาเป็น UTC ใน `timestamp` (ไม่มี time zone) แต่ pg อ่านเป็นเวลาท้องถิ่นของเครื่อง → ต้อง AT TIME ZONE 'UTC' ไม่งั้นวันหมดอายุเพี้ยนตาม timezone
    `SELECT id, original_url AS url, status, expires_at AT TIME ZONE 'UTC' AS "expiresAt" FROM links WHERE short_code = $1`,
    [code],
  );
  return rows[0] ?? null;
}
