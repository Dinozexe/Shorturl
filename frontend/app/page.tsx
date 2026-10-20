'use client';

import { Header } from '@/components/Header';
import { HeroDecor } from '@/components/HeroDecor';
import { HeroShortener } from '@/components/HeroShortener';
import { useI18n } from '@/lib/i18n';

const PERKS = ['home.perk1', 'home.perk2', 'home.perk3'] as const;
const FACTS = [1, 2, 3] as const;

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden="true">
      <circle cx="10" cy="10" r="10" className="fill-ink" />
      <path d="m6 10.5 2.6 2.6L14 7.8" fill="none" className="stroke-paper" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

          <div className="relative z-10 px-5 py-16 text-center sm:py-24 lg:pb-48 lg:pt-28">
            <h1 className="text-[2.5rem] font-bold leading-[1.18] tracking-tight sm:text-6xl sm:leading-[1.12]">
              <span className="block">{t('home.h1a')}</span>
              <span className="block">{t('home.h1b')}</span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">{t('home.sub')}</p>

            <div className="mt-9">
              <HeroShortener />
            </div>

            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium">
              {PERKS.map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <Check />
                  {t(k)}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <dl className="card mt-8 grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {FACTS.map((n) => (
            <div key={n} className="p-5 sm:p-6">
              <dt className="font-bold">{t(`home.fact${n}.title` as 'home.fact1.title')}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">{t(`home.fact${n}.body` as 'home.fact1.body')}</dd>
            </div>
          ))}
        </dl>
      </main>
    </>
  );
}
