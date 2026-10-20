'use client';

import { useState } from 'react';
import { AdminIcon, type AdminIconName } from '@/components/Icon';
import { Modal } from '@/components/Modal';
import { useI18n } from '@/lib/i18n';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  body: string;
  detail?: string; // บรรทัดเน้น เช่น อีเมล/ลิงก์/โดเมนที่กำลังจะถูกจัดการ
  confirmLabel: string;
  icon: AdminIconName;
  tone?: 'danger' | 'primary';
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

// หน้าต่างยืนยันก่อนทำ action ที่มีผล (ระงับ, ปิดลิงก์, บล็อกโดเมน ฯลฯ)
export function ConfirmModal({ open, title, body, detail, confirmLabel, icon, tone = 'primary', onConfirm, onClose }: ConfirmModalProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.actionFail'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} bare>
      <div className="flex flex-col items-center text-center">
        <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'}`}>
          <AdminIcon name={icon} className="h-7 w-7" />
        </span>
        <h2 id="modal-title" className="mt-4 text-xl font-bold leading-snug">
          {title}
        </h2>
        {detail && <p className="mt-4 max-w-full break-all rounded-xl bg-ink/[0.05] px-4 py-2 font-mono text-sm font-medium">{detail}</p>}
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <div className="mt-7 grid w-full grid-cols-2 gap-3">
          <button type="button" className="btn h-11 justify-center text-[15px]" onClick={onClose} disabled={busy}>
            <AdminIcon name="x" className="h-4 w-4" />
            {t('admin.d.cancel')}
          </button>
          <button type="button" className={`${tone === 'danger' ? 'btn-danger' : 'btn-ink'} h-11 justify-center text-[15px]`} onClick={run} disabled={busy}>
            <AdminIcon name={icon} className="h-4 w-4" />
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
