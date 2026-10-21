'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminIcon, type AdminIconName } from '@/components/Icon';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n, type MsgKey } from '@/lib/i18n';
import type { AdminOverview } from '@/lib/types';
import type { AdminTab } from './AdminShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { DailyChart } from '@/components/charts';
import { StatusDonut } from '@/components/ui/StatusDonut';

// ภาพรวม: ตัวเลขสรุป · กราฟเปิดลิงก์ 14 วัน · สถานะลิงก์ · ลิงก์ยอดนิยม · รายการต้องดูแล
export function OverviewPanel({ onTab }: { onTab: (t: AdminTab) => void }) {
  const { t, fmt } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<AdminOverview>('/api/admin/overview')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t('admin.loadFail')));
  }, [t]);

  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} className="bento" />;
  if (!data) return <LoadingState text={t('admin.loading')} />;

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
    // จอใหญ่ (lg+): ทั้งหน้าพอดีความสูงจอ ไม่ต้องเลื่อนลง (แถวการ์ดตัวเลขสูงตามเนื้อหา อีก 2 แถวแบ่งที่เหลือเท่ากัน); จอเล็กเรียงต่อกันตามปกติ
    <div className="flex flex-col gap-4 lg:grid lg:h-[calc(100svh-6rem)] lg:min-h-[34rem] lg:grid-cols-3 lg:grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)]">
      <ul className="grid gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <li key={k.label} className="bento flex items-center gap-4 p-4 lg:p-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <AdminIcon name={k.icon} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm text-muted">{k.label}</p>
              <p className="text-2xl font-bold leading-tight tabular-nums">{fmt.number(k.value)}</p>
              {k.sub && <p className="truncate text-xs font-semibold text-ok">{k.sub}</p>}
            </div>
          </li>
        ))}
      </ul>

      <section className="bento flex min-h-0 flex-col p-4 lg:col-span-2" aria-label={t('admin.ov.chart')}>
          <h2 className="mb-3 text-base font-bold">{t('admin.ov.chart')}</h2>
          <div className="min-h-0 flex-1">
            <DailyChart daily={data.daily} fill />
          </div>
        </section>

        <section className="bento flex min-h-0 flex-col p-4" aria-label={t('admin.ov.status')}>
          <h2 className="mb-3 text-base font-bold">{t('admin.ov.status')}</h2>
          <StatusDonut
            total={data.links}
            parts={[
              { label: t('status.active'), value: st.active, color: 'rgb(var(--ok))' },
              { label: t('status.disabled'), value: st.disabled, color: 'rgb(var(--muted))' },
              { label: t('status.adminDisabled'), value: st.adminDisabled, color: 'rgb(var(--danger))' },
            ]}
          />
        </section>

        <section className="bento flex min-h-0 flex-col overflow-hidden p-4 lg:col-span-2" aria-label={t('admin.ov.top')}>
          <h2 className="mb-3 text-base font-bold">{t('admin.ov.top')}</h2>
          {data.topLinks.length === 0 ? (
            <EmptyState compact icon="inbox" title={t('admin.ov.topEmpty')} />
          ) : (
            <ol className="flex min-h-0 flex-1 flex-col gap-3 lg:gap-4">
              {data.topLinks.map((l) => (
                <li key={l.id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-mono font-semibold text-accent">{l.shortUrl.replace(/^https?:\/\//, '')}</span>
                    <span className="shrink-0 text-muted tabular-nums">{t('admin.ov.opensN', { n: fmt.number(l.clickCount) })}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/[0.07] lg:mt-1" role="presentation">
                    <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent/70" style={{ width: `${Math.max(3, (l.clickCount / topMax) * 100)}%` }} />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted lg:hidden">{l.originalUrl}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="bento flex min-h-0 flex-col overflow-hidden p-4" aria-label={t('admin.ov.attention')}>
          <h2 className="mb-3 text-base font-bold">{t('admin.ov.attention')}</h2>
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
  );
}
