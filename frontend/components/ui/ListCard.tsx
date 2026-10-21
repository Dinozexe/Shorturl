'use client';

import type { ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';
import { Pager } from './Pager';

/** การ์ดรายการ/ตาราง: หัวเรื่อง + จำนวน + ตัวกรอง/ค้นหา + ข้อผิดพลาด/ว่าง + เนื้อหา + แบ่งหน้า (ใช้ร่วมทุกตาราง) */
export function ListCard({
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
  filters,
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
  filters?: ReactNode;
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
        {(filters || controls) && (
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center lg:w-auto lg:flex-1 lg:justify-end [&>button]:w-full sm:[&>button]:w-auto">
            {filters}
            {controls && <div className="col-span-2 sm:col-auto">{controls}</div>}
          </div>
        )}
      </div>

      <div>
        {error && <ErrorState message={error} onRetry={onRetry} busy={loading} />}
        {loading && total === null && !error && <LoadingState text={t('admin.loading')} />}
        {empty && !loading && <EmptyState icon="inbox" title={emptyText} />}
        <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>{children}</div>
      </div>

      {total !== null && total > 0 && <Pager page={page} totalPages={totalPages} total={total} onPage={onPage} />}
    </section>
  );
}
