'use client';

import type { ReactNode } from 'react';

interface LinkBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string; // ข้อความสำหรับโปรแกรมอ่านหน้าจอ (ช่องไม่มีป้ายให้เห็น)
  submit: ReactNode;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  size?: 'lg' | 'md';
}

// แถบวางลิงก์: ช่องกรอกกับปุ่มอยู่ในกรอบมนเดียวกัน ปุ่มชิดขวา — ใช้ทั้งหน้าแรกและ dashboard
export function LinkBar({ value, onChange, placeholder, label, submit, disabled, invalid, describedBy, size = 'md' }: LinkBarProps) {
  const lg = size === 'lg';
  return (
    <div
      className={`flex items-center gap-2 rounded-2xl border bg-surface shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-2 focus-within:ring-offset-paper ${
        invalid ? 'border-danger' : 'border-line'
      } ${lg ? 'p-2' : 'p-1.5'}`}
    >
      <label className="min-w-0 flex-1">
        <span className="sr-only">{label}</span>
        <input
          className={`w-full min-w-0 bg-transparent px-3 font-mono placeholder:font-sans placeholder:text-muted/80 focus:outline-none focus-visible:outline-none ${
            lg ? 'h-12 text-base sm:px-4' : 'h-11 text-base'
          }`}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
        />
      </label>
      <button type="submit" disabled={disabled} className={`btn-primary shrink-0 whitespace-nowrap rounded-xl ${lg ? 'h-12 px-5 text-base sm:px-7' : 'h-11 px-4 sm:px-6'}`}>
        {submit}
      </button>
    </div>
  );
}
