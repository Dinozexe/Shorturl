'use client';

import { AdminIcon } from '@/components/Icon';
import { useI18n } from '@/lib/i18n';

// หน้าตาของ "โหลดไม่สำเร็จ": ไอคอนเตือน + ข้อความ + ปุ่มลองใหม่ อยู่กึ่งกลาง (ใช้ในตาราง กล่องรายการ และหน้าต่างต่างๆ)
export function ErrorState({ message, title, onRetry, busy, className = '' }: { message: string; title?: string; onRetry: () => void; busy?: boolean; className?: string }) {
  const { t } = useI18n();
  return (
    <div role="alert" className={`flex flex-col items-center gap-3 px-6 py-10 text-center ${className}`}>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <AdminIcon name="alert" className="h-7 w-7" />
      </span>
      <div className="max-w-sm">
        {title && <p className="font-semibold">{title}</p>}
        <p className={`text-sm leading-relaxed ${title ? 'mt-1 text-muted' : 'font-medium'}`}>{message}</p>
      </div>
      <button type="button" className="btn mt-1 h-10 px-5" onClick={onRetry} disabled={busy}>
        <AdminIcon name="refresh" className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
        {t('common.retry')}
      </button>
    </div>
  );
}
