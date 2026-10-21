'use client';

import type { ReactNode } from 'react';

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string; // ใช้กับทั้ง th และ td เช่นความกว้าง/จัดชิดขวา
}

/** ตารางข้อมูล: หัวคอลัมน์แยกชัด เลื่อนซ้ายขวาได้บนจอเล็ก */
export function DataTable<T>({ columns, rows, rowKey, onRowClick, rowLabel }: { columns: Array<Column<T>>; rows: T[]; rowKey: (r: T) => string | number; onRowClick?: (r: T) => void; rowLabel?: (r: T) => string }) {
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
            <tr
              key={rowKey(r)}
              className={`transition-colors hover:bg-ink/[0.03] ${onRowClick ? 'cursor-pointer focus-visible:bg-ink/[0.04]' : ''}`}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onRowClick(r); } } : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              aria-label={onRowClick && rowLabel ? rowLabel(r) : undefined}
            >
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
