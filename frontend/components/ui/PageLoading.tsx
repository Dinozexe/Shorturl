'use client';

import { useI18n } from '@/lib/i18n';
import { useSlowHint } from '@/lib/useSlowHint';

/** กำลังโหลดทั้งหน้า (ตอนตรวจว่าล็อกอินอยู่ไหมครั้งแรก): วงหมุนกลางจอ + ข้อความ; รอเกิน 4 วินาทีจะบอกว่าเซิร์ฟเวอร์กำลังตื่น */
export function PageLoading({ text, full = false }: { text: string; full?: boolean }) {
  const { t } = useI18n();
  const slow = useSlowHint(true);
  return (
    <main role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-4 px-6 text-center ${full ? 'min-h-svh' : 'min-h-[70svh]'}`}>
      <span aria-hidden="true" className="h-10 w-10 animate-spin rounded-full border-[3px] border-line border-t-accent motion-reduce:animate-none" />
      <p className="text-sm font-medium text-muted">{text}</p>
      {slow && <p className="max-w-sm text-[13px] leading-relaxed text-muted">{t('wake.hint')}</p>}
    </main>
  );
}
