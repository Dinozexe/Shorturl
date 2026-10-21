'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loginWithPassword, logoutRequest, refreshWithWake, SESSION_LOST_EVENT, warmUp } from './api';
import type { AuthUser } from './types';

// offline = ติดต่อเซิร์ฟเวอร์ไม่ได้แม้รอจนหมดเวลา (ไม่ใช่ "ยังไม่ได้ล็อกอิน": ผู้ใช้อาจยังล็อกอินอยู่ ให้กดลองใหม่)
type Status = 'loading' | 'authed' | 'anon' | 'offline';

interface AuthState {
  status: Status;
  user: AuthUser | null;
  loginWithPassword: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** ลองตรวจ session ใหม่ (ใช้กับสถานะ offline) */
  retry: () => void;
  /** true เมื่อผู้ใช้กดออกจากระบบเอง (ต่างจาก session หมดอายุ) — guard ของหน้าต่างๆ ไม่ควรพาไป /login ทับ */
  signedOut: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [signedOut, setSignedOut] = useState(false);

  // เปิดหน้า/รีเฟรช: ขอ access token ใหม่จาก refresh cookie (single-flight ใน lib/api)
  // เซิร์ฟเวอร์ฟรีอาจหลับ: ติดต่อไม่ได้ → รอจนตื่นแล้วลองใหม่ (ระหว่างนี้ status ยังเป็น loading) ไม่ถือว่า "ยังไม่ล็อกอิน"
  const check = useCallback((isAlive: () => boolean) => {
    warmUp(); // ปลุก API ไว้ก่อนแม้เป็นผู้เยี่ยมชมหน้าแรก (ผู้ใช้มักย่อลิงก์ต่อทันที)
    refreshWithWake().then((r) => {
      if (!isAlive()) return;
      if (r.kind === 'ok') {
        setUser(r.user);
        setStatus('authed');
      } else if (r.kind === 'anon') {
        setUser(null);
        setStatus('anon');
      } else {
        setUser(null);
        setStatus('offline');
      }
    });
  }, []);

  useEffect(() => {
    let alive = true;
    check(() => alive);
    return () => {
      alive = false;
    };
  }, [check]);

  const retry = useCallback(() => {
    setStatus('loading');
    check(() => true);
  }, [check]);

  // API ตอบ 401 แล้ว refresh ไม่ได้ = session หมด
  useEffect(() => {
    const onLost = () => {
      setUser(null);
      setStatus('anon');
    };
    window.addEventListener(SESSION_LOST_EVENT, onLost);
    return () => window.removeEventListener(SESSION_LOST_EVENT, onLost);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await loginWithPassword(email, password);
    setUser(u);
    setSignedOut(false);
    setStatus('authed');
    return u;
  }, []);

  const logout = useCallback(async () => {
    setSignedOut(true);
    await logoutRequest();
    setUser(null);
    setStatus('anon');
  }, []);

  const value = useMemo(() => ({ status, user, loginWithPassword: login, logout, retry, signedOut }), [status, user, login, logout, retry, signedOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth ต้องอยู่ใน AuthProvider');
  return ctx;
}
