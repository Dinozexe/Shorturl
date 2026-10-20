'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { Header } from '@/components/Header';
import { useLoginModal } from '@/components/LoginModal';
import { useAuth } from '@/lib/auth';
import { useI18n, type MsgKey } from '@/lib/i18n';

// ภาพประกอบเคลื่อนไหวของแต่ละฟีเจอร์ (ใช้คลาสภาพเคลื่อนไหวจาก globals.css — หยุดเมื่อผู้ใช้ตั้งลดการเคลื่อนไหว)
const vars = (v: Record<string, string>) => v as CSSProperties;
const QR_CELLS = ['0010110', '1101001', '0111010', '1010111', '0101101', '1100010', '0011011'];

function LinkArt() {
  return (
    <div className="w-40 space-y-2.5">
      <div className="decor-line h-2.5 rounded bg-ink/15" style={vars({ '--to': '0.3' })} />
      <div className="decor-line h-2.5 w-4/5 rounded bg-ink/15" style={vars({ '--to': '0.25', '--ld': '0.08s' })} />
      <div className="decor-line h-2.5 w-3/5 rounded bg-accent" style={vars({ '--to': '0.4', '--ld': '0.16s' })} />
    </div>
  );
}

function QrArt() {
  let n = 0;
  return (
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 70 70" width="96" height="96">
        {QR_CELLS.flatMap((row, y) =>
          [...row].map((c, x) => {
            if (c !== '1') return null;
            n += 1;
            return <rect key={`${x}-${y}`} x={x * 10} y={y * 10} width="9" height="9" rx="1.5" className={`fill-ink ${n % 3 === 0 ? 'decor-twinkle' : ''}`} style={vars({ '--i': String(n) })} />;
          }),
        )}
      </svg>
      <span className="decor-scan absolute inset-x-0 top-0 h-0.5 rounded bg-accent" />
    </div>
  );
}

function BarsArt() {
  return (
    <div className="flex h-24 w-40 items-end gap-2">
      {[30, 52, 38, 70, 55, 92, 64].map((h, i) => (
        <div key={i} className={`decor-bar flex-1 rounded-t-[3px] ${i === 5 ? 'bg-accent' : 'bg-ink/15'}`} style={vars({ height: `${h}%`, '--i': String(i) })} />
      ))}
    </div>
  );
}

function SwitchArt() {
  return (
    <div className="relative h-11 w-[4.5rem] rounded-full bg-ink/15">
      <span className="decor-knob-bg absolute inset-0 rounded-full bg-accent" />
      <span className="decor-knob absolute left-1 top-1 h-9 w-9 rounded-full bg-surface shadow-md ring-1 ring-line" />
    </div>
  );
}

function UserArt() {
  return (
    <div className="relative flex h-20 w-20 items-center justify-center">
      <span className="decor-ring absolute inset-0 rounded-full bg-accent/30" />
      <span className="decor-ring absolute inset-0 rounded-full bg-accent/30" style={vars({ animationDelay: '1.4s' })} />
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-accent text-on-accent">
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      </span>
    </div>
  );
}

function ShieldArt() {
  return (
    <div className="relative flex h-20 w-20 items-center justify-center">
      <span className="decor-ring absolute inset-2 rounded-2xl bg-accent/30" />
      <svg viewBox="0 0 24 24" className="relative h-16 w-16 text-accent" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3Z" className="fill-accent/10" />
        <path d="m9 12 2 2 4-4" className="decor-twinkle" style={vars({ '--i': '1' })} />
      </svg>
    </div>
  );
}

const ITEMS: { art: ReactNode }[] = [{ art: <LinkArt /> }, { art: <QrArt /> }, { art: <BarsArt /> }, { art: <SwitchArt /> }, { art: <UserArt /> }, { art: <ShieldArt /> }];

export default function FeaturesPage() {
  const { t } = useI18n();
  const { status } = useAuth();
  const { openLogin } = useLoginModal();
  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-[calc(100svh-8.5rem)] max-w-5xl flex-col justify-center px-4 pb-10 pt-4 sm:px-6 md:min-h-[calc(100svh-4.5rem)]">
        {/* หัวข้ออยู่กลาง คำอธิบายอยู่ใต้หัวข้อ */}
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight sm:text-4xl">{t('features.title')}</h1>
          <p className="mt-2 text-base leading-relaxed text-muted">{t('features.sub')}</p>
        </div>

        <ul className="mt-6 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((it, i) => (
            <li key={i} className="flex flex-col items-center text-center">
              <div aria-hidden="true" className="flex h-20 scale-[0.8] items-center justify-center">
                {it.art}
              </div>
              <h2 className="mt-2 text-lg font-bold">{t(`features.f${i + 1}.title` as MsgKey)}</h2>
              <p className="mt-1 max-w-[18rem] text-sm leading-relaxed text-muted">{t(`features.f${i + 1}.body` as MsgKey)}</p>
            </li>
          ))}
        </ul>

        <div className="mt-7 text-center">
          {status === 'authed' ? (
            <Link href="/dashboard" className="btn-primary px-8">
              {t('features.ctaAuthed')}
            </Link>
          ) : (
            <button type="button" onClick={openLogin} className="btn-primary px-8">
              {t('features.cta')}
            </button>
          )}
        </div>
      </main>
    </>
  );
}
