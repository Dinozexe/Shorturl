'use client';

import { useState } from 'react';
import { isoToLocalInput, localInputToIso } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Link } from '@/lib/types';
import { AdminIcon } from './Icon';

export interface Protection {
  startsAt: string; // ค่าของ <input type="datetime-local">
  maxClicks: string;
  password: string;
  removePassword: boolean;
}

export const emptyProtection: Protection = { startsAt: '', maxClicks: '', password: '', removePassword: false };

export const protectionOf = (link: Link): Protection => ({
  startsAt: isoToLocalInput(link.startsAt),
  maxClicks: link.maxClicks === null ? '' : String(link.maxClicks),
  password: '',
  removePassword: false,
});

/** ตรวจก่อนส่ง: คืนรหัสข้อความ error หรือ null */
export function protectionError(p: Protection): 'prot.errPw' | 'prot.errMax' | null {
  if (p.password && (p.password.length < 4 || p.password.length > 64)) return 'prot.errPw';
  if (p.maxClicks.trim() && !/^[1-9]\d{0,6}$/.test(p.maxClicks.trim())) return 'prot.errMax';
  return null;
}

/**
 * แปลงเป็นฟิลด์ที่ส่ง API: สร้างใหม่ (ไม่ส่ง existing) ส่งเฉพาะที่กรอก;
 * แก้ไข (ส่ง existing) ส่งเฉพาะที่เปลี่ยน — ล้างค่า = null (ยกเลิก)
 */
export function protectionBody(p: Protection, existing?: Link) {
  const body: { startsAt?: string | null; maxClicks?: number | null; password?: string | null } = {};
  const max = p.maxClicks.trim() ? Number(p.maxClicks.trim()) : null;
  if (!existing) {
    if (p.startsAt) body.startsAt = localInputToIso(p.startsAt) ?? null;
    if (max !== null) body.maxClicks = max;
    if (p.password) body.password = p.password;
    return body;
  }
  if (p.startsAt !== isoToLocalInput(existing.startsAt)) body.startsAt = p.startsAt ? (localInputToIso(p.startsAt) ?? null) : null;
  if (max !== existing.maxClicks) body.maxClicks = max;
  if (p.removePassword) body.password = null;
  else if (p.password) body.password = p.password;
  return body;
}

export function ProtectionFields({ value, onChange, hasPassword = false }: { value: Protection; onChange: (p: Protection) => void; hasPassword?: boolean }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  const set = (patch: Partial<Protection>) => onChange({ ...value, ...patch });
  const keeping = hasPassword && !value.removePassword;

  return (
    <fieldset className="grid gap-4 sm:grid-cols-2">
      <legend className="sr-only">{t('prot.title')}</legend>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        <span className="flex items-center gap-1.5">
          <AdminIcon name="clock" className="h-4 w-4 text-muted" />
          {t('prot.start')}
        </span>
        <input className="field" type="datetime-local" value={value.startsAt} onChange={(e) => set({ startsAt: e.target.value })} />
        <span className="text-xs font-normal text-muted">{t('prot.startHelp')}</span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        <span className="flex items-center gap-1.5">
          <AdminIcon name="clicks" className="h-4 w-4 text-muted" />
          {t('prot.max')}
        </span>
        <input className="field tabular-nums" inputMode="numeric" value={value.maxClicks} onChange={(e) => set({ maxClicks: e.target.value.replace(/\D/g, '').slice(0, 7) })} placeholder={t('prot.maxPh')} autoComplete="off" />
        <span className="text-xs font-normal text-muted">{t('prot.maxHelp')}</span>
      </label>

      <div className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
        <label htmlFor="link-pw" className="flex items-center gap-1.5">
          <AdminIcon name="lock" className="h-4 w-4 text-muted" />
          {t('prot.pw')}
        </label>
        <div className="relative">
          <input
            id="link-pw"
            className="field pr-12"
            type={show ? 'text' : 'password'}
            value={value.password}
            onChange={(e) => set({ password: e.target.value, removePassword: false })}
            placeholder={keeping ? t('prot.pwKeep') : t('prot.pwPh')}
            autoComplete="new-password"
            maxLength={64}
            spellCheck={false}
            disabled={value.removePassword}
          />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? t('prot.pwHide') : t('prot.pwShow')} title={show ? t('prot.pwHide') : t('prot.pwShow')} className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:bg-ink/[0.07] hover:text-ink">
            <AdminIcon name={show ? 'linkOff' : 'eye'} className="h-[18px] w-[18px]" />
          </button>
        </div>
        <span className="text-xs font-normal text-muted">{t('prot.pwHelp')}</span>
        {hasPassword && (
          <label className="mt-1 flex w-fit cursor-pointer items-center gap-2 text-sm font-normal">
            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--danger))]" checked={value.removePassword} onChange={(e) => set({ removePassword: e.target.checked, password: '' })} />
            {t('prot.pwRemove')}
          </label>
        )}
      </div>
    </fieldset>
  );
}
