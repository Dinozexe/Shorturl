'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { AdminUser, Role } from '@/lib/types';
import { ActionIcon, Chip, DataTable, ListShell, type Column } from './parts';
import { useAdminList } from './useAdminList';

const ROLES: Role[] = ['USER', 'MODERATOR', 'ADMIN'];

export function UsersPanel() {
  const { t, fmt } = useI18n();
  const { user: me } = useAuth();
  const toast = useToast();
  const list = useAdminList<AdminUser>('/api/admin/users');
  const [ask, setAsk] = useState<{ u: AdminUser; kind: 'ban' | 'unban' | 'role'; role?: Role } | null>(null);
  const roleOptions = ROLES.map((r) => ({ value: r, label: t(`role.${r}` as 'role.ADMIN') }));

  const run = async () => {
    if (!ask) return;
    const body = ask.kind === 'role' ? { role: ask.role } : { isBanned: ask.kind === 'ban' };
    await api(`/api/admin/users/${ask.u.id}`, { method: 'PATCH', body });
    toast(ask.kind === 'ban' ? t('admin.u.banDone') : ask.kind === 'unban' ? t('admin.u.unbanDone') : t('admin.u.roleDone'));
    setAsk(null);
    list.reload();
  };

  const columns: Array<Column<AdminUser>> = [
    {
      id: 'user',
      header: t('admin.col.user'),
      cell: (u) => (
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
            {(u.name || u.email).slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-2">
              <span className="truncate font-semibold">{u.name || u.email}</span>
              {u.id === me?.id && <Chip tone="accent">{t('admin.u.you')}</Chip>}
            </p>
            {u.name && <p className="truncate text-xs text-muted">{u.email}</p>}
          </div>
        </div>
      ),
    },
    {
      id: 'role',
      header: t('admin.col.role'),
      cell: (u) =>
        u.id === me?.id ? (
          <Chip tone="accent">{t(`role.${u.role}` as 'role.ADMIN')}</Chip>
        ) : (
          <Select<Role> label={t('admin.u.role')} value={u.role} options={roleOptions} onChange={(r) => setAsk({ u, kind: 'role', role: r })} className="w-40" />
        ),
    },
    { id: 'status', header: t('admin.col.status'), cell: (u) => (u.isBanned ? <Chip tone="danger">{t('admin.u.banned')}</Chip> : <Chip tone="ok">{t('admin.u.normal')}</Chip>) },
    { id: 'links', header: t('admin.col.links'), className: 'tabular-nums', cell: (u) => fmt.number(u.linkCount) },
    { id: 'joined', header: t('admin.col.joined'), className: 'whitespace-nowrap text-muted', cell: (u) => fmt.date(u.createdAt) },
    { id: 'last', header: t('admin.col.lastLogin'), className: 'whitespace-nowrap text-muted', cell: (u) => (u.lastLoginAt ? fmt.date(u.lastLoginAt) : t('admin.u.never')) },
    {
      id: 'actions',
      header: t('admin.col.actions'),
      className: 'w-24',
      cell: (u) =>
        u.id === me?.id ? null : (
          <ActionIcon
            icon={u.isBanned ? 'userCheck' : 'ban'}
            tone={u.isBanned ? 'ok' : 'danger'}
            label={u.isBanned ? t('admin.u.unban') : t('admin.u.ban')}
            onClick={() => setAsk({ u, kind: u.isBanned ? 'unban' : 'ban' })}
          />
        ),
    },
  ];

  return (
    <ListShell
      title={t('admin.tab.users')}
      total={list.data?.total ?? null}
      controls={<input className="field py-2 sm:w-72" type="search" aria-label={t('admin.u.search')} placeholder={t('admin.u.search')} value={list.q} onChange={(e) => list.setQ(e.target.value)} />}
      error={list.error}
      onRetry={list.reload}
      loading={list.loading}
      empty={!!list.data && list.data.items.length === 0}
      emptyText={t('admin.empty')}
      page={list.page}
      totalPages={list.totalPages}
      onPage={list.setPage}
    >
      {list.data && list.data.items.length > 0 && <DataTable columns={columns} rows={list.data.items} rowKey={(u) => u.id} />}
      <ConfirmModal
        open={!!ask}
        title={ask ? t(`admin.c.${ask.kind}.title` as 'admin.c.ban.title') : ''}
        body={ask ? (ask.kind === 'role' ? t('admin.c.role.body', { role: t(`role.${ask.role ?? 'USER'}` as 'role.ADMIN') }) : t(`admin.c.${ask.kind}.body` as 'admin.c.ban.body')) : ''}
        detail={ask?.u.email}
        confirmLabel={ask ? (ask.kind === 'ban' ? t('admin.u.ban') : ask.kind === 'unban' ? t('admin.u.unban') : t('admin.c.role.confirm')) : ''}
        icon={ask?.kind === 'ban' ? 'ban' : ask?.kind === 'unban' ? 'userCheck' : 'users'}
        tone={ask?.kind === 'ban' ? 'danger' : 'primary'}
        onConfirm={run}
        onClose={() => setAsk(null)}
      />
    </ListShell>
  );
}
