import { config } from '../common/config';

// รอได้นาน: analytics-service บน Render free อาจหลับ (ปลุก 30–50 วิ)
const TIMEOUT_MS = 60_000;

export class AnalyticsNotFound extends Error {}

/** ดึงสถิติจาก analytics-service (internal); ล่ม/ไม่ได้ตั้งค่า → null ให้ผู้เรียกตอบ unavailable */
export async function fetchLinkStats(linkId: number, days: number): Promise<unknown | null> {
  if (!config.analyticsUrl || !config.internalKey) return null;
  try {
    const res = await fetch(`${config.analyticsUrl}/internal/links/${linkId}/stats?days=${days}`, {
      headers: { 'x-internal-key': config.internalKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 404) throw new AnalyticsNotFound();
    if (!res.ok) {
      console.error(`analytics-service ตอบ ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    if (e instanceof AnalyticsNotFound) throw e;
    console.error('เรียก analytics-service ไม่สำเร็จ:', (e as Error).message);
    return null;
  }
}
