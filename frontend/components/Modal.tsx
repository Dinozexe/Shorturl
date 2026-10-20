'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}

// ใช้ <dialog> ของเบราว์เซอร์: ล็อกโฟกัสในกล่อง, กด Esc ปิดได้, อ่านออกเสียงเป็น dialog ให้อัตโนมัติ
export function Modal({ open, onClose, title, children, wide }: ModalProps) {
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
      className={`m-auto w-[calc(100%-1.5rem)] rounded-lg border border-line bg-surface p-0 text-ink shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
    >
      {open && (
        <div className="max-h-[85vh] overflow-y-auto p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 id="modal-title" className="text-xl font-bold">
              {title}
            </h2>
            <button type="button" onClick={onClose} className="btn -mr-1 -mt-1 px-2.5 py-1.5" aria-label={t('common.closeDialog')}>
              {t('common.close')}
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
