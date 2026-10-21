import type { ReactNode } from 'react';

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
