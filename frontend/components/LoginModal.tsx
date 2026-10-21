'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { api, API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { peekPendingUrl } from '@/lib/pending';
import { translateServerMessage } from '@/lib/serverMessages';
import type { Provider } from '@/lib/types';
import { GoogleIcon, MailIcon } from './icons';

// หน้าต่างนี้แสดงเฉพาะ Google (backend ยังรองรับ Microsoft แต่ไม่เปิดปุ่มในหน้าเว็บ)
const SSO = [{ id: 'google', label: 'Google' }] as const;
const PROVIDER_ICON = { google: GoogleIcon } as const;

interface LoginModalApi {
  openLogin: () => void;
}

const LoginModalContext = createContext<LoginModalApi>({ openLogin: () => {} });
export const useLoginModal = () => useContext(LoginModalContext);

// หน้าต่างเข้าสู่ระบบ: เปิดทับหน้าปัจจุบันโดยไม่เปลี่ยนหน้า
// ผู้ให้บริการ SSO เด้งกลับมาที่ /login?sso_error=... เมื่อล้มเหลว → หน้านั้นเปิดหน้าต่างนี้พร้อมข้อความผิดพลาด
export function LoginModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status, loginWithPassword } = useAuth();
  const { t, lang } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const openLogin = useCallback(() => {
    setError(null);
    setPending(peekPendingUrl());
    setOpen(true);
  }, []);

  // ค่าที่ส่งกลับมากับ URL จากการเข้าสู่ระบบด้วย SSO ที่ล้มเหลว
  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get('sso_error');
    if (e) {
      setSsoError(e);
      openLogin();
    }
  }, [openLogin]);

  useEffect(() => {
    if (!open || providers) return;
    api<Provider[]>('/api/auth/sso/providers', { auth: false })
      .then(setProviders)
      .catch(() => setProviders([]));
  }, [open, providers]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.querySelector<HTMLInputElement>('input[type=email]')?.focus(); // ไม่ให้ปุ่มปิดได้โฟกัสก่อน
    }
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (status === 'authed' && open) setOpen(false);
  }, [status, open]);

  const close = () => {
    setOpen(false);
    setBusy(false);
    setPassword('');
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = await loginWithPassword(email.trim(), password);
      setOpen(false);
      setPassword('');
      // ผู้ดูแลระบบเข้าหน้าแอดมินเลย (ยกเว้นมีลิงก์ที่วางค้างไว้ต้องย่อก่อน จึงไปหน้ารายการลิงก์)
      router.replace(u.role !== 'USER' && !peekPendingUrl() ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.failed'));
    } finally {
      setBusy(false);
    }
  };

  const shownError = error ?? (ssoError ? translateServerMessage(ssoError, lang) : null);
  const input = 'h-12 w-full rounded-xl bg-ink/[0.05] pl-11 pr-4 text-ink outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-accent';

  return (
    <LoginModalContext.Provider value={{ openLogin }}>
      {children}
      <dialog
        ref={ref}
        onClose={() => {
          setOpen(false);
          setSsoError(null);
        }}
        onClick={(e) => {
          if (e.target === ref.current) close();
        }}
        aria-labelledby="login-title"
        className="m-auto w-[calc(100%-1.5rem)] max-w-[26rem] rounded-3xl bg-surface p-0 text-ink shadow-2xl"
      >
        {open && (
          <div className="relative px-6 pb-8 pt-9 sm:px-9">
            <button type="button" onClick={close} aria-label={t('common.closeDialog')} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink/[0.07] hover:text-ink">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>

            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-32 rounded-t-3xl bg-gradient-to-b from-accent/15 to-transparent" />
            <h2 id="login-title" className="relative text-center text-2xl font-bold tracking-tight">
              {t('login.modal.title')}
            </h2>
            <p className="relative mt-1.5 text-center text-sm text-muted">{t('login.modal.sub')}</p>

            {pending && (
              <p className="mt-5 rounded-xl bg-accent/10 px-4 py-3 text-left text-sm">
                <span className="text-muted">{t('login.pending')}</span>
                <span className="mt-0.5 block max-h-24 overflow-y-auto break-all font-mono text-[13px] font-medium leading-snug" title={pending}>
                  {pending}
                </span>
              </p>
            )}

            {shownError && (
              <p role="alert" className="mt-5 rounded-xl bg-danger/10 px-4 py-3 text-left text-sm font-medium text-danger">
                {shownError}
              </p>
            )}

            <form onSubmit={onSubmit} className="relative mt-6 flex flex-col gap-3">
              <label className="relative block">
                <span className="sr-only">{t('login.email')}</span>
                <MailIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
                <input className={input} type="email" autoComplete="username" autoFocus required placeholder={t('login.email')} value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="relative block">
                <span className="sr-only">{t('login.password')}</span>
                <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
                  <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
                </svg>
                <input className={input} type="password" autoComplete="current-password" required placeholder={t('login.password')} value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              <button type="submit" className="btn-primary mt-1 h-12 rounded-xl text-base" disabled={busy}>
                {busy ? t('login.submitting') : t('login.submit')}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs text-muted" aria-hidden="true">
              <span className="h-px flex-1 bg-line" />
              {t('login.modal.or')}
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="flex flex-col gap-3">
              {SSO.map((p) => {
                const Icon = PROVIDER_ICON[p.id];
                const enabled = providers?.some((x) => x.id === p.id);
                const cls = 'flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-surface text-sm font-semibold shadow-sm ring-1 ring-line transition-all hover:-translate-y-px hover:shadow-md hover:ring-ink/30';
                return enabled ? (
                  <a key={p.id} href={`${API_URL}/api/auth/sso/${p.id}/start`} aria-label={t('login.with', { name: p.label })} className={cls}>
                    <Icon className="h-5 w-5" />
                    {t('login.with', { name: p.label })}
                  </a>
                ) : (
                  <button key={p.id} type="button" onClick={() => setError(t('login.notConfigured', { name: p.label }))} className={cls}>
                    <Icon className="h-5 w-5" />
                    {t('login.with', { name: p.label })}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </dialog>
    </LoginModalContext.Provider>
  );
}
