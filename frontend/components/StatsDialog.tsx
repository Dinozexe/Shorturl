'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Link, StatsResponse } from '@/lib/types';
import { Breakdown, DailyChart } from './charts';
import { Modal } from './Modal';

const RANGES = [7, 30, 90];

export function StatsDialog({ link, onClose }: { link: Link | null; onClose: () => void }) {
  const { t, fmt } = useI18n();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!link) return;
    setLoading(true);
    setError(null);
    api<StatsResponse>(`/api/links/${link.id}/stats?days=${days}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t('stats.loadFail')))
      .finally(() => setLoading(false));
  }, [link, days, t]);

  useEffect(() => {
    setData(null);
  }, [link]);

  useEffect(load, [load]);

  const referrerLabel = (k: string | null) => (k ? k.replace(/^https?:\/\//, '') : t('stats.direct'));
  const countryLabel = (k: string | null) => (k ? fmt.country(k) : t('stats.unknown'));
  const deviceLabel = (k: string | null) => t(`device.${k ?? 'unknown'}` as 'device.unknown');
  const plainLabel = (k: string | null) => k ?? t('stats.unknown');

  return (
    <Modal open={!!link} onClose={onClose} title={t('stats.title')} wide>
      {link && (
        <div className="flex flex-col gap-6">
          <p className="-mt-3 break-all font-mono text-sm text-muted">{link.shortUrl}</p>

          <div role="group" aria-label={t('stats.range')} className="flex gap-2">
            {RANGES.map((r) => (
              <button key={r} type="button" onClick={() => setDays(r)} aria-pressed={days === r} className={`btn ${days === r ? 'border-ink bg-ink text-paper hover:border-ink' : ''}`}>
                {t('stats.lastDays', { n: r })}
              </button>
            ))}
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          {loading && !data && <p className="text-sm text-muted">{t('stats.loading')}</p>}

          {data && 'unavailable' in data && (
            <div className="rounded-md border border-line bg-surface p-4">
              <p className="font-semibold">{t('stats.unavailableTitle')}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t('stats.unavailableBody', { n: fmt.number(data.total) })}</p>
              <button type="button" className="btn mt-3" onClick={load} disabled={loading}>
                {t('common.retry')}
              </button>
            </div>
          )}

          {data && !('unavailable' in data) && (
            <>
              <dl className="grid grid-cols-3 gap-4 border-y border-line py-4">
                <div>
                  <dd className="text-3xl font-bold leading-none">{fmt.number(data.total)}</dd>
                  <dt className="mt-1.5 text-xs text-muted">{t('stats.total')}</dt>
                </div>
                <div>
                  <dd className="text-3xl font-bold leading-none">{fmt.number(data.windowClicks)}</dd>
                  <dt className="mt-1.5 text-xs text-muted">{t('stats.inWindow', { n: data.days })}</dt>
                </div>
                <div>
                  <dd className="text-3xl font-bold leading-none">{fmt.number(data.uniqueVisitors)}</dd>
                  <dt className="mt-1.5 text-xs text-muted">{t('stats.unique')}</dt>
                </div>
              </dl>

              <DailyChart daily={data.daily} />

              <div className="grid gap-6 sm:grid-cols-2">
                <Breakdown title={t('stats.referrers')} items={data.referers} label={referrerLabel} />
                <Breakdown title={t('stats.countries')} items={data.countries} label={countryLabel} />
                <Breakdown title={t('stats.devices')} items={data.devices} label={deviceLabel} />
                <Breakdown title={t('stats.os')} items={data.os} label={plainLabel} />
                <Breakdown title={t('stats.browsers')} items={data.browsers} label={plainLabel} />
              </div>

              <p className="text-xs leading-relaxed text-muted">{t('stats.note')}</p>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
