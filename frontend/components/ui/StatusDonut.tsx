'use client';

import { useI18n } from '@/lib/i18n';

interface Part {
  label: string;
  value: number;
  color: string;
}

/** โดนัทแบ่งสัดส่วน (SVG ล้วน) + คำอธิบายสีเป็นรายการ (ไม่พึ่งสีอย่างเดียว) */
export function StatusDonut({ total, parts }: { total: number; parts: Part[] }) {
  const { fmt } = useI18n();
  const R = 15.915; // เส้นรอบวง = 100 จะได้ใช้เปอร์เซ็นต์ตรงๆ
  const sum = parts.reduce((s, p) => s + p.value, 0);
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-40 w-40">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" role="img" aria-label={parts.map((p) => `${p.label} ${fmt.number(p.value)}`).join(', ')}>
          <circle cx="18" cy="18" r={R} fill="none" stroke="currentColor" strokeWidth="4" className="text-ink/[0.07]" />
          {sum > 0 &&
            parts.map((p) => {
              if (p.value === 0) return null;
              const len = (p.value / sum) * 100;
              const el = <circle key={p.label} cx="18" cy="18" r={R} fill="none" stroke={p.color} strokeWidth="4" strokeDasharray={`${Math.max(0, len - (parts.filter((x) => x.value > 0).length > 1 ? 0.8 : 0))} ${100 - len}`} strokeDashoffset={-offset} />;
              offset += len;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums leading-none">{fmt.number(total)}</span>
        </div>
      </div>
      <ul className="flex w-full flex-col gap-2 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
              <span className="truncate">{p.label}</span>
            </span>
            <span className="font-semibold tabular-nums">{fmt.number(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
