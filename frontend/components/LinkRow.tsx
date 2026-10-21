'use client';

import { useEffect, useState } from 'react';
import { copyText } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Link } from '@/lib/types';
import { AdminIcon } from './Icon';
import { ActionIcon } from './ui/ActionIcon';
import { Chip } from './ui/Chip';
import { useToast } from './Toast';

export type RowAction = 'view' | 'qr' | 'stats' | 'edit' | 'toggle' | 'delete';

function Status({ link }: { link: Link }) {
  const { t } = useI18n();
  if (link.status === 'ADMIN_DISABLED') return <Chip tone="danger">{t('status.adminDisabled')}</Chip>;
  if (link.status === 'DISABLED') return <Chip>{t('status.disabled')}</Chip>;
  if (link.expired) return <Chip>{t('status.expired')}</Chip>;
  if (link.limitReached) return <Chip>{t('status.limitReached')}</Chip>;
  if (link.notStarted) return <Chip tone="accent">{t('status.notStarted')}</Chip>;
  return <Chip tone="ok">{t('status.active')}</Chip>;
}

export function LinkRow({ link, onAction, busy }: { link: Link; onAction: (a: RowAction, l: Link) => void; busy: boolean }) {
  const toast = useToast();
  const { t, fmt } = useI18n();
  const shown = link.shortUrl.replace(/^https?:\/\//, '');
  const code = link.shortCode;
  const initial = (link.originalHost || link.originalUrl.replace(/^https?:\/\//, '')).replace(/^www\./, '').slice(0, 1).toUpperCase();

  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    const done = await copyText(link.shortUrl);
    setCopied(done);
    toast(done ? t('common.copied') : t('common.copyFailed'));
  };
  const act = (a: RowAction) => () => onAction(a, link);
  const canToggle = link.status !== 'ADMIN_DISABLED';
  const on = link.status === 'ACTIVE';
  const dim = link.status !== 'ACTIVE' || link.expired || link.limitReached;

  return (
    <li className="group grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 rounded-2xl sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:gap-x-5 px-3 py-3.5 transition-colors hover:bg-ink/[0.035] sm:px-4"
      onClick={(e) => {
        // กดตรงไหนของแถวก็เปิดรายละเอียด ยกเว้นลิงก์/ปุ่ม/ข้อความที่กำลังเลือกอยู่
        if ((e.target as HTMLElement).closest('a, button') || window.getSelection()?.toString()) return;
        onAction('view', link);
      }}
    >
      <span aria-hidden="true" className={`hidden h-12 w-12 items-center sm:flex justify-center rounded-2xl text-lg font-bold ${dim ? 'bg-ink/[0.06] text-muted' : 'bg-accent/15 text-accent'}`}>
        {initial}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <a href={link.shortUrl} target="_blank" rel="noopener noreferrer" className="break-all font-mono text-[15px] font-semibold underline-offset-4 hover:underline sm:text-lg">
            {shown}
          </a>
          <Status link={link} />
        </div>
        <p className="mt-0.5 truncate text-sm text-muted" title={link.originalUrl}>
          {link.originalUrl}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
          <span>{t('row.created', { d: fmt.date(link.createdAt) })}</span>
          {link.startsAt && <span>{t('row.starts', { d: fmt.date(link.startsAt) })}</span>}
          {link.expiresAt && <span>{t(link.expired ? 'row.expiredOn' : 'row.expires', { d: fmt.date(link.expiresAt) })}</span>}
          {link.maxClicks !== null && <span>{t('row.limit', { n: fmt.number(link.maxClicks) })}</span>}
          {link.hasPassword && (
            <span className="inline-flex items-center gap-1">
              <AdminIcon name="lock" className="h-3.5 w-3.5" />
              {t('row.protected')}
            </span>
          )}
        </p>
      </div>

      <p className="min-w-[4.5rem] text-right sm:border-l sm:border-line/60 sm:pl-5">
        <span className="block text-2xl font-bold leading-none tabular-nums">{fmt.number(link.clickCount)}</span>
        <span className="mt-1 block text-xs text-muted">{t('row.opens')}</span>
      </p>

      <div className="col-span-2 flex items-center gap-0.5 border-t border-line/60 pt-2.5 sm:col-span-1 sm:border-0 sm:pt-0">
        <ActionIcon icon="eye" label={t('row.aria.view', { code })} onClick={act('view')} />
        <ActionIcon icon={copied ? 'check' : 'copy'} tone={copied ? 'ok' : 'default'} label={t('row.aria.copy', { code })} onClick={copy} />
        <ActionIcon icon="qr" label={t('row.aria.qr', { code })} onClick={act('qr')} />
        <ActionIcon icon="clicks" label={t('row.aria.stats', { code })} onClick={act('stats')} />
        <ActionIcon icon="edit" label={t('row.aria.edit', { code })} onClick={act('edit')} />
        {canToggle && <ActionIcon icon={on ? 'linkOff' : 'links'} tone={on ? 'default' : 'ok'} label={t(on ? 'row.aria.off' : 'row.aria.on', { code })} disabled={busy} onClick={act('toggle')} />}
        <ActionIcon icon="trash" tone="danger" label={t('row.aria.delete', { code })} onClick={act('delete')} />
      </div>
    </li>
  );
}
