'use client';

import { useEffect, useState } from 'react';
import { AdminIcon, type AdminIconName } from '@/components/Icon';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n, type MsgKey } from '@/lib/i18n';
import type { AdminLink, AdminOverview, AuditEntry, Paged } from '@/lib/types';
import type { AdminTab } from './AdminShell';
import { Chip, DataTable } from './parts';

const TILES: Array<{ key: keyof AdminOverview; label: MsgKey; icon: AdminIconName; warn?: boolean }> = [
  { key: 'users', label: 'admin.ov.users', icon: 'users' },
  { key: 'links', label: 'admin.ov.links', icon: 'links' },
  { key: 'clicks', label: 'admin.ov.clicks', icon: 'clicks' },
  { key: 'bannedUsers', label: 'admin.ov.banned', icon: 'ban', warn: true },
  { key: 'adminDisabledLinks', label: 'admin.ov.adminDisabled', icon: 'linkOff', warn: true },
  { key: 'blockedDomains', label: 'admin.ov.domains', icon: 'domains', warn: true },
];

const STATUS_KEY = { ACTIVE: 'status.active', DISABLED: 'status.disabled', ADMIN_DISABLED: 'status.adminDisabled' } as const;

function Block({ title, onAll, children }: { title: string; onAll: () => void; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <section className="bento overflow-hidden" aria-label={title}>
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <h2 className="text-lg font-bold">{title}</h2>
        <button type="button" onClick={onAll} className="text-sm font-semibold text-accent hover:underline">
          {t('admin.seeAll')}
        </button>
      </div>
      {children}
    </section>
  );
}

// ภาพรวม: ตัวเลขสรุป + ลิงก์ล่าสุด + (ADMIN) กิจกรรมล่าสุด
export function OverviewPanel({ onTab }: { onTab: (t: AdminTab) => void }) {
  const { t, fmt, lang } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [data, setData] = useState<AdminOverview | null>(null);
  const [links, setLinks] = useState<AdminLink[] | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const when = new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  useEffect(() => {
    api<AdminOverview>('/api/admin/overview')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t('admin.loadFail')));
    api<Paged<AdminLink>>('/api/admin/links?pageSize=6')
      .then((d) => setLinks(d.items))
      .catch(() => setLinks([]));
    if (isAdmin) {
      api<Paged<AuditEntry>>('/api/admin/audit?pageSize=6')
        .then((d) => setAudit(d.items))
        .catch(() => setAudit([]));
    }
  }, [t, isAdmin]);

  if (error) return <p role="alert" className="py-6 text-center text-sm font-medium text-danger">{error}</p>;
  if (!data) return <p className="py-10 text-center text-muted">{t('admin.loading')}</p>;

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {TILES.map((tile) => {
          const v = data[tile.key];
          const warn = tile.warn && v > 0;
          return (
            <li key={tile.key} className="bento flex items-center gap-4 p-5">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${warn ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'}`}>
                <AdminIcon name={tile.icon} className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className={`text-2xl font-bold tabular-nums leading-tight ${warn ? 'text-danger' : ''}`}>{fmt.number(v)}</p>
                <p className="truncate text-sm text-muted">{t(tile.label)}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className={`grid gap-6 ${isAdmin ? '2xl:grid-cols-2' : ''}`}>
        <Block title={t('admin.recent.links')} onAll={() => onTab('links')}>
          {links && links.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-muted">{t('admin.recent.empty')}</p>
          ) : (
            links && (
              <DataTable
                rows={links}
                rowKey={(l) => l.id}
                columns={[
                  { id: 'short', header: t('admin.col.shortUrl'), cell: (l) => <span className="whitespace-nowrap font-mono text-[13px] font-semibold text-accent">{l.shortUrl.replace(/^https?:\/\//, '')}</span> },
                  { id: 'owner', header: t('admin.col.owner'), className: 'max-w-[10rem]', cell: (l) => <span className="block truncate text-muted">{l.ownerEmail ?? t('admin.l.guest')}</span> },
                  { id: 'status', header: t('admin.col.status'), cell: (l) => <Chip tone={l.status === 'ACTIVE' ? 'ok' : l.status === 'ADMIN_DISABLED' ? 'danger' : 'muted'}>{t(STATUS_KEY[l.status])}</Chip> },
                  { id: 'opens', header: t('admin.col.opens'), className: 'tabular-nums', cell: (l) => fmt.number(l.clickCount) },
                ]}
              />
            )
          )}
        </Block>

        {isAdmin && (
          <Block title={t('admin.recent.audit')} onAll={() => onTab('audit')}>
            {audit && audit.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-muted">{t('admin.recent.empty')}</p>
            ) : (
              audit && (
                <DataTable
                  rows={audit}
                  rowKey={(a) => a.id}
                  columns={[
                    { id: 'when', header: t('admin.col.when'), className: 'whitespace-nowrap text-muted', cell: (a) => <time dateTime={a.createdAt}>{when.format(new Date(a.createdAt))}</time> },
                    { id: 'action', header: t('admin.col.action'), cell: (a) => <span className="whitespace-nowrap font-medium">{t(`audit.${a.action}` as 'audit.USER_BAN')}</span> },
                    { id: 'actor', header: t('admin.col.actor'), className: 'max-w-[10rem]', cell: (a) => <span className="block truncate text-muted">{a.actorEmail || t('admin.a.system')}</span> },
                  ]}
                />
              )
            )}
          </Block>
        )}
      </div>
    </div>
  );
}
