import { HttpError } from '../common/http-error';

// สไตล์ QR ที่เก็บต่อลิงก์ — รับเฉพาะฟิลด์/ค่าที่รู้จัก (กรองแล้วค่อยเก็บ) ไม่เก็บรูปที่อัปโหลด (เก็บแค่รหัสโลโก้สำเร็จรูป)
export const DOT_STYLES = ['square', 'rounded', 'dots', 'diamond', 'classy'] as const;
export const EYE_STYLES = ['square', 'rounded', 'circle'] as const;
export const LOGOS = ['none', 'link', 'star', 'heart', 'bolt'] as const;
export const ANGLES = [0, 45, 90, 135] as const;

export interface QrStyle {
  dots: (typeof DOT_STYLES)[number];
  eyes: (typeof EYE_STYLES)[number];
  fg: string; // #rrggbb
  fg2: string | null; // สีที่สองของไล่เฉด (null = สีเดียว)
  angle: (typeof ANGLES)[number];
  bg: string | null; // null = พื้นโปร่งใส
  eyeColor: string | null; // null = ใช้สีหลัก
  logo: (typeof LOGOS)[number];
  logoSize: number; // % ของความกว้าง 10–22 (ECC ระดับ H รับได้)
  caption: string; // ข้อความใต้ QR (ว่างได้)
  margin: number; // quiet zone เป็นจำนวนโมดูล 2–8
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const bad = (what: string) => new HttpError(400, `สไตล์ QR ไม่ถูกต้อง: ${what}`);

const oneOf = <T extends string | number>(v: unknown, list: readonly T[], what: string): T => {
  if (!list.includes(v as T)) throw bad(what);
  return v as T;
};
const color = (v: unknown, what: string): string => {
  if (typeof v !== 'string' || !HEX.test(v)) throw bad(what);
  return v.toLowerCase();
};
const optColor = (v: unknown, what: string): string | null => (v === null || v === undefined ? null : color(v, what));

export function parseQrStyle(raw: unknown): QrStyle {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw bad('รูปแบบข้อมูล');
  const o = raw as Record<string, unknown>;
  const logoSize = Number(o.logoSize ?? 18);
  const margin = Number(o.margin ?? 4);
  if (!Number.isFinite(logoSize) || logoSize < 10 || logoSize > 22) throw bad('ขนาดโลโก้ต้องอยู่ระหว่าง 10–22');
  if (!Number.isInteger(margin) || margin < 2 || margin > 8) throw bad('ขอบว่างต้องเป็นจำนวนเต็ม 2–8');
  const caption = typeof o.caption === 'string' ? o.caption.trim() : '';
  if (caption.length > 24) throw bad('ข้อความใต้ QR ยาวไม่เกิน 24 ตัวอักษร');

  const style: QrStyle = {
    dots: oneOf(o.dots ?? 'square', DOT_STYLES, 'ลายจุด'),
    eyes: oneOf(o.eyes ?? 'square', EYE_STYLES, 'ลายตาของ QR'),
    fg: color(o.fg ?? '#000000', 'สีหลัก'),
    fg2: optColor(o.fg2, 'สีที่สอง'),
    angle: oneOf(o.angle ?? 45, ANGLES, 'มุมไล่เฉด'),
    bg: optColor(o.bg === undefined ? '#ffffff' : o.bg, 'สีพื้น'),
    eyeColor: optColor(o.eyeColor, 'สีตา'),
    logo: oneOf(o.logo ?? 'none', LOGOS, 'โลโก้'),
    logoSize: Math.round(logoSize),
    caption,
    margin,
  };
  return style;
}
