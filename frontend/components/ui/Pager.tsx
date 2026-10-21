'use client';

import { useState } from 'react';
import { AdminIcon } from '@/components/Icon';
import { useI18n } from '@/lib/i18n';

/** จำนวนแถวต่อหน้าของทุกตาราง/รายการ */
export const PAGE_SIZE = 10;

const WINDOW = 3; // แสดงเลขหน้าทีละ 3 หน้า (1–3, 4–6, …) ใช้ตัวเดียวกันทุกตาราง

/** แบ่งหน้า (ใช้ตัวเดียวกันทุกตาราง, หน้าละ PAGE_SIZE แถว): ช่วงแถวที่แสดง · ก่อนหน้า/เลขหน้า (ทีละ 3)/ถัดไป · ช่องใส่เลขหน้า */
export function Pager({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  const { t, fmt } = useI18n();
  const winStart = Math.floor((page - 1) / WINDOW) * WINDOW + 1;
  const winEnd = Math.min(totalPages, winStart + WINDOW - 1);
  const [jump, setJump] = useState('');
  const go = () => {
    const n = Math.floor(Number(jump));
    if (Number.isFinite(n) && n >= 1) onPage(Math.min(totalPages, n));
    setJump('');
  };
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  const btn = 'flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line px-5 py-3.5 sm:px-6">
      <p className="text-sm text-muted">{t('admin.pg.rows', { a: fmt.number(from), b: fmt.number(to), n: fmt.number(total) })}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {totalPages > 1 && (
          <nav aria-label={t('dash.pagesNav')} className="flex items-center gap-1">
            <button type="button" className={`${btn} gap-1 hover:bg-ink/[0.07]`} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t('dash.prev')}>
              <AdminIcon name="chevronDown" className="h-4 w-4 rotate-90" />
            </button>
            {winStart > 1 && (
              <button type="button" className={`${btn} text-muted hover:bg-ink/[0.07]`} onClick={() => onPage(winStart - 1)} aria-label={t('admin.pg.prevBlock')} title={t('admin.pg.prevBlock')}>
                …
              </button>
            )}
            {Array.from({ length: winEnd - winStart + 1 }, (_, k) => winStart + k).map((n) => (
              <button key={n} type="button" onClick={() => onPage(n)} aria-label={t('dash.page', { p: n, n: totalPages })} aria-current={n === page ? 'page' : undefined} className={`${btn} tabular-nums ${n === page ? 'bg-accent text-on-accent shadow-sm' : 'hover:bg-ink/[0.07]'}`}>
                {n}
              </button>
            ))}
            {winEnd < totalPages && (
              <button type="button" className={`${btn} text-muted hover:bg-ink/[0.07]`} onClick={() => onPage(winEnd + 1)} aria-label={t('admin.pg.nextBlock')} title={t('admin.pg.nextBlock')}>
                …
              </button>
            )}
            <button type="button" className={`${btn} gap-1 hover:bg-ink/[0.07]`} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label={t('dash.next')}>
              <AdminIcon name="chevronDown" className="h-4 w-4 -rotate-90" />
            </button>
          </nav>
        )}
        {totalPages > 1 && (
          <form
            noValidate
            className="flex items-center gap-2 text-sm text-muted"
            onSubmit={(e) => {
              e.preventDefault();
              go();
            }}
          >
            <label htmlFor="pg-jump">{t('admin.pg.goto')}</label>
            <input id="pg-jump" type="number" inputMode="numeric" min={1} max={totalPages} value={jump} onChange={(e) => setJump(e.target.value)} placeholder={`1–${totalPages}`} className="h-9 w-20 rounded-xl bg-ink/[0.05] px-2.5 text-center text-sm font-medium text-ink outline-none placeholder:text-muted/60 focus:ring-2 focus:ring-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            <button type="submit" className="flex h-9 items-center rounded-xl bg-ink/[0.07] px-3 text-sm font-semibold text-ink transition-colors hover:bg-ink/[0.12] disabled:opacity-50" disabled={!jump}>
              {t('admin.pg.go')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
