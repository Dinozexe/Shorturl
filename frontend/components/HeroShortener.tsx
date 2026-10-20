'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { setPendingUrl } from '@/lib/pending';
import { LinkBar } from './LinkBar';
import { useLoginModal } from './LoginModal';
import { useToast } from './Toast';

// ช่องวางลิงก์บนหน้าแรก
// - ล็อกอินแล้ว: ไป dashboard ย่อให้ทันที (ได้ครบทุกอย่าง)
// - ยังไม่ล็อกอิน: ย่อได้เลยแต่ได้แค่ลิงก์สั้น (ไม่มี QR/สถิติ/ประวัติ, หมดอายุ 7 วัน) แล้วชวนเข้าสู่ระบบ
export function HeroShortener() {
  const router = useRouter();
  const { status } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const { openLogin } = useLoginModal();
  const [url, setUrl] = useState('');
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [guestResult, setGuestResult] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const v = url.trim();
    if (!v) {
      setHint(true);
      return;
    }
    if (status === 'authed') {
      setPendingUrl(v);
      router.push('/dashboard');
      return;
    }
    setBusy(true);
    setError('');
    setGuestResult('');
    try {
      const r = await api<{ shortUrl: string }>('/api/guest/links', { method: 'POST', body: { url: v }, auth: false });
      setGuestResult(r.shortUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(guestResult);
      toast(t('hero.guest.copied'));
    } catch {
      toast(t('common.copyFailedManual'));
    }
  };

  const goLogin = () => {
    setPendingUrl(url.trim());
    openLogin();
  };

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto w-full max-w-lg" aria-label={t('hero.aria')}>
      <LinkBar
        value={url}
        onChange={(v) => {
          setUrl(v);
          setHint(false);
          setError('');
        }}
        placeholder={t('hero.placeholder')}
        label={t('hero.label')}
        submit={t('hero.submit')}
        invalid={hint || !!error}
        describedBy={hint ? 'hero-hint' : error ? 'hero-error' : undefined}
        disabled={busy}
      />
      {hint && (
        <p id="hero-hint" role="alert" className="mt-2 text-left text-sm font-medium text-danger">
          {t('hero.empty')}
        </p>
      )}
      {error && (
        <p id="hero-error" role="alert" className="mt-2 text-left text-sm font-medium text-danger">
          {error}
        </p>
      )}

      {guestResult && (
        <div className="mt-5 overflow-hidden rounded-2xl bg-surface text-left shadow-[0_10px_34px_rgba(0,0,0,0.08)] ring-1 ring-line" role="status">
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted">{t('hero.guest.done')}</p>
              <span className="rounded-full bg-ink/[0.07] px-2.5 py-0.5 text-xs font-semibold">{t('hero.guest.valid')}</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <a href={guestResult} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-mono text-lg font-semibold text-accent hover:underline sm:text-xl">
                {guestResult}
              </a>
              <button type="button" onClick={copy} className="btn-ink h-10 shrink-0 px-5">
                {t('hero.guest.copy')}
              </button>
            </div>
          </div>

          <div className="bg-accent/[0.07] p-5 sm:p-6">
            <p className="text-sm font-semibold">{t('hero.guest.upsellTitle')}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {(['hero.guest.p1', 'hero.guest.p2', 'hero.guest.p3', 'hero.guest.p4', 'hero.guest.p5'] as const).map((k) => (
                <li key={k} className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[13px] font-medium ring-1 ring-line">
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                    <circle cx="10" cy="10" r="10" className="fill-accent" />
                    <path d="m6 10.5 2.6 2.6L14 7.8" fill="none" className="stroke-on-accent" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t(k)}
                </li>
              ))}
            </ul>
            <button type="button" onClick={goLogin} className="btn-primary mt-4 w-full py-2.5 text-[15px]">
              {t('hero.guest.login')}
            </button>
          </div>
        </div>
      )}

      {!guestResult && <p className="mt-3 text-[13px] text-muted">{status === 'authed' ? t('hero.noteAuthed') : t('hero.noteAnon')}</p>}
    </form>
  );
}
