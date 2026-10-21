'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import type { AuditActionName, AuditEntry } from '@/lib/types';
import { Select } from '@/components/ui/Select';
import { Chip } from '@/components/ui/Chip';
import { ClearFilters, dayOptions } from '@/components/ui/FilterBar';
import { DataTable } from '@/components/ui/DataTable';
import { ListCard } from '@/components/ui/ListCard';
import { ActionIcon } from '@/components/ui/ActionIcon';
import { DetailModal } from '@/components/ui/DetailModal';
import { useAdminList } from './useAdminList';

const ACTIONS: AuditActionName[] = ['USER_BAN', 'USER_UNBAN', 'USER_ROLE_CHANGE', 'LINK_DISABLE', 'LINK_ENABLE', 'DOMAIN_BLOCK', 'DOMAIN_UNBLOCK', 'USER_LOGIN', 'USER_LOGIN_BLOCKED', 'USER_REGISTER', 'API_KEY_CREATE', 'API_KEY_REVOKE'];
const tone = (a: AuditActionName) => (a.endsWith('BAN') || a === 'LINK_DISABLE' || a === 'DOMAIN_BLOCK' || a === 'USER_LOGIN_BLOCKED' ? 'danger' : a === 'USER_ROLE_CHANGE' ? 'accent' : 'muted');

export function AuditPanel() {
  const { t, lang } = useI18n();
  const [view, setView] = useState<AuditEntry | null>(null);
  const [action, setAction] = useState<'' | AuditActionName>('');
  const actionOptions = [{ value: '' as const, label: t('admin.a.allActions') }, ...ACTIONS.map((a) => ({ value: a, label: t(`audit.${a}` as 'audit.USER_BAN') }))];
  const [daysF, setDaysF] = useState('');
  const list = useAdminList<AuditEntry>('/api/admin/audit', { ...(action ? { action } : {}), ...(daysF ? { days: daysF } : {}) });
  const when = new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <ListCard
      title={t('admin.tab.audit')}
      total={list.data?.total ?? null}
      controls={<input className="field h-9 w-full text-ellipsis py-0 text-sm sm:w-52 xl:w-60" type="search" aria-label={t('admin.fl.search')} placeholder={t('admin.fl.search')} value={list.q} onChange={(e) => list.setQ(e.target.value)} />}
      filters={
        <>
          <Select<'' | AuditActionName> label={t('admin.col.action')} value={action} options={actionOptions} onChange={setAction} className="w-auto" />
          <Select<string> label={t('admin.fl.period')} value={daysF} options={dayOptions(t)} onChange={setDaysF} className="w-auto" />
          <ClearFilters active={!!(action || daysF)} onClear={() => { setAction(''); setDaysF(''); }} />
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
      {list.data && list.data.items.length > 0 && (
        <DataTable
          rows={list.data.items}
          rowKey={(a) => a.id}
          onRowClick={setView}
          rowLabel={(a) => `${t('admin.view')}: ${t(`audit.${a.action}` as 'audit.USER_BAN')}`}
          columns={[
            { id: 'when', header: t('admin.col.when'), className: 'whitespace-nowrap text-muted', cell: (a) => <time dateTime={a.createdAt}>{when.format(new Date(a.createdAt))}</time> },
            { id: 'action', header: t('admin.col.action'), cell: (a) => <Chip tone={tone(a.action)}>{t(`audit.${a.action}` as 'audit.USER_BAN')}</Chip> },
            { id: 'detail', header: t('admin.col.detail'), className: 'max-w-[22rem]', cell: (a) => <span className="block truncate" title={a.detail ?? ''}>{a.detail || '—'}</span> },
            { id: 'actor', header: t('admin.col.actor'), className: 'max-w-[12rem]', cell: (a) => <span className="block truncate text-muted">{a.actorEmail || t('admin.a.system')}</span> },
            { id: 'actions', header: t('admin.col.actions'), className: 'w-16', cell: (a) => <ActionIcon icon="eye" label={t('admin.view')} onClick={() => setView(a)} /> },
          ]}
        />
      )}
      <DetailModal
        open={!!view}
        title={t('admin.detail.audit')}
        subtitle={view ? t(`audit.${view.action}` as 'audit.USER_BAN') : undefined}
        icon="audit"
        tone={view && tone(view.action) === 'danger' ? 'danger' : 'default'}
        infoLabel={t('admin.tab.info')}
        onClose={() => setView(null)}
        fields={
          view
            ? [
                { half: true, icon: 'calendar', label: t('admin.col.when'), value: when.format(new Date(view.createdAt)) },
                { half: true, icon: 'info', label: t('admin.col.action'), value: <Chip tone={tone(view.action)}>{t(`audit.${view.action}` as 'audit.USER_BAN')}</Chip> },
                { icon: 'user', label: t('admin.col.actor'), value: view.actorEmail || t('admin.a.system'), copy: view.actorEmail ?? undefined },
                { icon: 'info', label: t('admin.col.detail'), value: view.detail || t('admin.f.none') },
                { icon: 'globe', label: t('admin.f.target'), value: view.targetType ? t(`admin.target.${view.targetType}` as 'admin.target.USER') : t('admin.f.none') },
              ]
            : []
        }
      />
    </ListCard>
  );
}
