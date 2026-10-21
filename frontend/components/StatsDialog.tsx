'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AdminIcon } from './Icon';
import { ErrorState } from './ui/ErrorState';
import { LoadingState } from './ui/LoadingState';
import { useI18n } from '@/lib/i18n';
import type { Link, StatsResponse } from '@/lib/types';
import { Breakdown, DailyChart } from './charts';
import { Modal } from './Modal';

const RANGES = [7, 30, 90];

export function StatsBody({ link, basePath = '/api/links' }: { link: Link; basePath?: string }) {
  const { t, fmt } = useI18n();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api<StatsResponse>(`${basePath}/${link.id}/stats?days=${days}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t('stats.loadFail')))
      .finally(() => setLoading(false));
  }, [link, days, t, basePath]);

  useEffect(() => {
    setData(null);
  }, [link.id]);

  useEffect(load, [load]);

  const referrerLabel = (k: string | null) => (k ? k.replace(/^https?:\/\//, '') : t('stats.direct'));
  const countryLabel = (k: string | null) => (k ? fmt.country(k) : t('stats.unknown'));
  const deviceLabel = (k: string | null) => t(`device.${k ?? 'unknown'}` as 'device.unknown');
  const plainLabel = (k: string | null) => k ?? t('stats.unknown');

  const tiles = data && !('unavailable' in data)
    ? [
        { icon: 'clicks' as const, value: data.total, label: t('stats.total') },
        { icon: 'calendar' as const, value: data.windowClicks, label: t('stats.inWindow', { n: data.days }) },
        { icon: 'user' as const, value: data.uniqueVisitors, label: t('stats.unique') },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      {/* ช่วงเวลา: ปุ่มเลือกแบบแบ่งช่อง */}
      <div role="radiogroup" aria-label={t('stats.range')} className="grid grid-cols-3 gap-1 rounded-xl bg-ink/[0.06] p-1">
        {RANGES.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={days === r} onClick={() => setDays(r)} className={`rounded-lg py-2 text-sm font-semibold transition-colors ${days === r ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
            {t('stats.lastDays', { n: r })}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={load} busy={loading} className="rounded-2xl bg-ink/[0.03]" />}
      {loading && !data && !error && <LoadingState text={t('stats.loading')} />}

      {data && 'unavailable' in data && <ErrorState title={t('stats.unavailableTitle')} message={t('stats.unavailableBody', { n: fmt.number(data.total) })} onRetry={load} busy={loading} className="rounded-2xl bg-ink/[0.03]" />}

      {data && !('unavailable' in data) && (
        <>
          <dl className="grid grid-cols-3 gap-2.5">
            {tiles.map((x) => (
              <div key={x.label} className="rounded-2xl bg-ink/[0.04] px-4 py-3.5">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <AdminIcon name={x.icon} className="h-3.5 w-3.5" />
                  <span className="truncate">{x.label}</span>
                </dt>
                <dd className="mt-1.5 text-2xl font-bold leading-none tabular-nums">{fmt.number(x.value)}</dd>
              </div>
            ))}
          </dl>

          <div className="rounded-2xl border border-line p-4">
            <DailyChart daily={data.daily} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Breakdown title={t('stats.referrers')} icon="links" items={data.referers} label={referrerLabel} />
            <Breakdown title={t('stats.countries')} icon="globe" items={data.countries} label={countryLabel} />
            <Breakdown title={t('stats.devices')} icon="device" items={data.devices} label={deviceLabel} />
            <Breakdown title={t('stats.os')} icon="monitor" items={data.os} label={plainLabel} />
            <Breakdown title={t('stats.browsers')} icon="browser" items={data.browsers} label={plainLabel} />
          </div>
        </>
      )}
    </div>
  );
}

export function StatsDialog({ link, onClose, basePath = '/api/links' }: { link: Link | null; onClose: () => void; basePath?: string }) {
  const { t } = useI18n();
  return (
    <Modal open={!!link} onClose={onClose} title={t('stats.title')} wide>
      {link && (
        <div className="flex flex-col gap-4">
          <p className="-mt-3 break-all font-mono text-sm text-muted">{link.shortUrl}</p>
          <StatsBody link={link} basePath={basePath} />
        </div>
      )}
    </Modal>
  );
}
