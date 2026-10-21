'use client';

import { AdminIcon, type AdminIconName } from '@/components/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
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

/** รายการแจกแจง (เช่น ประเทศ/อุปกรณ์) เป็นการ์ด: หัวมีไอคอน, แท่งแนวนอนเทียบสัดส่วน, ไม่มีข้อมูลแสดงสถานะว่างกลางการ์ด */
export function Breakdown({ title, icon, items, label }: { title: string; icon: AdminIconName; items: Bucket[]; label: (key: string | null) => string }) {
  const { t, fmt } = useI18n();
  const max = Math.max(1, ...items.map((i) => i.clicks));
  const total = items.reduce((s, i) => s + i.clicks, 0) || 1;
  return (
    <section className="flex flex-col rounded-2xl border border-line p-4" aria-label={title}>
      <h3 className="flex items-center gap-2.5 text-sm font-bold">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <AdminIcon name={icon} className="h-4 w-4" />
        </span>
        {title}
      </h3>
      {items.length === 0 ? (
        <EmptyState compact icon="inbox" title={t('stats.noData')} className="flex-1 justify-center" />
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {items.map((i) => (
            <li key={i.key ?? '∅'} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-medium" title={label(i.key)}>
                  {label(i.key)}
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold">{fmt.number(i.clicks)}</span>
                  <span className="ml-1.5 text-xs text-muted">{Math.round((i.clicks / total) * 100)}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-ink/[0.07]" aria-hidden="true">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(i.clicks / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
