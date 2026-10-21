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
  startsAt: Date | null;
  maxClicks: number | null;
  hasPassword: boolean;
}

export async function findLink(code: string): Promise<LinkRow | null> {
  const { rows } = await pool.query(
    // คอลัมน์เวลาเป็น timestamptz → pg ได้ Date ที่ถูกต้องเสมอ ไม่ขึ้นกับ timezone ของเครื่อง
    `SELECT id, original_url AS url, status, expires_at AS "expiresAt", starts_at AS "startsAt", max_clicks AS "maxClicks", (password_hash IS NOT NULL) AS "hasPassword" FROM links WHERE short_code = $1`,
    [code],
  );
  return rows[0] ?? null;
}

export async function getPasswordHash(id: number): Promise<string | null> {
  const { rows } = await pool.query('SELECT password_hash AS h FROM links WHERE id = $1', [id]);
  return rows[0]?.h ?? null;
}

export async function getClickCount(id: number): Promise<number> {
  const { rows } = await pool.query('SELECT click_count AS n FROM links WHERE id = $1', [id]);
  return rows[0]?.n ?? 0;
}
