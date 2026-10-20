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
        <div className="card mt-4 p-4 text-left" role="status">
          <p className="text-xs font-medium text-muted">{t('hero.guest.done')}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <a href={guestResult} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-mono text-base font-semibold text-accent hover:underline">
              {guestResult}
            </a>
            <button type="button" onClick={copy} className="btn-ink shrink-0">
              {t('hero.guest.copy')}
            </button>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">{t('hero.guest.upsell')}</p>
          <button type="button" onClick={goLogin} className="btn mt-3">
            {t('hero.guest.login')}
          </button>
        </div>
      )}

      {!guestResult && <p className="mt-3 text-[13px] text-muted">{status === 'authed' ? t('hero.noteAuthed') : t('hero.noteAnon')}</p>}
    </form>
  );
}
