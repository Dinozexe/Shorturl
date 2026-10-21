'use client';

import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** ข้อความค่าที่แสดงมุมขวา/อ่านออกเสียง เช่น 18% */
  format?: (v: number) => string;
}

/** แถบเลื่อนที่วาดเอง (ไม่ใช้ <input type=range>): ลากด้วยเมาส์/นิ้ว, คีย์บอร์ด ←→↑↓ Home End PageUp PageDown, อ่านออกเสียงเป็น slider */
export function Slider({ label, value, min, max, step = 1, onChange, format = String }: SliderProps) {
  const track = useRef<HTMLDivElement>(null);
  const span = max - min;
  const pct = span === 0 ? 0 : ((value - min) / span) * 100;
  const ticks = span / step <= 14 ? Array.from({ length: span / step + 1 }, (_, i) => (i * step) / span * 100) : [];

  const snap = (v: number) => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
  const fromPointer = (e: PointerEvent) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const next = snap(min + ((e.clientX - r.left) / r.width) * span);
    if (next !== value) onChange(next);
  };

  const onKey = (e: KeyboardEvent) => {
    const big = Math.max(step, Math.round(span / 5 / step) * step);
    const map: Record<string, number> = { ArrowLeft: value - step, ArrowDown: value - step, ArrowRight: value + step, ArrowUp: value + step, PageDown: value - big, PageUp: value + big, Home: min, End: max };
    if (!(e.key in map)) return;
    e.preventDefault();
    const next = snap(map[e.key]);
    if (next !== value) onChange(next);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <output className="rounded-lg bg-ink/[0.06] px-2 py-0.5 text-xs font-semibold tabular-nums">{format(value)}</output>
      </div>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && fromPointer(e)}
        className="group relative flex h-7 cursor-pointer touch-none select-none items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <div className="relative h-2 w-full rounded-full bg-ink/[0.09]">
          <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${pct}%` }} />
          {ticks.map((t) => (
            <span key={t} aria-hidden="true" className={`absolute top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full ${t <= pct ? 'bg-on-accent/70' : 'bg-ink/25'}`} style={{ left: `${t}%` }} />
          ))}
        </div>
        <span
          aria-hidden="true"
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-white shadow-md transition-transform group-hover:scale-110 group-active:scale-95"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}
