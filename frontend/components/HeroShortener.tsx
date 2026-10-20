'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth';
import { LinkBar } from './LinkBar';
import { useI18n } from '@/lib/i18n';
import { setPendingUrl } from '@/lib/pending';

// ช่องวางลิงก์บนหน้าแรก: จำลิงก์ไว้แล้วพาไปล็อกอิน (ถ้ายังไม่ล็อกอิน) หรือไป dashboard ที่ย่อให้ทันที
export function HeroShortener() {
  const router = useRouter();
  const { status } = useAuth();
  const { t } = useI18n();
  const [url, setUrl] = useState('');
  const [hint, setHint] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const v = url.trim();
    if (!v) {
      setHint(true);
      return;
    }
    setPendingUrl(v);
    router.push(status === 'authed' ? '/dashboard' : '/login');
  };

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto w-full max-w-2xl" aria-label={t('hero.aria')}>
      <LinkBar
        size="lg"
        value={url}
        onChange={(v) => {
          setUrl(v);
          setHint(false);
        }}
        placeholder={t('hero.placeholder')}
        label={t('hero.label')}
        submit={t('hero.submit')}
        invalid={hint}
        describedBy={hint ? 'hero-hint' : undefined}
      />
      {hint && (
        <p id="hero-hint" role="alert" className="mt-2 text-left text-sm font-medium text-danger">
          {t('hero.empty')}
        </p>
      )}
      <p className="mt-3 text-sm text-muted">{status === 'authed' ? t('hero.noteAuthed') : t('hero.noteAnon')}</p>
    </form>
  );
}
