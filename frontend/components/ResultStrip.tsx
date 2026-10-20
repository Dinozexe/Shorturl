'use client';

import { copyText } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Link } from '@/lib/types';
import { useToast } from './Toast';

interface Props {
  link: Link;
  onQr: (link: Link) => void;
  onDismiss: () => void;
}

// จุดเด่นของหน้า: แถบดำพร้อมไม้บรรทัด แสดงลิงก์สั้นที่เพิ่งสร้าง
export function ResultStrip({ link, onQr, onDismiss }: Props) {
  const toast = useToast();
  const { t } = useI18n();

  const copy = async () => toast((await copyText(link.shortUrl)) ? t('common.copied') : t('common.copyFailedManual'));

  return (
    <section aria-label={t('result.aria')} className="ruler rounded-md bg-ink px-5 pb-8 pt-5 text-paper [--ruler:var(--paper)] sm:px-7">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold">{t('result.title')}</p>
        <button type="button" onClick={onDismiss} className="-mr-2 -mt-1 rounded px-2 py-1 text-sm font-medium underline underline-offset-2 hover:bg-paper/15">
          {t('result.hide')}
        </button>
      </div>
      <a href={link.shortUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all font-mono text-2xl font-semibold underline-offset-4 hover:underline sm:text-4xl">
        {link.shortUrl}
      </a>
      <p className="mt-2 truncate text-sm opacity-80" title={link.originalUrl}>
        {t('result.goes', { url: link.originalUrl })}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="btn-light">
          {t('result.copy')}
        </button>
        <button type="button" onClick={() => onQr(link)} className="btn-light">
          {t('result.qr')}
        </button>
      </div>
    </section>
  );
}
