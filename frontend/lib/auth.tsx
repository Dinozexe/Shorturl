'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loginWithPassword, logoutRequest, refreshSession, SESSION_LOST_EVENT } from './api';
import type { AuthUser } from './types';

type Status = 'loading' | 'authed' | 'anon';

interface AuthState {
  status: Status;
  user: AuthUser | null;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** true เมื่อผู้ใช้กดออกจากระบบเอง (ต่างจาก session หมดอายุ) — guard ของหน้าต่างๆ ไม่ควรพาไป /login ทับ */
  signedOut: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [signedOut, setSignedOut] = useState(false);

  // เปิดหน้า/รีเฟรช: ขอ access token ใหม่จาก refresh cookie (single-flight ใน lib/api)
  useEffect(() => {
    let alive = true;
    refreshSession().then((u) => {
      if (!alive) return;
      setUser(u);
      setStatus(u ? 'authed' : 'anon');
    });
    return () => {
      alive = false;
    };
  }, []);

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
  }, []);

  const logout = useCallback(async () => {
    setSignedOut(true);
    await logoutRequest();
    setUser(null);
    setStatus('anon');
  }, []);

  const value = useMemo(() => ({ status, user, loginWithPassword: login, logout, signedOut }), [status, user, login, logout, signedOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth ต้องอยู่ใน AuthProvider');
  return ctx;
}
