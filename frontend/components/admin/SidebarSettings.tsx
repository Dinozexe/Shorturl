'use client';

import { useI18n, type Lang } from '@/lib/i18n';
import { useTheme, type Theme } from '@/lib/theme';

const LANGS: Array<{ id: Lang; label: string; full: string }> = [
  { id: 'th', label: 'ไทย', full: 'ภาษาไทย' },
  { id: 'en', label: 'EN', full: 'English' },
];

const sun = (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
  </svg>
);
const moon = (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
  </svg>
);

/** กลุ่มปุ่มเลือก 2 ช่อง มีแผ่นขาวเลื่อนไปอยู่หลังตัวที่เลือก (radiogroup) */
function Segmented<T extends string>({ label, value, options, onChange, className = '' }: { label: string; value: T; options: Array<{ id: T; content: React.ReactNode; title: string }>; onChange: (v: T) => void; className?: string }) {
  const idx = Math.max(0, options.findIndex((o) => o.id === value));
  return (
    <div role="radiogroup" aria-label={label} className={`relative grid grid-cols-2 rounded-xl bg-ink/[0.06] p-1 ${className}`}>
      <span aria-hidden="true" className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-surface shadow-sm ring-1 ring-line/60 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none" style={{ transform: `translateX(${idx * 100}%)` }} />
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          aria-label={o.title}
          title={o.title}
          onClick={() => onChange(o.id)}
          className={`relative z-10 flex h-8 items-center justify-center rounded-lg text-[13px] font-semibold transition-colors duration-300 focus-visible:outline-accent ${o.id === value ? 'text-ink' : 'text-muted hover:text-ink'}`}
        >
          {o.content}
        </button>
      ))}
    </div>
  );
}

// ตัวสลับภาษา + ธีมในแถบข้าง (แบบกว้าง): สองกลุ่มเลือกได้เห็นสถานะปัจจุบันตลอด ไม่ต้องกดเดา
export function SidebarSettings() {
  const { lang, setLang, t } = useI18n();
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center gap-2">
      <Segmented<Lang> label={t('lang.label')} value={lang} onChange={setLang} className="flex-1" options={LANGS.map((l) => ({ id: l.id, content: <span lang={l.id}>{l.label}</span>, title: l.full }))} />
      <Segmented<Theme>
        label={t('theme.label')}
        value={theme}
        onChange={setTheme}
        className="w-[5.25rem]"
        options={[
          { id: 'light', content: sun, title: t('theme.toLight') },
          { id: 'dark', content: moon, title: t('theme.toDark') },
        ]}
      />
    </div>
  );
}
