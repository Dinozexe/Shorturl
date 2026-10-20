'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import type { Link } from '@/lib/types';
import { Modal } from './Modal';

export function DeleteDialog({ link, onClose, onConfirm }: { link: Link | null; onClose: () => void; onConfirm: (link: Link) => Promise<void> }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!link) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(link);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('del.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!link} onClose={onClose} title={t('del.title')}>
      {link && (
        <div className="flex flex-col gap-4">
          <p className="break-all font-mono text-sm font-medium">{link.shortUrl}</p>
          <p className="leading-relaxed text-muted">{t('del.body')}</p>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-danger" onClick={run} disabled={busy}>
              {busy ? t('del.deleting') : t('del.confirm')}
            </button>
            <button type="button" className="btn" onClick={onClose}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
