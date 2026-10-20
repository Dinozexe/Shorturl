'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AdminIcon } from '@/components/Icon';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  value: T;
  options: Array<SelectOption<T>>;
  onChange: (v: T) => void;
  label: string; // อ่านออกเสียงสำหรับโปรแกรมอ่านหน้าจอ
  disabled?: boolean;
  className?: string;
}

// ดรอปดาวน์แบบกำหนดเอง (ไม่ใช้ <select> ของระบบ): ลิสต์ลอยด้วย portal จึงไม่โดนตัดโดยตารางที่เลื่อนได้
// คีย์บอร์ด: ↑↓ เลื่อน, Enter/Space เลือก, Esc ปิด, Home/End
export function Select<T extends string>({ value, options, onChange, label, disabled, className = '' }: SelectProps<T>) {
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const [active, setActive] = useState(0);
  const current = options.find((o) => o.value === value);

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left, minWidth: r.width });
  }, []);

  const show = () => {
    if (disabled) return;
    place();
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  };
  const pick = (v: T) => {
    close();
    if (v !== value) onChange(v);
  };

  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!list.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    const away = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', away);
    window.addEventListener('scroll', away, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', away);
      window.removeEventListener('scroll', away, true);
    };
  }, [open]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(options[active].value);
    } else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? ''}`}
        onClick={() => (open ? close(false) : show())}
        className={`flex h-9 items-center justify-between gap-2 rounded-xl bg-ink/[0.05] pl-3 pr-2.5 text-sm font-medium text-ink outline-none transition-colors hover:bg-ink/[0.08] focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        <span className="truncate">{current?.label}</span>
        <AdminIcon name="chevronDown" className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open &&
        pos &&
        createPortal(
          <ul
            ref={list}
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={`${id}-${active}`}
            onKeyDown={onKey}
            style={{ top: pos.top, left: pos.left, minWidth: Math.max(pos.minWidth, 176) }}
            className="fixed z-[70] max-h-72 overflow-y-auto rounded-2xl bg-surface p-1.5 text-sm shadow-[0_16px_48px_rgba(15,18,28,0.18)] outline-none ring-1 ring-line"
          >
            {options.map((o, i) => {
              const selected = o.value === value;
              return (
                <li
                  key={o.value}
                  id={`${id}-${i}`}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o.value)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 ${i === active ? 'bg-ink/[0.07]' : ''} ${selected ? 'font-semibold text-accent' : ''}`}
                >
                  <span className="truncate">{o.label}</span>
                  {selected && <AdminIcon name="check" className="h-4 w-4 shrink-0" />}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </>
  );
}
