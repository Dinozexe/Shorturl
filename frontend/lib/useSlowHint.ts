'use client';

import { useEffect, useState } from 'react';

/** true เมื่อ `active` ค้างอยู่เกิน delayMs (เช่น รอเซิร์ฟเวอร์ที่กำลังตื่น) — ใช้แสดงข้อความ "เซิร์ฟเวอร์กำลังเริ่มทำงาน" เฉพาะตอนช้าจริง */
export function useSlowHint(active: boolean, delayMs = 4000): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) {
      setSlow(false);
      return;
    }
    const id = setTimeout(() => setSlow(true), delayMs);
    return () => clearTimeout(id);
  }, [active, delayMs]);
  return slow;
}
