'use client';

import { copyText } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Link } from '@/lib/types';
import { useToast } from './Toast';

export type RowAction = 'qr' | 'stats' | 'edit' | 'toggle' | 'delete';

function Status({ link }: { link: Link }) {
  const { t } = useI18n();
  let label = t('status.active');
  let tone = 'bg-ok/15 text-ok';
  if (link.status === 'ADMIN_DISABLED') {
    label = t('status.adminDisabled');
    tone = 'bg-danger/15 text-danger';
  } else if (link.status === 'DISABLED') {
    label = t('status.disabled');
    tone = 'bg-muted/15 text-muted';
  } else if (link.expired) {
    label = t('status.expired');
    tone = 'bg-muted/15 text-muted';
  }
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>;
}

export function LinkRow({ link, onAction, busy }: { link: Link; onAction: (a: RowAction, l: Link) => void; busy: boolean }) {
  const toast = useToast();
  const { t, fmt } = useI18n();
  const shown = link.shortUrl.replace(/^https?:\/\//, '');
  const code = link.shortCode;

  const copy = async () => toast((await copyText(link.shortUrl)) ? t('common.copied') : t('common.copyFailed'));
  const act = (a: RowAction) => () => onAction(a, link);
  const canToggle = link.status !== 'ADMIN_DISABLED';
  const on = link.status === 'ACTIVE';

  return (
    <li className="grid gap-x-6 gap-y-3 py-5 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <a href={link.shortUrl} target="_blank" rel="noopener noreferrer" className="break-all font-mono text-lg font-semibold underline-offset-4 hover:underline">
            {shown}
          </a>
          <Status link={link} />
        </div>
        <p className="mt-1 truncate text-sm text-muted" title={link.originalUrl}>
          {link.originalUrl}
        </p>
        <p className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-muted">
          <span>{t('row.created', { d: fmt.date(link.createdAt) })}</span>
          {link.expiresAt && <span>{t(link.expired ? 'row.expiredOn' : 'row.expires', { d: fmt.date(link.expiresAt) })}</span>}
        </p>
      </div>

      <div className="flex items-start gap-5 md:justify-end">
        <p className="min-w-[4.5rem] md:text-right">
          <span className="block text-2xl font-bold leading-none">{fmt.number(link.clickCount)}</span>
          <span className="text-xs text-muted">{t('row.opens')}</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2 md:col-span-2">
        <button type="button" className="btn" onClick={copy} aria-label={t('row.aria.copy', { code })}>
          {t('common.copy')}
        </button>
        <button type="button" className="btn" onClick={act('qr')} aria-label={t('row.aria.qr', { code })}>
          {t('row.qr')}
        </button>
        <button type="button" className="btn" onClick={act('stats')} aria-label={t('row.aria.stats', { code })}>
          {t('row.stats')}
        </button>
        <button type="button" className="btn" onClick={act('edit')} aria-label={t('row.aria.edit', { code })}>
          {t('row.edit')}
        </button>
        {canToggle && (
          <button type="button" className="btn" disabled={busy} onClick={act('toggle')} aria-label={t(on ? 'row.aria.off' : 'row.aria.on', { code })}>
            {on ? t('row.turnOff') : t('row.turnOn')}
          </button>
        )}
        <button type="button" className="btn-danger" onClick={act('delete')} aria-label={t('row.aria.delete', { code })}>
          {t('row.delete')}
        </button>
      </div>
    </li>
  );
}
