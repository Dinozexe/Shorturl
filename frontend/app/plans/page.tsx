'use client';

import Link from 'next/link';
import { Header } from '@/components/Header';
import { useLoginModal } from '@/components/LoginModal';
import { useAuth } from '@/lib/auth';
import { useI18n, type MsgKey } from '@/lib/i18n';

const FEATURES: { key: MsgKey; guest: boolean }[] = [
  { key: 'plans.f.short', guest: true },
  { key: 'plans.f.open', guest: true },
  { key: 'plans.f.noexp', guest: false },
  { key: 'plans.f.alias', guest: false },
  { key: 'plans.f.qr', guest: false },
  { key: 'plans.f.stats', guest: false },
  { key: 'plans.f.history', guest: false },
];

function Mark({ yes }: { yes: boolean }) {
  return yes ? (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
    </span>
  ) : (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink/[0.07] text-muted">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
        <path d="M6 12h12" />
      </svg>
    </span>
  );
}

export default function PlansPage() {
  const { t } = useI18n();
  const { status } = useAuth();
  const authed = status === 'authed';
  const { openLogin } = useLoginModal();

  const cards = [
    { id: 'guest', name: t('plans.guest.name'), price: t('plans.guest.price'), body: t('plans.guest.body'), current: status === 'anon', member: false },
    { id: 'free', name: t('plans.free.name'), price: t('plans.free.price'), body: t('plans.free.body'), current: authed, member: true },
  ];

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-4 pb-12 pt-6 sm:px-6 sm:pt-10">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight sm:text-4xl">{t('plans.page.title')}</h1>
          <p className="mt-3 text-base leading-relaxed text-muted">{t('plans.page.sub')}</p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {cards.map((c) => (
            <section key={c.id} className={`flex flex-col rounded-3xl p-7 ${c.member ? 'bg-accent/[0.08] ring-1 ring-accent/30' : 'bg-ink/[0.04]'}`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold">{c.name}</h2>
                {c.current && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-on-accent">{t('plans.active')}</span>}
              </div>
              <p className="mt-1 text-sm font-semibold text-accent">{c.price}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{c.body}</p>

              <ul className="mt-5 space-y-3 text-[15px]">
                {FEATURES.map((f) => {
                  const yes = c.member || f.guest;
                  return (
                    <li key={f.key} className={`flex gap-3 ${yes ? '' : 'text-muted line-through decoration-muted/50'}`}>
                      <Mark yes={yes} />
                      <span>{t(f.key)}</span>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-auto pt-7">
                {c.member ? (
                  authed ? (
                    <Link href="/dashboard" className="btn-primary w-full">
                      {t('plans.free.ctaAuthed')}
                    </Link>
                  ) : (
                    <button type="button" onClick={openLogin} className="btn-primary w-full">
                      {t('plans.free.cta')}
                    </button>
                  )
                ) : (
                  <Link href="/" className="btn w-full">
                    {t('features.cta')}
                  </Link>
                )}
              </div>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
