'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { setPendingUrl } from '@/lib/pending';
import { AdminIcon, type AdminIconName } from './Icon';
import { LinkBar } from './LinkBar';
import { useLoginModal } from './LoginModal';
import { useToast } from './Toast';

// สิ่งที่ได้เพิ่มเมื่อเข้าสู่ระบบ (แสดงใต้ผลลัพธ์ของผู้ใช้ที่ยังไม่ล็อกอิน)
const PERKS: Array<{ key: 'hero.guest.p1' | 'hero.guest.p2' | 'hero.guest.p3' | 'hero.guest.p4' | 'hero.guest.p5' | 'hero.guest.p6'; icon: AdminIconName }> = [
  { key: 'hero.guest.p1', icon: 'qr' },
  { key: 'hero.guest.p2', icon: 'clicks' },
  { key: 'hero.guest.p3', icon: 'mylinks' },
  { key: 'hero.guest.p4', icon: 'edit' },
  { key: 'hero.guest.p5', icon: 'calendar' },
  { key: 'hero.guest.p6', icon: 'lock' },
];

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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

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
      setCopied(true);
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
        <div className="mt-5 overflow-hidden rounded-3xl bg-surface text-left shadow-[0_10px_34px_rgba(0,0,0,0.08)] ring-1 ring-line" role="status">
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted">{t('hero.guest.done')}</p>
              <span className="rounded-full bg-ink/[0.07] px-2.5 py-0.5 text-xs font-semibold">{t('hero.guest.valid')}</span>
            </div>
            <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-ink/[0.05] p-2 sm:flex-row sm:items-center sm:py-2 sm:pl-4 sm:pr-2">
              <a href={guestResult} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 break-all px-2 pt-1 font-mono text-[15px] font-semibold leading-snug text-accent hover:underline sm:p-0 sm:text-lg">
                {guestResult}
              </a>
              <button type="button" onClick={copy} className="btn-ink h-10 shrink-0 gap-1.5 rounded-xl px-4 max-sm:w-full">
                <AdminIcon name={copied ? 'check' : 'copy'} className="h-4 w-4" />
                {t('hero.guest.copy')}
              </button>
            </div>
          </div>

          <div className="border-t border-line bg-accent/[0.06] p-5 sm:p-6">
            <p className="text-[15px] font-bold">{t('hero.guest.upsellTitle')}</p>
            <ul className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2">
              {PERKS.map((p) => (
                <li key={p.key} className="flex items-center gap-3 text-sm font-medium">
                  <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                    <AdminIcon name={p.icon} className="h-4 w-4" />
                  </span>
                  {t(p.key)}
                </li>
              ))}
            </ul>
            <button type="button" onClick={goLogin} className="btn-primary mt-5 w-full rounded-xl py-3 text-[15px]">
              {t('hero.guest.login')}
            </button>
          </div>
        </div>
      )}

      {!guestResult && <p className="mt-3 text-[13px] text-muted">{status === 'authed' ? t('hero.noteAuthed') : t('hero.noteAnon')}</p>}
    </form>
  );
}
