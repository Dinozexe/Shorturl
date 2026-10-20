'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { AdminLink, LinkStatus } from '@/lib/types';
import { ActionIcon, Chip, DataTable, ListShell, type Column } from './parts';
import { useAdminList } from './useAdminList';

const STATUSES: LinkStatus[] = ['ACTIVE', 'DISABLED', 'ADMIN_DISABLED'];
const STATUS_KEY = { ACTIVE: 'status.active', DISABLED: 'status.disabled', ADMIN_DISABLED: 'status.adminDisabled' } as const;

export function LinksPanel() {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const [status, setStatus] = useState<'' | LinkStatus>('');
  const list = useAdminList<AdminLink>('/api/admin/links', status ? { status } : {});
  const [ask, setAsk] = useState<AdminLink | null>(null);
  const statusOptions = [{ value: '' as const, label: t('admin.l.allStatus') }, ...STATUSES.map((s) => ({ value: s, label: t(STATUS_KEY[s]) }))];
  const turningOff = !!ask && ask.status !== 'ADMIN_DISABLED';

  const run = async () => {
    if (!ask) return;
    await api(`/api/admin/links/${ask.id}`, { method: 'PATCH', body: { status: turningOff ? 'ADMIN_DISABLED' : 'ACTIVE' } });
    toast(turningOff ? t('admin.l.offDone') : t('admin.l.onDone'));
    setAsk(null);
    list.reload();
  };

  const columns: Array<Column<AdminLink>> = [
    { id: 'short', header: t('admin.col.shortUrl'), cell: (l) => <span className="whitespace-nowrap font-mono text-[13px] font-semibold text-accent">{l.shortUrl.replace(/^https?:\/\//, '')}</span> },
    {
      id: 'dest',
      header: t('admin.col.dest'),
      className: 'max-w-[16rem]',
      cell: (l) => (
        <span className="block truncate text-muted" title={l.originalUrl}>
          {l.originalUrl}
        </span>
      ),
    },
    { id: 'owner', header: t('admin.col.owner'), className: 'max-w-[12rem]', cell: (l) => (l.ownerEmail ? <span className="block truncate" title={l.ownerEmail}>{l.ownerEmail}</span> : <span className="text-muted">{t('admin.l.guest')}</span>) },
    { id: 'status', header: t('admin.col.status'), cell: (l) => <Chip tone={l.status === 'ACTIVE' ? 'ok' : l.status === 'ADMIN_DISABLED' ? 'danger' : 'muted'}>{t(STATUS_KEY[l.status])}</Chip> },
    { id: 'opens', header: t('admin.col.opens'), className: 'tabular-nums', cell: (l) => fmt.number(l.clickCount) },
    { id: 'created', header: t('admin.col.created'), className: 'whitespace-nowrap text-muted', cell: (l) => fmt.date(l.createdAt) },
    {
      id: 'actions',
      header: t('admin.col.actions'),
      className: 'w-24',
      cell: (l) => (
        <ActionIcon
          icon={l.status === 'ADMIN_DISABLED' ? 'links' : 'linkOff'}
          tone={l.status === 'ADMIN_DISABLED' ? 'ok' : 'danger'}
          label={l.status === 'ADMIN_DISABLED' ? t('admin.l.turnOn') : t('admin.l.turnOff')}
          onClick={() => setAsk(l)}
        />
      ),
    },
  ];

  return (
    <ListShell
      title={t('admin.tab.links')}
      total={list.data?.total ?? null}
      controls={
        <>
          <Select<'' | LinkStatus> label={t('admin.col.status')} value={status} options={statusOptions} onChange={setStatus} className="w-44" />
          <input className="field py-2 sm:w-72" type="search" aria-label={t('admin.l.search')} placeholder={t('admin.l.search')} value={list.q} onChange={(e) => list.setQ(e.target.value)} />
        </>
      }
      error={list.error}
      onRetry={list.reload}
      loading={list.loading}
      empty={!!list.data && list.data.items.length === 0}
      emptyText={t('admin.empty')}
      page={list.page}
      totalPages={list.totalPages}
      onPage={list.setPage}
    >
      {list.data && list.data.items.length > 0 && <DataTable columns={columns} rows={list.data.items} rowKey={(l) => l.id} />}
      <ConfirmModal
        open={!!ask}
        title={t(turningOff ? 'admin.c.linkOff.title' : 'admin.c.linkOn.title')}
        body={t(turningOff ? 'admin.c.linkOff.body' : 'admin.c.linkOn.body')}
        detail={ask?.shortUrl}
        confirmLabel={t(turningOff ? 'admin.l.turnOff' : 'admin.l.turnOn')}
        icon={turningOff ? 'linkOff' : 'links'}
        tone={turningOff ? 'danger' : 'primary'}
        onConfirm={run}
        onClose={() => setAsk(null)}
      />
    </ListShell>
  );
}
