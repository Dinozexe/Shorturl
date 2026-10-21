'use client';

import { AdminIcon, type AdminIconName } from '@/components/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { useI18n } from '@/lib/i18n';
import type { Bucket, Stats } from '@/lib/types';

/** แกนตั้ง: ค่าน้อยแสดงทุกจำนวนเต็ม (0,1,2…) ค่ามากแสดง 0 · กลาง · สูงสุด — ไม่มีเลขทศนิยม */
function ticksOf(max: number): number[] {
  if (max <= 4) return Array.from({ length: max + 1 }, (_, i) => i);
  return [0, Math.round(max / 2), max];
}

/** กราฟแท่งรายวัน (div ล้วน ยืดตามความกว้าง): เส้นไกด์จาง + ค่าบนแกน, แท่งมนไล่เฉด, วันที่ไม่มีคนเปิดเป็นช่องว่างจางๆ ไม่ใช่ขีด, ชี้เมาส์/โฟกัสเห็นป้ายค่าของวันนั้น */
export function DailyChart({ daily }: { daily: Stats['daily'] }) {
  const { t, fmt } = useI18n();
  const max = Math.max(1, ...daily.map((d) => d.clicks));
  const total = daily.reduce((s, d) => s + d.clicks, 0);
  const first = daily[0];
  const mid = daily[Math.floor(daily.length / 2)];
  const last = daily[daily.length - 1];
  const ticks = ticksOf(max);
  const dense = daily.length > 14;

  return (
    <figure>
      <div className="flex gap-2">
        <div className="relative h-44 w-7 shrink-0" aria-hidden="true">
          {ticks.map((v) => (
            <span key={v} className="absolute right-0 translate-y-1/2 text-[11px] leading-none tabular-nums text-muted" style={{ bottom: `${(v / max) * 100}%` }}>
              {fmt.number(v)}
            </span>
          ))}
        </div>

        <div role="img" aria-label={t('stats.chartAria', { days: daily.length, total: fmt.number(total), max: fmt.number(max) })} className="relative h-44 min-w-0 flex-1">
          {ticks.map((v) => (
            <div key={v} className={`absolute inset-x-0 border-t ${v === 0 ? 'border-line' : 'border-dashed border-line/70'}`} style={{ bottom: `${(v / max) * 100}%` }} aria-hidden="true" />
          ))}
          <div className={`relative flex h-full items-end ${dense ? 'gap-[3px]' : 'gap-1.5'}`}>
            {daily.map((d, i) => {
              const edge = i < 3 ? 'left-0' : i > daily.length - 4 ? 'right-0' : 'left-1/2 -translate-x-1/2';
              return (
                <div key={d.day} tabIndex={0} className="group relative flex h-full min-w-0 flex-1 items-end rounded-t-md outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <div className="absolute inset-0 rounded-t-md bg-ink/[0.035] transition-colors group-hover:bg-ink/[0.07]" aria-hidden="true" />
                  {d.clicks > 0 && (
                    <div
                      className="relative w-full rounded-t-md bg-gradient-to-t from-accent to-accent/75 transition-[filter] group-hover:brightness-110"
                      style={{ height: `${Math.max(3, (d.clicks / max) * 100)}%` }}
                    />
                  )}
                  <span role="tooltip" className={`pointer-events-none absolute -top-9 z-10 hidden whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-paper shadow-lg group-hover:block group-focus-visible:block ${edge}`}>
                    {t('stats.barTitle', { d: fmt.day(d.day), n: fmt.number(d.clicks) })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <figcaption className="mt-2 flex justify-between pl-9 text-xs text-muted">
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
