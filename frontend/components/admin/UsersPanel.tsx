'use client';

import { useState } from 'react';
import { AdminIcon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { DetailModal } from '@/components/ui/DetailModal';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { AdminUser, Role } from '@/lib/types';
import { ActionIcon } from '@/components/ui/ActionIcon';
import { Chip } from '@/components/ui/Chip';
import { ClearFilters, dayOptions } from '@/components/ui/FilterBar';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ListCard } from '@/components/ui/ListCard';
import { useAdminList } from './useAdminList';

const ROLES: Role[] = ['USER', 'MODERATOR', 'ADMIN'];

export function UsersPanel() {
  const { t, fmt, lang } = useI18n();
  const when = new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const { user: me } = useAuth();
  const toast = useToast();
  const [roleF, setRoleF] = useState('');
  const [bannedF, setBannedF] = useState('');
  const [daysF, setDaysF] = useState('');
  const [sortF, setSortF] = useState('');
  const extra: Record<string, string> = {};
  if (roleF) extra.role = roleF;
  if (bannedF) extra.banned = bannedF;
  if (daysF) extra.days = daysF;
  if (sortF) extra.sort = sortF;
  const list = useAdminList<AdminUser>('/api/admin/users', extra);
  const roleFilterOptions = [{ value: '', label: t('admin.fl.allRoles') }, ...ROLES.map((r) => ({ value: r as string, label: t(`role.${r}` as 'role.ADMIN') }))];
  const statusFilterOptions = [{ value: '', label: t('admin.l.allStatus') }, { value: '0', label: t('admin.u.normal') }, { value: '1', label: t('admin.u.banned') }];
  const sortOptions = [{ value: '', label: t('admin.fl.sortNew') }, { value: 'login', label: t('admin.fl.sortLogin') }, { value: 'links', label: t('admin.fl.sortLinks') }];
  const [view, setView] = useState<AdminUser | null>(null);
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
    { id: 'role', header: t('admin.col.role'), cell: (u) => <Chip tone={u.role === 'USER' ? 'muted' : 'accent'}>{t(`role.${u.role}` as 'role.ADMIN')}</Chip> },
    { id: 'status', header: t('admin.col.status'), cell: (u) => (u.isBanned ? <Chip tone="danger">{t('admin.u.banned')}</Chip> : <Chip tone="ok">{t('admin.u.normal')}</Chip>) },
    { id: 'links', header: t('admin.col.links'), className: 'tabular-nums', cell: (u) => fmt.number(u.linkCount) },
    { id: 'joined', header: t('admin.col.joined'), className: 'whitespace-nowrap text-muted', cell: (u) => fmt.date(u.createdAt) },
    { id: 'last', header: t('admin.col.lastLogin'), className: 'whitespace-nowrap text-muted', cell: (u) => (u.lastLoginAt ? fmt.date(u.lastLoginAt) : t('admin.u.never')) },
    {
      id: 'actions',
      header: t('admin.col.actions'),
      className: 'w-20',
      cell: (u) => <ActionIcon icon="eye" label={t('admin.view')} onClick={() => setView(u)} />,
    },
  ];

  return (
    <ListCard
      title={t('admin.tab.users')}
      total={list.data?.total ?? null}
      controls={<input className="field h-9 w-full text-ellipsis py-0 text-sm sm:w-52 xl:w-60" type="search" aria-label={t('admin.u.search')} placeholder={t('admin.u.search')} value={list.q} onChange={(e) => list.setQ(e.target.value)} />}
      filters={
        <>
          <Select<string> label={t('admin.col.role')} value={roleF} options={roleFilterOptions} onChange={setRoleF} className="w-auto" />
          <Select<string> label={t('admin.col.status')} value={bannedF} options={statusFilterOptions} onChange={setBannedF} className="w-auto" />
          <Select<string> label={t('admin.fl.period')} value={daysF} options={dayOptions(t)} onChange={setDaysF} className="w-auto" />
          <Select<string> label={t('admin.fl.sort')} value={sortF} options={sortOptions} onChange={setSortF} className="w-auto" />
          <ClearFilters active={!!(roleF || bannedF || daysF || sortF)} onClear={() => { setRoleF(''); setBannedF(''); setDaysF(''); setSortF(''); }} />
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
      {list.data && list.data.items.length > 0 && <DataTable columns={columns} rows={list.data.items} rowKey={(u) => u.id} onRowClick={setView} rowLabel={(u) => `${t('admin.view')}: ${u.email}`} />}
      <DetailModal
        open={!!view}
        title={t('admin.detail.user')}
        subtitle={view?.email}
        icon={view?.isBanned ? 'ban' : 'users'}
        tone={view?.isBanned ? 'danger' : 'default'}
        infoLabel={t('admin.tab.info')}
        onClose={() => setView(null)}
        fields={
          view
            ? [
                { icon: 'user', label: t('admin.f.email'), value: view.email, copy: view.email },
                { icon: 'user', label: t('admin.f.name'), value: view.name || t('admin.f.none') },
                {
                  half: true,
                  icon: 'users',
                  label: t('admin.col.role'),
                  value: <Chip tone={view.role === 'USER' ? 'muted' : 'accent'}>{t(`role.${view.role}` as 'role.ADMIN')}</Chip>,
                  control:
                    view.id === me?.id ? undefined : (
                      <Select<Role>
                        variant="field"
                        icon="users"
                        label={t('admin.u.role')}
                        value={view.role}
                        options={roleOptions}
                        onChange={(r) => {
                          setAsk({ u: view, kind: 'role', role: r });
                          setView(null);
                        }}
                      />
                    ),
                },
                { half: true, icon: 'info', label: t('admin.col.status'), value: view.isBanned ? <Chip tone="danger">{t('admin.u.banned')}</Chip> : <Chip tone="ok">{t('admin.u.normal')}</Chip> },
                { half: true, icon: 'links', label: t('admin.col.links'), value: fmt.number(view.linkCount) },
                { half: true, icon: 'calendar', label: t('admin.col.joined'), value: when.format(new Date(view.createdAt)) },
                { half: true, icon: 'clock', label: t('admin.col.lastLogin'), value: view.lastLoginAt ? when.format(new Date(view.lastLoginAt)) : t('admin.u.never') },
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
              {view.id !== me?.id && (
                <button
                  type="button"
                  className={view.isBanned ? 'btn-ink' : 'btn-danger'}
                  onClick={() => {
                    setAsk({ u: view, kind: view.isBanned ? 'unban' : 'ban' });
                    setView(null);
                  }}
                >
                  <AdminIcon name={view.isBanned ? 'userCheck' : 'ban'} className="h-4 w-4" />
                  {view.isBanned ? t('admin.u.unban') : t('admin.u.ban')}
                </button>
              )}
            </>
          )
        }
      />
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
    </ListCard>
  );
}
