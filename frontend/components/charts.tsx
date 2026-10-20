'use client';

import { useI18n } from '@/lib/i18n';
import type { Bucket, Stats } from '@/lib/types';

/** กราฟแท่งรายวัน (div ล้วน ยืดตามความกว้าง) — อ่านค่าได้จาก title และ aria-label */
export function DailyChart({ daily }: { daily: Stats['daily'] }) {
  const { t, fmt } = useI18n();
  const max = Math.max(1, ...daily.map((d) => d.clicks));
  const total = daily.reduce((s, d) => s + d.clicks, 0);
  const first = daily[0];
  const mid = daily[Math.floor(daily.length / 2)];
  const last = daily[daily.length - 1];

  return (
    <figure>
      <div
        role="img"
        aria-label={t('stats.chartAria', { days: daily.length, total: fmt.number(total), max: fmt.number(max) })}
        className="relative flex h-40 items-end gap-px border-b border-ink/60 pt-5"
      >
        <span className="absolute left-0 top-0 text-xs text-muted">{fmt.number(max)}</span>
        {daily.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end" title={t('stats.barTitle', { d: fmt.day(d.day), n: fmt.number(d.clicks) })}>
            <div className={`w-full rounded-t-[2px] ${d.clicks > 0 ? 'bg-accent' : 'bg-line'}`} style={{ height: d.clicks > 0 ? `${Math.max(4, (d.clicks / max) * 100)}%` : '2px' }} />
          </div>
        ))}
      </div>
      <figcaption className="mt-1.5 flex justify-between text-xs text-muted">
        <span>{fmt.day(first.day)}</span>
        <span>{fmt.day(mid.day)}</span>
        <span>{fmt.day(last.day)}</span>
      </figcaption>
    </figure>
  );
}

/** รายการแจกแจง (เช่น ประเทศ/อุปกรณ์) เป็นแท่งแนวนอนเทียบสัดส่วน */
export function Breakdown({ title, items, label }: { title: string; items: Bucket[]; label: (key: string | null) => string }) {
  const { t, fmt } = useI18n();
  const max = Math.max(1, ...items.map((i) => i.clicks));
  return (
    <section>
      <h3 className="mb-2 text-sm font-bold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{t('stats.noData')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((i) => (
            <li key={i.key ?? '∅'} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate" title={label(i.key)}>
                  {label(i.key)}
                </span>
                <span className="font-semibold tabular-nums">{fmt.number(i.clicks)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-line" aria-hidden="true">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(i.clicks / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
