'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
export function HeaderControls({ compact }: { compact?: boolean } = {}) {
  const { lang, setLang, t } = useI18n();
  const { theme, toggle } = useTheme();
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const label = t(next === 'dark' ? 'theme.toDark' : 'theme.toLight');

  // แถบสีฟ้าที่เลื่อนไปอยู่หลังปุ่มภาษาที่เลือก (ปุ่มกว้างไม่เท่ากัน จึงวัดตำแหน่ง/ความกว้างจริง)
  const refs = useRef<Partial<Record<Lang, HTMLButtonElement | null>>>({});
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const [animate, setAnimate] = useState(false);
  useLayoutEffect(() => {
    const el = refs.current[lang];
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
  }, [lang]);
  useEffect(() => {
    // เปิดแอนิเมชันหลังวางตำแหน่งแรกแล้ว กันแถบไหลเข้ามาตอนโหลดหน้า
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // แบบย่อ (แถบข้างที่พับอยู่): ปุ่มภาษาปุ่มเดียวสลับไปอีกภาษา + ปุ่มธีม เรียงลง
  if (compact) {
    const other = lang === 'th' ? LANGS[1] : LANGS[0];
    return (
      <div className="flex flex-col items-center gap-1.5">
        <button type="button" onClick={() => setLang(other.id)} lang={other.id} title={other.full} aria-label={other.full} className="flex h-9 w-11 items-center justify-center rounded-xl bg-ink/[0.05] text-xs font-bold text-ink/80 transition-colors hover:bg-ink/[0.09]">
          {other.label}
        </button>
        <button type="button" onClick={toggle} className="flex h-9 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink" title={label} aria-label={label}>
          <ThemeIcon to={next} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div role="group" aria-label={t('lang.label')} className="relative flex items-center gap-1 text-sm font-medium">
        {pill && (
          <span
            aria-hidden="true"
            className={`absolute inset-y-0 rounded-md bg-accent ${animate ? 'transition-[left,width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none' : ''}`}
            style={{ left: pill.left, width: pill.width }}
          />
        )}
        {LANGS.map((l) => (
          <button
            key={l.id}
            ref={(el) => {
              refs.current[l.id] = el;
            }}
            type="button"
            onClick={() => setLang(l.id)}
            aria-pressed={lang === l.id}
            lang={l.id}
            title={l.full}
            className={`relative rounded-md px-2.5 py-1.5 transition-colors duration-300 ${lang === l.id ? 'text-on-accent' : 'text-muted hover:text-ink'}`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <button type="button" onClick={toggle} className="rounded-md p-2 text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink" title={label} aria-label={label}>
        <ThemeIcon to={next} />
      </button>
    </div>
  );
}
