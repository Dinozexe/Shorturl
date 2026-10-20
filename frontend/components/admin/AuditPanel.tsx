'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import type { AuditActionName, AuditEntry } from '@/lib/types';
import { Select } from '@/components/ui/Select';
import { Chip, DataTable, ListShell } from './parts';
import { useAdminList } from './useAdminList';

const ACTIONS: AuditActionName[] = ['USER_BAN', 'USER_UNBAN', 'USER_ROLE_CHANGE', 'LINK_DISABLE', 'LINK_ENABLE', 'DOMAIN_BLOCK', 'DOMAIN_UNBLOCK', 'USER_LOGIN', 'USER_LOGIN_BLOCKED', 'USER_REGISTER', 'API_KEY_CREATE', 'API_KEY_REVOKE'];
const tone = (a: AuditActionName) => (a.endsWith('BAN') || a === 'LINK_DISABLE' || a === 'DOMAIN_BLOCK' || a === 'USER_LOGIN_BLOCKED' ? 'danger' : a === 'USER_ROLE_CHANGE' ? 'accent' : 'muted');

export function AuditPanel() {
  const { t, lang } = useI18n();
  const [action, setAction] = useState<'' | AuditActionName>('');
  const actionOptions = [{ value: '' as const, label: t('admin.a.allActions') }, ...ACTIONS.map((a) => ({ value: a, label: t(`audit.${a}` as 'audit.USER_BAN') }))];
  const list = useAdminList<AuditEntry>('/api/admin/audit', action ? { action } : {});
  const when = new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <ListShell
      title={t('admin.tab.audit')}
      total={list.data?.total ?? null}
      controls={
        <Select<'' | AuditActionName> label={t('admin.col.action')} value={action} options={actionOptions} onChange={setAction} className="w-56" />
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
          columns={[
            { id: 'when', header: t('admin.col.when'), className: 'whitespace-nowrap text-muted', cell: (a) => <time dateTime={a.createdAt}>{when.format(new Date(a.createdAt))}</time> },
            { id: 'action', header: t('admin.col.action'), cell: (a) => <Chip tone={tone(a.action)}>{t(`audit.${a.action}` as 'audit.USER_BAN')}</Chip> },
            { id: 'detail', header: t('admin.col.detail'), className: 'max-w-[22rem]', cell: (a) => <span className="block truncate" title={a.detail ?? ''}>{a.detail || '—'}</span> },
            { id: 'actor', header: t('admin.col.actor'), className: 'max-w-[12rem]', cell: (a) => <span className="block truncate text-muted">{a.actorEmail || t('admin.a.system')}</span> },
          ]}
        />
      )}
    </ListShell>
  );
}
