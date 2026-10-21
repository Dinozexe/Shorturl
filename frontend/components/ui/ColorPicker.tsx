'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/lib/i18n';

// ---- สี: hex ↔ HSV ----
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

function hexToRgb(hex: string): [number, number, number] {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? '000000';
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')}`;

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const d = max - Math.min(R, G, B);
  let h = 0;
  if (d !== 0) h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [(h * 60 + 360) % 360, max === 0 ? 0 : d / max, max];
}

function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return toHex(f(5) * 255, f(3) * 255, f(1) * 255);
}

/** รับ "abc", "#AABBCC", "aabbcc" → "#aabbcc"; ไม่ถูกต้อง = null */
function normaliseHex(raw: string): string | null {
  const v = raw.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(v)) return `#${v.split('').map((c) => c + c).join('')}`.toLowerCase();
  return /^[0-9a-f]{6}$/i.test(v) ? `#${v}`.toLowerCase() : null;
}

const SWATCHES = ['#000000', '#1d4ed8', '#0e7490', '#15803d', '#b91c1c', '#c2410c', '#7e22ce', '#0f172a', '#ffffff', '#fde68a', '#bfdbfe', '#e5e7eb'];

/** ลากในกรอบ: ส่งสัดส่วน 0–1 ของแกน x,y (จับ pointer ไว้จนปล่อย) */
function dragProps(onMove: (x: number, y: number) => void) {
  const at = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onMove(clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1));
  };
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      at(e);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => e.buttons === 1 && at(e),
  };
}

interface Props {
  label: string;
  value: string; // #rrggbb
  onChange: (hex: string) => void;
}

/** ตัวเลือกสีที่วาดเอง (ไม่ใช้ <input type=color>): กรอบเลือกความเข้ม/ความสว่าง + แถบเฉดสี + ช่องรหัสสี + สีสำเร็จรูป */
export function ColorPicker({ label, value, onChange }: Props) {
  const { t } = useI18n();
  const id = useRef(`cp-${Math.random().toString(36).slice(2, 8)}`).current;
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [hsv, setHsv] = useState<[number, number, number]>(() => rgbToHsv(...hexToRgb(value)));
  const [draft, setDraft] = useState(value);

  // ค่าจากภายนอกเปลี่ยน (เช่น เลือกสไตล์สำเร็จรูป) → ซิงค์ — แต่ไม่ทับ hue เมื่อสีเทา/ดำ/ขาว (hue ไม่มีความหมาย)
  useEffect(() => {
    setDraft(value);
    setHsv((cur) => {
      if (hsvToHex(...cur) === value) return cur;
      const next = rgbToHsv(...hexToRgb(value));
      return next[1] === 0 || next[2] === 0 ? [cur[0], next[1], next[2]] : next;
    });
  }, [value]);

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const W = 264;
    const H = 330;
    const left = clamp(r.left, 8, window.innerWidth - W - 8);
    const below = r.bottom + 8;
    setPos({ left, top: below + H > window.innerHeight ? Math.max(8, r.top - H - 8) : below });
  }, []);

  const show = () => {
    place();
    setHost((btn.current?.closest('dialog') as HTMLElement | null) ?? document.body);
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  };

  useEffect(() => {
    if (open) pop.current?.focus();
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const n = e.target as Node;
      if (!pop.current?.contains(n) && !btn.current?.contains(n)) setOpen(false);
    };
    const away = (e: Event) => {
      if (e.type === 'scroll' && pop.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', away);
    window.addEventListener('scroll', away, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', away);
      window.removeEventListener('scroll', away, true);
    };
  }, [open]);

  const apply = (next: [number, number, number]) => {
    setHsv(next);
    const hex = hsvToHex(...next);
    setDraft(hex);
    if (hex !== value) onChange(hex);
  };
  const setHex = (hex: string) => {
    setDraft(hex);
    setHsv((cur) => {
      const n = rgbToHsv(...hexToRgb(hex));
      return n[1] === 0 || n[2] === 0 ? [cur[0], n[1], n[2]] : n;
    });
    if (hex !== value) onChange(hex);
  };

  const [h, s, v] = hsv;
  const nudge = (e: KeyboardEvent, fn: (d: number) => void) => {
    const d = e.shiftKey ? 0.1 : 0.02;
    const map: Record<string, number> = { ArrowLeft: -d, ArrowDown: -d, ArrowRight: d, ArrowUp: d };
    if (e.key in map) {
      e.preventDefault();
      fn(map[e.key]);
    }
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${value}`}
        onClick={() => (open ? close(false) : show())}
        className={`flex h-10 items-center gap-2.5 rounded-xl border bg-surface pl-1.5 pr-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${open ? 'border-accent' : 'border-line hover:border-ink/30'}`}
      >
        <span className="h-7 w-7 rounded-lg ring-1 ring-ink/15" style={{ backgroundColor: value }} aria-hidden="true" />
        <span className="font-mono text-xs uppercase tracking-wide">{value}</span>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={pop}
            role="dialog"
            aria-label={label}
            id={id}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault(); // ไม่งั้น <dialog> ที่ครอบอยู่ปิดทั้งหน้าต่างตาม
                e.stopPropagation();
                close();
              }
            }}
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-[70] w-[264px] rounded-2xl bg-surface p-3.5 outline-none shadow-[0_16px_48px_rgba(15,18,28,0.22)] ring-1 ring-line"
          >
            {/* ความเข้ม (แกนนอน) × ความสว่าง (แกนตั้ง) */}
            <div
              role="slider"
              tabIndex={0}
              aria-label={t('qr.color.area')}
              aria-valuetext={`${Math.round(s * 100)}% / ${Math.round(v * 100)}%`}
              aria-valuenow={Math.round(s * 100)}
              {...dragProps((x, y) => apply([h, x, 1 - y]))}
              onKeyDown={(e) => {
                nudge(e, (d) => apply([h, clamp(s + (e.key.includes('Left') || e.key.includes('Right') ? d : 0), 0, 1), clamp(v + (e.key.includes('Up') || e.key.includes('Down') ? d : 0), 0, 1)]));
              }}
              className="relative h-36 w-full cursor-crosshair touch-none select-none rounded-xl outline-none ring-1 ring-ink/10 focus-visible:ring-2 focus-visible:ring-accent"
              style={{ backgroundImage: `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, hsl(${h} 100% 50%))` }}
            >
              <span aria-hidden="true" className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.3)]" style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, backgroundColor: hsvToHex(h, s, v) }} />
            </div>

            {/* เฉดสี */}
            <div
              role="slider"
              tabIndex={0}
              aria-label={t('qr.color.hue')}
              aria-valuemin={0}
              aria-valuemax={360}
              aria-valuenow={Math.round(h)}
              {...dragProps((x) => apply([x * 360, s, v]))}
              onKeyDown={(e) => nudge(e, (d) => apply([(h + d * 360 * 2.5 + 360) % 360, s, v]))}
              className="relative mt-3 h-3.5 w-full cursor-pointer touch-none select-none rounded-full outline-none ring-1 ring-ink/10 focus-visible:ring-2 focus-visible:ring-accent"
              style={{ backgroundImage: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
            >
              <span aria-hidden="true" className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.3)]" style={{ left: `${(h / 360) * 100}%`, backgroundColor: `hsl(${h} 100% 50%)` }} />
            </div>

            {/* รหัสสี */}
            <label className="mt-3 flex items-center gap-2.5 text-xs font-medium text-muted">
              <span className="shrink-0">{t('qr.color.hex')}</span>
              <input
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  // ใช้ทันทีเมื่อครบ 6 หลัก; แบบย่อ 3 หลัก (abc) รอ Enter/ออกจากช่อง ไม่งั้นพิมพ์ ff0000 ไม่ทัน (ff0 ถูกขยายเป็น ffff00 กลางทาง)
                  if (/^#?[0-9a-f]{6}$/i.test(e.target.value.trim())) setHex(normaliseHex(e.target.value)!);
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  const ok = normaliseHex(draft);
                  if (ok) setHex(ok);
                }}
                onBlur={() => {
                  const ok = normaliseHex(draft);
                  if (ok) setHex(ok);
                  else setDraft(value);
                }}
                spellCheck={false}
                autoComplete="off"
                maxLength={7}
                className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 font-mono text-sm uppercase text-ink outline-none focus:border-accent"
              />
            </label>

            {/* สีสำเร็จรูป */}
            <div role="group" aria-label={t('qr.color.swatches')} className="mt-3 grid grid-cols-6 gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  aria-label={c}
                  aria-pressed={c === value}
                  onClick={() => setHex(c)}
                  className={`h-8 rounded-lg ring-1 ring-ink/15 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${c === value ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>,
          host ?? document.body,
        )}
    </>
  );
}
