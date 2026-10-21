'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { StatsBody } from '@/components/StatsDialog';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { DetailModal } from '@/components/ui/DetailModal';
import { AdminIcon } from '@/components/Icon';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { AdminLink, LinkStatus } from '@/lib/types';
import { ActionIcon } from '@/components/ui/ActionIcon';
import { Chip } from '@/components/ui/Chip';
import { ClearFilters, dayOptions } from '@/components/ui/FilterBar';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ListCard } from '@/components/ui/ListCard';
import { useAdminList } from './useAdminList';

const STATUSES: LinkStatus[] = ['ACTIVE', 'DISABLED', 'ADMIN_DISABLED'];
const STATUS_KEY = { ACTIVE: 'status.active', DISABLED: 'status.disabled', ADMIN_DISABLED: 'status.adminDisabled' } as const;

export function LinksPanel() {
  const { t, fmt, lang } = useI18n();
  const when = new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const toast = useToast();
  const [status, setStatus] = useState<'' | LinkStatus>('');
  const [ownerF, setOwnerF] = useState('');
  const [daysF, setDaysF] = useState('');
  const [sortF, setSortF] = useState('');
  const extra: Record<string, string> = {};
  if (status) extra.status = status;
  if (ownerF) extra.owner = ownerF;
  if (daysF) extra.days = daysF;
  if (sortF) extra.sort = sortF;
  const list = useAdminList<AdminLink>('/api/admin/links', extra);
  const ownerOptions = [{ value: '', label: t('admin.fl.allOwners') }, { value: 'member', label: t('admin.fl.member') }, { value: 'guest', label: t('admin.fl.guest') }];
  const sortOptions = [{ value: '', label: t('admin.fl.sortNew') }, { value: 'clicks', label: t('admin.fl.sortClicks') }];
  const [ask, setAsk] = useState<AdminLink | null>(null);
  const [view, setView] = useState<AdminLink | null>(null);
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
        <div className="flex items-center gap-0.5">
        <ActionIcon icon="eye" label={t('admin.view')} onClick={() => setView(l)} />
        <ActionIcon
          icon={l.status === 'ADMIN_DISABLED' ? 'links' : 'linkOff'}
          tone={l.status === 'ADMIN_DISABLED' ? 'ok' : 'danger'}
          label={l.status === 'ADMIN_DISABLED' ? t('admin.l.turnOn') : t('admin.l.turnOff')}
          onClick={() => setAsk(l)}
        />
        </div>
      ),
    },
  ];

  return (
    <ListCard
      title={t('admin.tab.links')}
      total={list.data?.total ?? null}
      controls={<input className="field h-9 w-full text-ellipsis py-0 text-sm sm:w-52 xl:w-60" type="search" aria-label={t('admin.l.search')} placeholder={t('admin.l.search')} value={list.q} onChange={(e) => list.setQ(e.target.value)} />}
      filters={
        <>
          <Select<'' | LinkStatus> label={t('admin.col.status')} value={status} options={statusOptions} onChange={setStatus} className="w-auto" />
          <Select<string> label={t('admin.fl.owner')} value={ownerF} options={ownerOptions} onChange={setOwnerF} className="w-auto" />
          <Select<string> label={t('admin.fl.period')} value={daysF} options={dayOptions(t)} onChange={setDaysF} className="w-auto" />
          <Select<string> label={t('admin.fl.sort')} value={sortF} options={sortOptions} onChange={setSortF} className="w-auto" />
          <ClearFilters active={!!(status || ownerF || daysF || sortF)} onClear={() => { setStatus(''); setOwnerF(''); setDaysF(''); setSortF(''); }} />
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
      {list.data && list.data.items.length > 0 && <DataTable columns={columns} rows={list.data.items} rowKey={(l) => l.id} onRowClick={setView} rowLabel={(l) => `${t('admin.view')}: ${l.shortCode}`} />}
      <DetailModal
        open={!!view}
        title={t('admin.detail.link')}
        subtitle={view ? view.shortUrl.replace(/^https?:\/\//, '') : undefined}
        icon={view?.status === 'ADMIN_DISABLED' ? 'linkOff' : 'links'}
        tone={view?.status === 'ADMIN_DISABLED' ? 'danger' : 'default'}
        infoLabel={t('admin.tab.info')}
        onClose={() => setView(null)}
        tabs={view ? [{ id: 'stats', label: t('row.stats'), icon: 'clicks', content: <StatsBody link={view} basePath="/api/admin/links" /> }] : []}
        fields={
          view
            ? [
                { label: t('admin.col.shortUrl'), icon: 'links', value: view.shortUrl, copy: view.shortUrl, mono: true },
                { label: t('admin.col.dest'), icon: 'globe', value: view.originalUrl, copy: view.originalUrl, mono: true },
                { label: t('admin.col.status'), icon: 'info', half: true, value: <Chip tone={view.status === 'ACTIVE' ? 'ok' : view.status === 'ADMIN_DISABLED' ? 'danger' : 'muted'}>{t(STATUS_KEY[view.status])}</Chip> },
                { label: t('admin.col.opens'), icon: 'clicks', half: true, value: fmt.number(view.clickCount) },
                { label: t('admin.col.owner'), icon: 'user', value: view.ownerEmail ?? t('admin.l.guest'), copy: view.ownerEmail ?? undefined },
                { label: t('admin.col.created'), icon: 'calendar', half: true, value: when.format(new Date(view.createdAt)) },
                { label: t('admin.f.expires'), icon: 'clock', half: true, value: view.expiresAt ? when.format(new Date(view.expiresAt)) : t('admin.f.never') },
              ]
            : []
        }
        footer={
          view && (
            <>
              <button type="button" className="btn" onClick={() => setView(null)}>
                <AdminIcon name="x" className="h-4 w-4" />
                {t('common.close')}
              </button>
              <button type="button" className={view.status === 'ADMIN_DISABLED' ? 'btn-ink' : 'btn-danger'} onClick={() => { setAsk(view); setView(null); }}>
                <AdminIcon name={view.status === 'ADMIN_DISABLED' ? 'links' : 'linkOff'} className="h-4 w-4" />
                {view.status === 'ADMIN_DISABLED' ? t('admin.l.turnOn') : t('admin.l.turnOff')}
              </button>
            </>
          )
        }
      />
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
    </ListCard>
  );
}
