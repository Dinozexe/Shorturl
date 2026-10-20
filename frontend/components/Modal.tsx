'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { AdminIcon } from './Icon';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  /** กล่องเล็กแบบจัดกลาง: ไม่มีแถบหัวเรื่องของ Modal (ผู้เรียกวาง <h2 id="modal-title"> เอง) เหลือแค่ปุ่มปิดมุมขวาบน */
  bare?: boolean;
}

// ใช้ <dialog> ของเบราว์เซอร์: ล็อกโฟกัสในกล่อง, กด Esc ปิดได้, อ่านออกเสียงเป็น dialog ให้อัตโนมัติ
export function Modal({ open, onClose, title, children, wide, bare }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // คลิกพื้นหลัง
      }}
      aria-labelledby="modal-title"
      className={`m-auto w-[calc(100%-1.5rem)] rounded-3xl bg-surface p-0 text-ink shadow-2xl ${wide ? 'max-w-4xl' : bare ? 'max-w-md' : 'max-w-lg'}`}
    >
      {open && (
        <div className={`max-h-[85vh] overflow-y-auto p-5 sm:p-6 ${bare ? 'relative px-6 pb-6 pt-8 sm:px-8' : ''}`}>
          {bare && (
            <button type="button" onClick={onClose} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink/[0.07] hover:text-ink" aria-label={t('common.closeDialog')} title={t('common.close')}>
              <AdminIcon name="x" className="h-5 w-5" />
            </button>
          )}
          {!bare && <div className="mb-5 flex items-start justify-between gap-4">
            <h2 id="modal-title" className="text-xl font-bold">
              {title}
            </h2>
            <button type="button" onClick={onClose} className="-mr-1.5 -mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink/[0.07] hover:text-ink" aria-label={t('common.closeDialog')} title={t('common.close')}>
              <AdminIcon name="x" className="h-5 w-5" />
            </button>
          </div>}
          {children}
        </div>
      )}
    </dialog>
  );
}
