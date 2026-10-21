'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminIcon, type AdminIconName } from '@/components/Icon';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n, type MsgKey } from '@/lib/i18n';
import type { AdminLink, AdminOverview, AuditEntry, Paged } from '@/lib/types';
import type { AdminTab } from './AdminShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Chip } from '@/components/ui/Chip';
import { DataTable } from '@/components/ui/DataTable';
import { DailyChart } from '@/components/charts';
import { StatusDonut } from '@/components/ui/StatusDonut';

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

// ภาพรวม: ทักทาย · ตัวเลขสรุป · กราฟเปิดลิงก์ 14 วัน · สถานะลิงก์ · ลิงก์ยอดนิยม · รายการต้องดูแล · ลิงก์ล่าสุด · (ADMIN) กิจกรรมล่าสุด
export function OverviewPanel({ onTab }: { onTab: (t: AdminTab) => void }) {
  const { t, fmt, lang } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [data, setData] = useState<AdminOverview | null>(null);
  const [links, setLinks] = useState<AdminLink[] | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const when = new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  const load = useCallback(() => {
    setError(null);
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

  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} className="bento" />;
  if (!data) return <LoadingState text={t('admin.loading')} />;

  const name = user?.name || user?.email.split('@')[0] || '';
  const st = data.linksByStatus;
  const topMax = Math.max(1, ...data.topLinks.map((l) => l.clickCount));
  const kpis: Array<{ label: string; value: number; icon: AdminIconName; sub?: string }> = [
    { label: t('admin.ov.users'), value: data.users, icon: 'users', sub: t('admin.ov.new7', { n: fmt.number(data.newUsers7d) }) },
    { label: t('admin.ov.links'), value: data.links, icon: 'links', sub: t('admin.ov.new7', { n: fmt.number(data.newLinks7d) }) },
    { label: t('admin.ov.clicks'), value: data.clicks, icon: 'clicks' },
    { label: t('admin.ov.domains'), value: data.blockedDomains, icon: 'domains' },
  ];
  const attention: Array<{ label: string; value: number; tab: AdminTab; icon: AdminIconName; show: boolean }> = [
    { label: t('admin.ov.banned'), value: data.bannedUsers, tab: 'users', icon: 'ban', show: isAdmin },
    { label: t('admin.ov.adminDisabled'), value: data.adminDisabledLinks, tab: 'links', icon: 'linkOff', show: true },
  ];
  const todo = attention.filter((a) => a.show && a.value > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="-mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-lg font-bold">{t('admin.ov.hello', { name })}</p>
          <p className="text-sm text-muted">{t('admin.ov.sub')}</p>
        </div>
        <p className="flex items-center gap-2 rounded-xl bg-surface px-3.5 py-2 text-sm font-medium ring-1 ring-line">
          <AdminIcon name="calendar" className="h-4 w-4 text-muted" />
          {new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'long' }).format(new Date())}
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <li key={k.label} className="bento flex items-center gap-4 p-5">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <AdminIcon name={k.icon} className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm text-muted">{k.label}</p>
              <p className="text-3xl font-bold leading-tight tabular-nums">{fmt.number(k.value)}</p>
              {k.sub && <p className="truncate text-xs font-semibold text-ok">{k.sub}</p>}
            </div>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="bento p-5 lg:col-span-2" aria-label={t('admin.ov.chart')}>
          <h2 className="mb-4 text-lg font-bold">{t('admin.ov.chart')}</h2>
          <DailyChart daily={data.daily} />
        </section>

        <section className="bento p-5" aria-label={t('admin.ov.status')}>
          <h2 className="mb-4 text-lg font-bold">{t('admin.ov.status')}</h2>
          <StatusDonut
            total={data.links}
            parts={[
              { label: t('status.active'), value: st.active, color: 'rgb(var(--ok))' },
              { label: t('status.disabled'), value: st.disabled, color: 'rgb(var(--muted))' },
              { label: t('status.adminDisabled'), value: st.adminDisabled, color: 'rgb(var(--danger))' },
            ]}
          />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="bento p-5 lg:col-span-2" aria-label={t('admin.ov.top')}>
          <h2 className="mb-4 text-lg font-bold">{t('admin.ov.top')}</h2>
          {data.topLinks.length === 0 ? (
            <EmptyState compact icon="inbox" title={t('admin.ov.topEmpty')} />
          ) : (
            <ol className="flex flex-col gap-4">
              {data.topLinks.map((l) => (
                <li key={l.id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-mono font-semibold text-accent">{l.shortUrl.replace(/^https?:\/\//, '')}</span>
                    <span className="shrink-0 text-muted tabular-nums">{t('admin.ov.opensN', { n: fmt.number(l.clickCount) })}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/[0.07]" role="presentation">
                    <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent/70" style={{ width: `${Math.max(3, (l.clickCount / topMax) * 100)}%` }} />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted">{l.originalUrl}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="bento p-5" aria-label={t('admin.ov.attention')}>
          <h2 className="mb-4 text-lg font-bold">{t('admin.ov.attention')}</h2>
          {todo.length === 0 ? (
            <EmptyState compact icon="check" title={t('admin.ov.attentionOk')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {todo.map((a) => (
                <li key={a.tab}>
                  <button type="button" onClick={() => onTab(a.tab)} className="flex w-full items-center gap-3 rounded-2xl bg-danger/[0.07] px-3.5 py-3 text-left outline-none transition-colors hover:bg-danger/[0.12] focus-visible:ring-2 focus-visible:ring-accent">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger">
                      <AdminIcon name={a.icon} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{a.label}</span>
                      <span className="text-xl font-bold tabular-nums text-danger">{fmt.number(a.value)}</span>
                    </span>
                    <AdminIcon name="chevron" className="h-4 w-4 shrink-0 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className={`grid gap-6 ${isAdmin ? '2xl:grid-cols-2' : ''}`}>
        <Block title={t('admin.recent.links')} onAll={() => onTab('links')}>
          {links && links.length === 0 ? (
            <EmptyState compact icon="inbox" title={t('admin.recent.empty')} />
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
              <EmptyState compact icon="inbox" title={t('admin.recent.empty')} />
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
