'use client';

import type { ReactNode } from 'react';
import { AdminIcon, type AdminIconName } from '@/components/Icon';

/** สถานะ "ยังไม่มีข้อมูล / ไม่พบ": ไอคอนในแผ่นสี + หัวข้อ + คำอธิบาย + ปุ่มทำต่อ (ถ้ามี) อยู่กึ่งกลาง; compact = ใช้ในการ์ดเล็ก */
export function EmptyState({ icon = 'inbox', title, body, action, compact, className = '' }: { icon?: AdminIconName; title: string; body?: string; action?: ReactNode; compact?: boolean; className?: string }) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'gap-1.5 px-4 py-6' : 'gap-3 px-6 py-12'} ${className}`}>
      <span className={`flex items-center justify-center bg-ink/[0.05] text-muted ${compact ? 'h-10 w-10 rounded-xl' : 'h-14 w-14 rounded-2xl'}`}>
        <AdminIcon name={icon} className={compact ? 'h-5 w-5' : 'h-7 w-7'} />
      </span>
      <p className={`font-semibold ${compact ? 'text-sm' : 'text-base'}`}>{title}</p>
      {body && <p className="max-w-sm text-sm leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
