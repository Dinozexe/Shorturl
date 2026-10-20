'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

const ToastContext = createContext<(message: string) => void>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const toast = useCallback((m: string) => {
    setMessage(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), 2400);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* aria-live ให้โปรแกรมอ่านหน้าจอประกาศข้อความโดยไม่ย้ายโฟกัส */}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
        {message && <p className="rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-paper shadow-lg">{message}</p>}
      </div>
    </ToastContext.Provider>
  );
}
