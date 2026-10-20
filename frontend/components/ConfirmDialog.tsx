'use client';

import { useI18n } from '@/lib/i18n';
import type { Link } from '@/lib/types';
import { ConfirmModal } from './ui/ConfirmModal';

// ยืนยันลบลิงก์ (หน้าตาเดียวกับหน้าต่างยืนยันของผู้ดูแล)
export function DeleteDialog({ link, onClose, onConfirm }: { link: Link | null; onClose: () => void; onConfirm: (link: Link) => Promise<void> }) {
  const { t } = useI18n();
  return <ConfirmModal open={!!link} title={t('del.title')} body={t('del.body')} detail={link?.shortUrl} confirmLabel={t('del.confirm')} icon="trash" tone="danger" onConfirm={() => (link ? onConfirm(link) : undefined)} onClose={onClose} />;
}
