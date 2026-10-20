'use client';

import type { ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { AdminIcon, type AdminIconName } from '@/components/Icon';

/** ป้ายสถานะเล็กๆ: tone = สีตามความหมาย (ไม่พึ่งสีอย่างเดียว เพราะมีข้อความกำกับเสมอ) */
export function Chip({ tone = 'muted', children }: { tone?: 'muted' | 'ok' | 'danger' | 'accent'; children: ReactNode }) {
  const cls = {
    muted: 'bg-ink/[0.07] text-ink/80',
    ok: 'bg-ok/15 text-ok',
    danger: 'bg-danger/15 text-danger',
    accent: 'bg-accent/15 text-accent',
  }[tone];
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

/** กรอบรายการของแต่ละแท็บ: หัวเรื่อง + ตัวควบคุม + รายการ + แบ่งหน้า */
export function ListShell({
  title,
  total,
  controls,
  error,
  onRetry,
  loading,
  empty,
  emptyText,
  page,
  totalPages,
  onPage,
  children,
}: {
  title: string;
  total: number | null;
  controls?: ReactNode;
  error: string | null;
  onRetry: () => void;
  loading: boolean;
  empty: boolean;
  emptyText: string;
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  children: ReactNode;
}) {
  const { t, fmt } = useI18n();
  return (
    <section className="bento overflow-hidden" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <h2 className="text-lg font-bold">
          {title}
          {total !== null && <span className="ml-2 text-sm font-normal text-muted">{t('admin.total', { n: fmt.number(total) })}</span>}
        </h2>
        {controls && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{controls}</div>}
      </div>

      <div>
        {error && (
          <div role="alert" className="flex flex-wrap items-center gap-3 px-5 py-5 text-sm font-medium text-danger sm:px-6">
            {error}
            <button type="button" className="btn" onClick={onRetry}>
              {t('common.retry')}
            </button>
          </div>
        )}
        {loading && total === null && <p className="px-5 py-8 text-muted sm:px-6">{t('admin.loading')}</p>}
        {empty && !loading && <p className="px-5 py-10 text-center text-muted sm:px-6">{emptyText}</p>}
        <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>{children}</div>
      </div>

      {totalPages > 1 && (
        <nav aria-label={t('dash.pagesNav')} className="flex items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-6">
          <button type="button" className="btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            {t('dash.prev')}
          </button>
          <span className="text-sm text-muted">{t('dash.page', { p: page, n: totalPages })}</span>
          <button type="button" className="btn" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
            {t('dash.next')}
          </button>
        </nav>
      )}
    </section>
  );
}

/** ปุ่มไอคอนสำหรับ action ในตาราง: มี tooltip (title) และ aria-label ตรงกัน */
export function ActionIcon({ icon, label, onClick, tone = 'default', disabled }: { icon: AdminIconName; label: string; onClick: () => void; tone?: 'default' | 'danger' | 'ok'; disabled?: boolean }) {
  const cls = {
    default: 'text-ink/70 hover:bg-ink/[0.07] hover:text-ink',
    danger: 'text-danger hover:bg-danger/10',
    ok: 'text-ok hover:bg-ok/10',
  }[tone];
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}>
      <AdminIcon name={icon} className="h-[18px] w-[18px]" />
    </button>
  );
}

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string; // ใช้กับทั้ง th และ td เช่นความกว้าง/จัดชิดขวา
}

/** ตารางข้อมูล: หัวคอลัมน์แยกชัด เลื่อนซ้ายขวาได้บนจอเล็ก */
export function DataTable<T>({ columns, rows, rowKey }: { columns: Array<Column<T>>; rows: T[]; rowKey: (r: T) => string | number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] border-collapse text-sm">
        <thead>
          <tr className="bg-ink/[0.03] text-left text-xs font-semibold text-muted">
            {columns.map((c) => (
              <th key={c.id} scope="col" className={`whitespace-nowrap px-4 py-3 first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6 ${c.className ?? ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={rowKey(r)} className="transition-colors hover:bg-ink/[0.02]">
              {columns.map((c) => (
                <td key={c.id} className={`px-4 py-3 align-middle first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6 ${c.className ?? ''}`}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
