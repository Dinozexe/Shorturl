'use client';

import { AdminIcon } from '@/components/Icon';
import { useI18n, type MsgKey } from '@/lib/i18n';

/** แถวตัวกรอง: ปุ่มล้างตัวกรองแสดงเมื่อมีตัวกรองที่ใช้อยู่ */
export function ClearFilters({ active, onClear }: { active: boolean; onClear: () => void }) {
  const { t } = useI18n();
  if (!active) return null;
  return (
    <button type="button" onClick={onClear} className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-accent transition-colors hover:bg-accent/10">
      <AdminIcon name="x" className="h-4 w-4" />
      {t('admin.fl.clear')}
    </button>
  );
}

/** ตัวเลือกช่วงเวลา (กรองตามวันที่สร้าง) */
export const dayOptions = (t: (k: MsgKey) => string) => [
  { value: '', label: t('admin.fl.anyTime') },
  { value: '1', label: t('admin.fl.d1') },
  { value: '7', label: t('admin.fl.d7') },
  { value: '30', label: t('admin.fl.d30') },
  { value: '90', label: t('admin.fl.d90') },
];
