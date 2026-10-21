import { pool } from './db';

export interface Bucket {
  key: string | null;
  clicks: number;
}

export interface LinkStats {
  linkId: number;
  days: number;
  total: number; // ยอดคลิกสะสมทั้งหมด (links.click_count)
  windowClicks: number; // ยอดคลิกในช่วง days วัน
  uniqueVisitors: number; // IP hash ไม่ซ้ำในช่วง (ประมาณ ไม่ใช่ตัวตนจริง)
  daily: Array<{ day: string; clicks: number }>; // วันตาม UTC เรียงเก่า→ใหม่ เติม 0 ให้วันที่ไม่มีคลิก
  referers: Bucket[]; // key null = เข้าตรง/ไม่มี referer
  countries: Bucket[];
  devices: Bucket[];
  os: Bucket[];
  browsers: Bucket[];
}

const dayStr = (d: Date) => d.toISOString().slice(0, 10);

/** days วันล่าสุดรวมวันนี้ (UTC) */
export function windowStart(days: number, now = new Date()): Date {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(today - (days - 1) * 86400000);
}

export async function getLinkStats(linkId: number, days: number): Promise<LinkStats | null> {
  const link = await pool.query('SELECT click_count FROM links WHERE id = $1', [linkId]);
  if (link.rowCount === 0) return null;

  const start = windowStart(days);
  const since = `${dayStr(start)}T00:00:00Z`; // เริ่มวันตามเวลา UTC

  // key เป็นชื่อคอลัมน์ที่เรากำหนดเอง (ไม่รับจากผู้ใช้) จึงต่อ string ได้ปลอดภัย
  const group = (col: string, limit: number) =>
    pool.query(
      `SELECT ${col} AS key, count(*)::int AS clicks FROM clicks
       WHERE link_id = $1 AND clicked_at >= $2::timestamptz GROUP BY 1 ORDER BY 2 DESC, 1 NULLS LAST LIMIT ${limit}`,
      [linkId, since],
    );

  const [daily, win, referers, countries, devices, os, browsers] = await Promise.all([
    pool.query('SELECT day::text AS day, clicks FROM link_daily_stats WHERE link_id = $1 AND day >= $2::date', [linkId, dayStr(start)]),
    pool.query(
      'SELECT count(*)::int AS clicks, count(DISTINCT ip_hash)::int AS visitors FROM clicks WHERE link_id = $1 AND clicked_at >= $2::timestamptz',
      [linkId, since],
    ),
    group('referer', 10),
    group('country', 10),
    group('device::text', 10),
    group('os', 10),
    group('browser', 10),
  ]);

  const byDay = new Map<string, number>(daily.rows.map((r) => [r.day as string, r.clicks as number]));
  const series: LinkStats['daily'] = [];
  for (let i = 0; i < days; i++) {
    const d = dayStr(new Date(start.getTime() + i * 86400000));
    series.push({ day: d, clicks: byDay.get(d) ?? 0 });
  }

  return {
    linkId,
    days,
    total: link.rows[0].click_count,
    windowClicks: win.rows[0].clicks,
    uniqueVisitors: win.rows[0].visitors,
    daily: series,
    referers: referers.rows,
    countries: countries.rows,
    devices: devices.rows,
    os: os.rows,
    browsers: browsers.rows,
  };
}
