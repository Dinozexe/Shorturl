'use client';

import { useI18n, type Lang } from '@/lib/i18n';
import { useTheme, type Theme } from '@/lib/theme';

const LANGS: Array<{ id: Lang; label: string; full: string }> = [
  { id: 'th', label: 'ไทย', full: 'ภาษาไทย' },
  { id: 'en', label: 'EN', full: 'English' },
];

// แสดงไอคอนของโหมดที่ "จะสลับไป": โหมดสว่างแสดงพระจันทร์ โหมดมืดแสดงดวงอาทิตย์
function ThemeIcon({ to }: { to: Theme }) {
  const common = { viewBox: '0 0 24 24', className: 'h-[18px] w-[18px]', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (to === 'light')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
    </svg>
  );
}

// สลับภาษา (ไทย/EN) และธีม (สว่าง ⇄ มืด) — ค่าที่เลือกถูกจำไว้ในเบราว์เซอร์
export function HeaderControls() {
  const { lang, setLang, t } = useI18n();
  const { theme, toggle } = useTheme();
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const label = t(next === 'dark' ? 'theme.toDark' : 'theme.toLight');

  return (
    <div className="flex items-center gap-2">
      <div role="group" aria-label={t('lang.label')} className="flex items-center gap-1 text-sm font-medium">
        {LANGS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setLang(l.id)}
            aria-pressed={lang === l.id}
            lang={l.id}
            title={l.full}
            className={`rounded-full px-2.5 py-1.5 transition-colors ${lang === l.id ? 'bg-ink text-paper' : 'text-muted hover:bg-ink/[0.06] hover:text-ink'}`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <button type="button" onClick={toggle} className="rounded-full p-2 text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink" title={label} aria-label={label}>
        <ThemeIcon to={next} />
      </button>
    </div>
  );
}
