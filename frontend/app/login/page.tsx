'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { Header } from '@/components/Header';
import { HeroDecor } from '@/components/HeroDecor';
import { GoogleIcon, MailIcon, MicrosoftIcon } from '@/components/icons';
import { api, API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { peekPendingUrl } from '@/lib/pending';
import { translateServerMessage } from '@/lib/serverMessages';
import type { Provider } from '@/lib/types';

const PROVIDER_ICON = { google: GoogleIcon, microsoft: MicrosoftIcon } as const;

function LoginPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, loginWithPassword } = useAuth();
  const { t, lang } = useI18n();
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const ssoError = params.get('sso_error');
  const [error, setError] = useState<string | null>(ssoError);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authed') router.replace('/dashboard');
  }, [status, router]);

  useEffect(() => {
    setPending(peekPendingUrl());
    api<Provider[]>('/api/auth/sso/providers', { auth: false })
      .then(setProviders)
      .catch(() => setProviders([]));
  }, []);

  // ไม่มี Google/Microsoft ให้ใช้ → แสดงฟอร์มอีเมลเลย ไม่ต้องกดเลือกก่อน
  const noProviders = providers !== null && providers.length === 0;
  const emailOpen = showEmail || noProviders;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await loginWithPassword(email.trim(), password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.failed'));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      {pending && (
        <p className="mb-5 rounded-xl border border-line bg-surface px-4 py-3 text-left text-sm shadow-sm">
          <span className="text-muted">{t('login.pending')}</span>
          <span className="mt-0.5 block truncate font-mono font-medium" title={pending}>
            {pending}
          </span>
        </p>
      )}

      {error && (
        <p role="alert" className="mb-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-left text-sm font-medium text-danger">
          {error === ssoError && ssoError ? translateServerMessage(ssoError, lang) : error}
        </p>
      )}

      {!emailOpen && (
        <div className="flex flex-col gap-3">
          {providers === null && <p className="py-4 text-sm text-muted">{t('common.loading')}</p>}
          {providers?.map((p) => {
            const Icon = PROVIDER_ICON[p.id];
            return (
              <a key={p.id} href={`${API_URL}/api/auth/sso/${p.id}/start`} className="btn-provider">
                <Icon />
                {t('login.with', { name: p.label })}
              </a>
            );
          })}
          {providers !== null && providers.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-muted" aria-hidden="true">
              <span className="h-px flex-1 bg-line" />
              {t('login.or')}
              <span className="h-px flex-1 bg-line" />
            </div>
          )}
          {providers !== null && (
            <button type="button" onClick={() => setShowEmail(true)} className="btn-provider">
              <MailIcon />
              {t('login.withEmail')}
            </button>
          )}
        </div>
      )}

      {emailOpen && (
        <form onSubmit={onSubmit} className="flex flex-col gap-4 text-left">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t('login.email')}
            <input className="field h-14 rounded-xl px-5 shadow-sm" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t('login.password')}
            <input className="field h-14 rounded-xl px-5 shadow-sm" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="submit" className="btn-primary h-14 rounded-xl text-base" disabled={busy}>
            {busy ? t('login.submitting') : t('login.submit')}
          </button>
          {!noProviders && (
            <button type="button" onClick={() => setShowEmail(false)} className="self-center text-sm font-medium text-muted underline underline-offset-4 hover:text-ink">
              {t('login.other')}
            </button>
          )}
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  const { t } = useI18n();
  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8">
        {/* ธีมเดียวกับหน้าแรก: พื้นลายจุด ไม่มีกรอบ การ์ดลอยชุดเดียวกัน */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 [background-image:radial-gradient(rgb(var(--ink)/0.14)_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_72%)]"
          />
          <HeroDecor />

          <div className="relative z-10 px-5 py-16 text-center sm:py-20 lg:pb-40 lg:pt-24">
            <h1 className="text-[2.25rem] font-bold leading-[1.18] tracking-tight sm:text-5xl sm:leading-[1.12]">
              <span className="block">{t('login.h1a')}</span>
              <span className="block">{t('login.h1b')}</span>
            </h1>
            <p className="mx-auto mb-9 mt-5 max-w-md text-lg leading-relaxed text-muted">{t('login.sub')}</p>

            <Suspense fallback={null}>
              <LoginPanel />
            </Suspense>

            <Link href="/" className="mt-8 inline-block text-sm font-medium text-muted underline underline-offset-4 hover:text-ink">
              {t('login.back')}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
