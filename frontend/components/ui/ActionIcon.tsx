'use client';

import { AdminIcon, type AdminIconName } from '@/components/Icon';

/** ปุ่มไอคอนสำหรับ action ในตาราง: มี tooltip (title) และ aria-label ตรงกัน */
export function ActionIcon({ icon, label, onClick, tone = 'default', disabled }: { icon: AdminIconName; label: string; onClick: () => void; tone?: 'default' | 'danger' | 'ok'; disabled?: boolean }) {
  const cls = {
    default: 'text-ink/70 hover:bg-ink/[0.07] hover:text-ink',
    danger: 'text-danger hover:bg-danger/10',
    ok: 'text-ok hover:bg-ok/10',
  }[tone];
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick(); }} className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}>
      <AdminIcon name={icon} className="h-[18px] w-[18px]" />
    </button>
  );
}
