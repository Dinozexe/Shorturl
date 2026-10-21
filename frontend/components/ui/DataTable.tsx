'use client';

import type { ReactNode } from 'react';

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string; // ใช้กับทั้ง th และ td เช่นความกว้าง/จัดชิดขวา
}

/** ตารางข้อมูล: จอกว้างเป็นตาราง (เลื่อนซ้ายขวาได้ถ้าแคบ) · จอแคบเป็นการ์ดต่อแถว */
export function DataTable<T>({ columns, rows, rowKey, onRowClick, rowLabel }: { columns: Array<Column<T>>; rows: T[]; rowKey: (r: T) => string | number; onRowClick?: (r: T) => void; rowLabel?: (r: T) => string }) {
  const [first, ...rest] = columns;
  const onKey = (r: T) => (e: React.KeyboardEvent) => {
    if (onRowClick && e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onRowClick(r);
    }
  };
  return (
    <>
      {/* จอแคบ (< md): แต่ละแถวเป็นการ์ด — คอลัมน์แรกเป็นหัวการ์ด ที่เหลือเป็นคู่ "ชื่อ: ค่า" ไม่ต้องเลื่อนซ้ายขวา */}
      <ul className="divide-y divide-line md:hidden">
        {rows.map((r) => (
          <li
            key={rowKey(r)}
            className={`flex flex-col gap-3 px-4 py-4 sm:px-6 ${onRowClick ? 'cursor-pointer active:bg-ink/[0.04]' : ''}`}
            onClick={onRowClick ? () => onRowClick(r) : undefined}
            onKeyDown={onKey(r)}
            tabIndex={onRowClick ? 0 : undefined}
            aria-label={onRowClick && rowLabel ? rowLabel(r) : undefined}
          >
            <div className="min-w-0">{first.cell(r)}</div>
            <dl className="flex flex-col gap-2 text-sm">
              {rest.map((c) =>
                c.header ? (
                  <div key={c.id} className="flex items-center justify-between gap-4">
                    <dt className="shrink-0 text-xs font-semibold text-muted">{c.header}</dt>
                    <dd className="min-w-0 text-right">{c.cell(r)}</dd>
                  </div>
                ) : (
                  <div key={c.id} className="flex justify-end">
                    {c.cell(r)}
                  </div>
                ),
              )}
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
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
                onKeyDown={onKey(r)}
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
    </>
  );
}
