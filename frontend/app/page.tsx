'use client';

import type { CSSProperties } from 'react';
import { Header } from '@/components/Header';
import { HeroDecor, HeroDemo } from '@/components/HeroDecor';
import { HeroShortener } from '@/components/HeroShortener';
import { useI18n } from '@/lib/i18n';

const PERKS = ['home.perk1', 'home.perk2', 'home.perk3'] as const;

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden="true">
      <circle cx="10" cy="10" r="10" className="fill-accent" />
      <path d="m6 10.5 2.6 2.6L14 7.8" fill="none" className="stroke-on-accent" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function HomePage() {
  const { t } = useI18n();
  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8">
        {/* พื้นลายจุด (ไม่มีกรอบ): ช่องวางลิงก์อยู่กลางหน้าตั้งแต่เข้ามา */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 [background-image:radial-gradient(rgb(var(--ink)/0.14)_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_72%)]"
          />
          <HeroDecor />

          <div className="relative z-10 px-5 py-14 text-center sm:py-20 lg:pb-52 lg:pt-32">
            <h1 className="text-[1.875rem] font-bold leading-[1.22] tracking-tight sm:text-[2.75rem] sm:leading-[1.15]">
              <span className="rise block">{t('home.h1a')}</span>
              <span className="rise block" style={{ '--d': '0.12s' } as CSSProperties}>{t('home.h1b')}</span>
            </h1>

            <p className="rise mx-auto mt-5 max-w-md text-base leading-relaxed text-muted" style={{ '--d': '0.26s' } as CSSProperties}>{t('home.sub')}</p>

            <div className="rise mt-7" style={{ '--d': '0.4s' } as CSSProperties}>
              <HeroShortener />
            </div>

            <ul className="rise mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] font-medium" style={{ '--d': '0.55s' } as CSSProperties}>
              {PERKS.map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <Check />
                  {t(k)}
                </li>
              ))}
            </ul>

            <HeroDemo />
          </div>
        </section>
      </main>
    </>
  );
}
