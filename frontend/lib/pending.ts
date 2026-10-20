// ลิงก์ที่ผู้ใช้วางไว้ที่หน้าแรกก่อนล็อกอิน: เก็บใน sessionStorage (อยู่รอดตอน redirect ไป/กลับจาก Google/Microsoft)
// แล้วหน้า dashboard หยิบไปย่อให้อัตโนมัติหลังเข้าสู่ระบบ — ข้อมูลอยู่ในเบราว์เซอร์นี้เท่านั้น ไม่ถูกส่งไปไหนจนกว่าจะล็อกอิน
const KEY = 'surl:pending-url';

export function setPendingUrl(url: string) {
  try {
    sessionStorage.setItem(KEY, url);
  } catch {
    /* เบราว์เซอร์ปิดการใช้ storage: ผู้ใช้ต้องวางใหม่ที่ dashboard */
  }
}

/** ดูค่าโดยไม่ลบ (ใช้แสดงบนหน้า login ว่ามีลิงก์รออยู่) */
export function peekPendingUrl(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** อ่านแล้วลบทันที (ใช้ได้ครั้งเดียว) */
export function takePendingUrl(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    if (v) sessionStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}
