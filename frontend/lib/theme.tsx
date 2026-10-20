'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'surl:theme';

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

// มีแค่สว่าง/มืด: ครั้งแรกที่เข้า (ยังไม่เคยเลือก) เริ่มตามค่าของเครื่อง แต่หลังจากนั้นเป็นค่าที่ผู้ใช้เลือกเอง
// ค่าเริ่มต้นตั้งก่อนวาดหน้าด้วยสคริปต์ใน <head> (ดู layout.tsx) กันหน้ากะพริบ; provider นี้ดูแลการสลับและจำค่า
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    setThemeState(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* ไม่จำค่าข้ามรอบ */
    }
  }, []);

  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme ต้องอยู่ใน ThemeProvider');
  return ctx;
}
