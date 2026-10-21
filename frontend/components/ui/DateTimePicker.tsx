'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { AdminIcon } from '@/components/Icon';
import { useI18n } from '@/lib/i18n';

interface Props {
  /** รูปแบบเดียวกับ <input type="datetime-local">: "YYYY-MM-DDTHH:mm" (เวลาในเครื่อง) หรือ "" */
  value: string;
  onChange: (v: string) => void;
  label: string;
  /** เวลาเริ่มต้นเมื่อเลือกวันที่ครั้งแรก */
  defaultTime?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const key = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parse(v: string): { y: number; m: number; d: number; h: number; min: number } | null {
  const r = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  return r ? { y: +r[1], m: +r[2] - 1, d: +r[3], h: +r[4], min: +r[5] } : null;
}

const PRESETS = ['00:00', '09:00', '12:00', '18:00', '23:59'];

/** เลือกวัน-เวลาแบบวาดเอง (ไม่ใช้ <input type=datetime-local>): ปฏิทินรายเดือน + เลือกเดือน/ปี + เวลา; ใช้คีย์บอร์ดได้ (ลูกศร/PageUp/PageDown/Enter/Esc) */
export function DateTimePicker({ value, onChange, label, defaultTime = '00:00' }: Props) {
  const { t, lang } = useI18n();
  const id = useId();
  const locale = lang === 'th' ? 'th-TH' : 'en-GB';
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const cur = parse(value);
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'days' | 'months'>('days');
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [focusDay, setFocusDay] = useState(1);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);

  const text = cur ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(cur.y, cur.m, cur.d, cur.h, cur.min)) : '';
  const monthName = (y: number, m: number, style: 'long' | 'short' = 'long') => new Intl.DateTimeFormat(locale, { month: style, year: style === 'long' ? 'numeric' : undefined }).format(new Date(y, m, 1));
  const yearName = (y: number) => new Intl.DateTimeFormat(locale, { year: 'numeric' }).format(new Date(y, 0, 1));
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 7 + i))); // เริ่มวันอาทิตย์

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const W = 316, H = 440;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - W - 8);
    const below = window.innerHeight - r.bottom;
    const top = below >= H || below >= r.top ? r.bottom + 6 : Math.max(8, r.top - H - 6);
    setPos({ top: Math.min(top, window.innerHeight - 120), left });
  }, []);

  const show = () => {
    const base = cur ?? { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
    setYm({ y: base.y, m: base.m });
    setFocusDay(base.d);
    setView('days');
    place();
    setHost((btn.current?.closest('dialog') as HTMLElement | null) ?? document.body);
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  };

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

  // ย้ายโฟกัสไปวันที่ที่เลือกเมื่อเปิด/เปลี่ยนวัน
  useEffect(() => {
    if (open && view === 'days') pop.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus();
  }, [open, view, focusDay, ym]);

  const time = cur ? `${pad(cur.h)}:${pad(cur.min)}` : defaultTime;
  const emit = (y: number, m: number, d: number, hhmm = time) => onChange(`${key(y, m, d)}T${hhmm}`);
  const setTime = (hhmm: string) => {
    const base = cur ?? { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
    emit(base.y, base.m, base.d, hhmm);
  };
  const stepTime = (field: 'h' | 'min', delta: number) => {
    const [h, mi] = time.split(':').map(Number);
    if (field === 'h') setTime(`${pad((h + delta + 24) % 24)}:${pad(mi)}`);
    else setTime(`${pad(h)}:${pad((mi + delta + 60) % 60)}`);
  };
  const typeTime = (field: 'h' | 'min', raw: string) => {
    const [h, mi] = time.split(':').map(Number);
    const n = Math.min(field === 'h' ? 23 : 59, Math.max(0, parseInt(raw.replace(/\D/g, '').slice(-2) || '0', 10)));
    setTime(field === 'h' ? `${pad(n)}:${pad(mi)}` : `${pad(h)}:${pad(n)}`);
  };

  const shiftMonth = (delta: number, day = focusDay) => {
    const d = new Date(ym.y, ym.m + delta, 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    setYm({ y: d.getFullYear(), m: d.getMonth() });
    setFocusDay(Math.min(day, last));
  };

  const first = new Date(ym.y, ym.m, 1).getDay();
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells: Array<number | null> = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const todayKey = key(now.getFullYear(), now.getMonth(), now.getDate());

  const onGridKey = (e: KeyboardEvent) => {
    const move = (n: number) => {
      e.preventDefault();
      const t0 = new Date(ym.y, ym.m, focusDay + n);
      setYm({ y: t0.getFullYear(), m: t0.getMonth() });
      setFocusDay(t0.getDate());
    };
    if (e.key === 'ArrowLeft') move(-1);
    else if (e.key === 'ArrowRight') move(1);
    else if (e.key === 'ArrowUp') move(-7);
    else if (e.key === 'ArrowDown') move(7);
    else if (e.key === 'Home') move(-new Date(ym.y, ym.m, focusDay).getDay());
    else if (e.key === 'End') move(6 - new Date(ym.y, ym.m, focusDay).getDay());
    else if (e.key === 'PageUp') {
      e.preventDefault();
      shiftMonth(e.shiftKey ? -12 : -1);
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      shiftMonth(e.shiftKey ? 12 : 1);
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };

  const nav = 'flex h-9 w-9 items-center justify-center rounded-xl text-ink/80 outline-none transition-colors hover:bg-ink/[0.07] focus-visible:ring-2 focus-visible:ring-accent';
  const [hh, mm] = time.split(':');

  return (
    <>
      <div className="relative">
        <button
          ref={btn}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${label}${text ? `: ${text}` : ''}`}
          onClick={() => (open ? close(false) : show())}
          className={`flex min-h-11 w-full items-center gap-3 rounded-xl border bg-surface px-3.5 pr-10 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${open ? 'border-accent' : 'border-line hover:border-ink/30'}`}
        >
          <AdminIcon name="calendar" className="h-[18px] w-[18px] shrink-0 text-muted" />
          <span className={`truncate ${text ? 'font-medium text-ink' : 'text-muted'}`}>{text || t('dt.placeholder')}</span>
        </button>
        {text && (
          <button type="button" aria-label={t('dt.clear')} title={t('dt.clear')} onClick={() => onChange('')} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted outline-none transition-colors hover:bg-ink/[0.07] hover:text-ink focus-visible:ring-2 focus-visible:ring-accent">
            <AdminIcon name="x" className="h-4 w-4" />
          </button>
        )}
      </div>

      {open &&
        pos &&
        createPortal(
          <div
            ref={pop}
            role="dialog"
            aria-label={label}
            onKeyDown={onKey}
            style={{ top: pos.top, left: pos.left, width: 316 }}
            className="fixed z-[70] rounded-2xl bg-surface p-3 text-sm shadow-[0_16px_48px_rgba(15,18,28,0.18)] ring-1 ring-line"
          >
            {view === 'days' ? (
              <>
                <div className="flex items-center justify-between gap-1">
                  <button type="button" className={nav} aria-label={t('dt.prev')} title={t('dt.prev')} onClick={() => shiftMonth(-1)}>
                    <AdminIcon name="chevron" className="h-4 w-4 rotate-180" />
                  </button>
                  <button type="button" aria-label={t('dt.pickMonth')} onClick={() => setView('months')} className="flex h-9 items-center gap-1 rounded-xl px-3 font-bold outline-none transition-colors hover:bg-ink/[0.07] focus-visible:ring-2 focus-visible:ring-accent">
                    {monthName(ym.y, ym.m)}
                    <AdminIcon name="chevronDown" className="h-4 w-4 text-muted" />
                  </button>
                  <button type="button" className={nav} aria-label={t('dt.next')} title={t('dt.next')} onClick={() => shiftMonth(1)}>
                    <AdminIcon name="chevron" className="h-4 w-4" />
                  </button>
                </div>

                <div role="grid" aria-label={monthName(ym.y, ym.m)} onKeyDown={onGridKey} className="mt-2">
                  <div role="row" className="grid grid-cols-7 text-center text-xs font-medium text-muted">
                    {weekdays.map((w) => (
                      <span key={w} role="columnheader" className="py-1.5">
                        {w}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-y-0.5">
                    {cells.map((d, i) => {
                      if (d === null) return <span key={`e${i}`} />;
                      const k = key(ym.y, ym.m, d);
                      const selected = cur !== null && key(cur.y, cur.m, cur.d) === k;
                      const today = k === todayKey;
                      return (
                        <button
                          key={k}
                          type="button"
                          role="gridcell"
                          data-day={d}
                          tabIndex={d === focusDay ? 0 : -1}
                          aria-selected={selected}
                          aria-current={today ? 'date' : undefined}
                          onClick={() => {
                            setFocusDay(d);
                            emit(ym.y, ym.m, d);
                          }}
                          className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                            selected ? 'bg-accent font-bold text-on-accent' : today ? 'font-bold text-accent ring-1 ring-accent/50 hover:bg-accent/10' : 'hover:bg-ink/[0.07]'
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 border-t border-line pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                      <AdminIcon name="clock" className="h-4 w-4" />
                      {t('dt.time')}
                    </span>
                    <div className="flex items-center gap-1.5" role="group" aria-label={t('dt.time')}>
                      {([['h', hh, 'dt.hour', 'dt.hourUp', 'dt.hourDown'], ['min', mm, 'dt.minute', 'dt.minUp', 'dt.minDown']] as const).map(([f, v, lbl, up, down], i) => (
                        <div key={f} className="flex items-center gap-1.5">
                          {i === 1 && <span className="font-bold text-muted">:</span>}
                          <div className="flex flex-col items-center">
                            <button type="button" aria-label={t(up)} onClick={() => stepTime(f, f === 'h' ? 1 : 5)} className="flex h-5 w-10 items-center justify-center rounded text-muted outline-none hover:bg-ink/[0.07] hover:text-ink focus-visible:ring-2 focus-visible:ring-accent">
                              <AdminIcon name="chevronDown" className="h-3.5 w-3.5 rotate-180" />
                            </button>
                            <input
                              inputMode="numeric"
                              aria-label={t(lbl as 'dt.hour')}
                              value={v}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) => typeTime(f, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  stepTime(f, (e.key === 'ArrowUp' ? 1 : -1) * (f === 'h' ? 1 : 5));
                                }
                              }}
                              className="h-9 w-10 rounded-lg bg-ink/[0.06] text-center text-base font-bold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            />
                            <button type="button" aria-label={t(down)} onClick={() => stepTime(f, f === 'h' ? -1 : -5)} className="flex h-5 w-10 items-center justify-center rounded text-muted outline-none hover:bg-ink/[0.07] hover:text-ink focus-visible:ring-2 focus-visible:ring-accent">
                              <AdminIcon name="chevronDown" className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PRESETS.map((p) => (
                      <button key={p} type="button" aria-pressed={time === p} onClick={() => setTime(p)} className={`rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${time === p ? 'bg-accent text-on-accent' : 'bg-ink/[0.06] text-ink/80 hover:bg-ink/[0.1]'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                  <button type="button" onClick={() => onChange('')} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted outline-none transition-colors hover:bg-ink/[0.07] hover:text-ink focus-visible:ring-2 focus-visible:ring-accent">
                    {t('dt.clear')}
                  </button>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const n = new Date();
                        setYm({ y: n.getFullYear(), m: n.getMonth() });
                        setFocusDay(n.getDate());
                        emit(n.getFullYear(), n.getMonth(), n.getDate());
                      }}
                      className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-accent outline-none transition-colors hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {t('dt.today')}
                    </button>
                    <button type="button" onClick={() => close()} className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-on-accent outline-none transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
                      {t('dt.done')}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-1">
                  <button type="button" className={nav} aria-label={t('dt.prevYear')} title={t('dt.prevYear')} onClick={() => setYm((v) => ({ ...v, y: v.y - 1 }))}>
                    <AdminIcon name="chevron" className="h-4 w-4 rotate-180" />
                  </button>
                  <span className="font-bold">{yearName(ym.y)}</span>
                  <button type="button" className={nav} aria-label={t('dt.nextYear')} title={t('dt.nextYear')} onClick={() => setYm((v) => ({ ...v, y: v.y + 1 }))}>
                    <AdminIcon name="chevron" className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {Array.from({ length: 12 }, (_, m) => {
                    const sel = m === ym.m;
                    return (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={sel}
                        autoFocus={sel}
                        onClick={() => {
                          setYm((v) => ({ ...v, m }));
                          setFocusDay(1);
                          setView('days');
                        }}
                        className={`rounded-xl py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${sel ? 'bg-accent font-bold text-on-accent' : 'hover:bg-ink/[0.07]'}`}
                      >
                        {new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2024, m, 1))}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>,
          host ?? document.body,
        )}
    </>
  );
}
