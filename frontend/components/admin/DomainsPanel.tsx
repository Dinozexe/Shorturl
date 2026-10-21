'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useToast } from '@/components/Toast';
import { AdminIcon } from '@/components/Icon';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { DetailModal } from '@/components/ui/DetailModal';
import { api } from '@/lib/api';
import { useI18n, type MsgKey } from '@/lib/i18n';
import type { BlockedDomain, DomainPreview } from '@/lib/types';
import { Select } from '@/components/ui/Select';
import { ActionIcon } from '@/components/ui/ActionIcon';
import { ClearFilters, dayOptions } from '@/components/ui/FilterBar';
import { DataTable } from '@/components/ui/DataTable';
import { ListCard } from '@/components/ui/ListCard';
import { useAdminList } from './useAdminList';

const QUICK = ['spam', 'phishing', 'malware', 'abuse'] as const;

// หน้าโดเมนที่บล็อก: ตารางอยู่ซ้าย (กว้าง) · ฟอร์มบล็อกอยู่ขวา พร้อมแสดงผลกระทบก่อนกดบล็อกว่าจะปิดลิงก์เดิมกี่รายการ
export function DomainsPanel() {
  const { t, fmt, lang } = useI18n();
  const when = new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const [view, setView] = useState<BlockedDomain | null>(null);
  const toast = useToast();
  const [daysF, setDaysF] = useState('');
  const list = useAdminList<BlockedDomain>('/api/admin/blocked-domains', daysF ? { days: daysF } : {});
  const [domain, setDomain] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DomainPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [askBlock, setAskBlock] = useState(false);
  const [askUnblock, setAskUnblock] = useState<BlockedDomain | null>(null);

  // ตรวจผลกระทบอัตโนมัติเมื่อพิมพ์โดเมน (หน่วง 450 ms)
  useEffect(() => {
    const d = domain.trim();
    setPreview(null);
    if (d.length < 3) return setChecking(false);
    setChecking(true);
    let alive = true;
    const id = setTimeout(() => {
      api<DomainPreview>(`/api/admin/blocked-domains/preview?domain=${encodeURIComponent(d)}`)
        .then((p) => alive && setPreview(p))
        .catch(() => alive && setPreview(null))
        .finally(() => alive && setChecking(false));
    }, 450);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [domain]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return setError(t('admin.d.need'));
    setError(null);
    setAskBlock(true);
  };

  const add = async () => {
    const r = await api<{ disabledLinks: number }>('/api/admin/blocked-domains', { method: 'POST', body: { domain: domain.trim(), reason: reason.trim() || undefined } });
    toast(t('admin.d.done', { n: r.disabledLinks }));
    setDomain('');
    setReason('');
    setAskBlock(false);
    list.reload();
  };

  const unblock = async () => {
    if (!askUnblock) return;
    await api(`/api/admin/blocked-domains/${askUnblock.id}`, { method: 'DELETE' });
    toast(t('admin.d.unblocked'));
    setAskUnblock(null);
    list.reload();
  };

  const impact = checking ? (
    <p className="flex items-center gap-2 text-[13px] text-muted">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden="true" />
      {t('admin.d.preview.checking')}
    </p>
  ) : preview ? (
    preview.alreadyBlocked ? (
      <p className="flex items-center gap-2 text-[13px] font-medium text-muted">
        <AdminIcon name="check" className="h-3.5 w-3.5" />
        {t('admin.d.preview.already')}
      </p>
    ) : preview.willDisable > 0 ? (
      <p className="flex items-center gap-2 text-[13px] font-semibold text-danger">
        <AdminIcon name="linkOff" className="h-3.5 w-3.5" />
        {t('admin.d.preview.n', { n: fmt.number(preview.willDisable) })}
      </p>
    ) : (
      <p className="text-[13px] text-muted">{t('admin.d.preview.none')}</p>
    )
  ) : (
    <p className="text-[13px] text-muted">{t('admin.d.hint')}</p>
  );

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} noValidate aria-label={t('admin.d.formTitle')} className="bento p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10 text-danger">
            <AdminIcon name="domains" className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-bold">{t('admin.d.formTitle')}</h2>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]">
          <label className="relative block">
            <span className="sr-only">{t('admin.d.domain')}</span>
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
            </svg>
            <input
              className="h-11 w-full rounded-xl bg-ink/[0.05] pl-10 pr-3 font-mono text-sm outline-none placeholder:font-sans placeholder:text-muted/70 focus:ring-2 focus:ring-accent"
              placeholder={t('admin.d.domain')}
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value);
                setError(null);
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="block">
            <span className="sr-only">{t('admin.d.reason')}</span>
            <input className="h-11 w-full rounded-xl bg-ink/[0.05] px-3.5 text-sm outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-accent" placeholder={t('admin.d.reason')} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} autoComplete="off" />
          </label>
          <button type="submit" className="btn-danger h-11 px-6 !border-0 !bg-danger !font-semibold !text-white hover:!opacity-90">
            <AdminIcon name="domains" className="h-4 w-4" />
            {t('admin.d.submit')}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-h-[1.25rem] min-w-0 flex-1 basis-72" aria-live="polite">
            {error ? (
              <p role="alert" className="text-[13px] font-medium text-danger">
                {error}
              </p>
            ) : (
              impact
            )}
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('admin.d.reasonQuick')}>
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => setReason(t(`admin.d.r.${q}` as MsgKey))} className="rounded-full bg-ink/[0.05] px-3 py-1 text-xs font-medium text-ink/80 transition-colors hover:bg-ink/[0.09]">
                {t(`admin.d.r.${q}` as MsgKey)}
              </button>
            ))}
          </div>
        </div>
      </form>

      <div className="min-w-0">
        <ListCard
          title={t('admin.tab.domains')}
          total={list.data?.total ?? null}
          controls={<input className="field h-9 w-full text-ellipsis py-0 text-sm sm:w-52 xl:w-60" type="search" aria-label={t('admin.d.search')} placeholder={t('admin.d.search')} value={list.q} onChange={(e) => list.setQ(e.target.value)} />}
          filters={
            <>
              <Select<string> label={t('admin.fl.period')} value={daysF} options={dayOptions(t)} onChange={setDaysF} className="w-auto" />
              <ClearFilters active={!!daysF} onClear={() => setDaysF('')} />
            </>
          }
          error={list.error}
          onRetry={list.reload}
          loading={list.loading}
          empty={false}
          emptyText=""
          page={list.page}
          totalPages={list.totalPages}
          onPage={list.setPage}
        >
          {list.data && list.data.items.length === 0 && <EmptyState icon="domains" title={list.debouncedQ ? t('admin.empty') : t('admin.d.empty')} body={list.debouncedQ ? undefined : t('admin.d.emptyHint')} />}
          {list.data && list.data.items.length > 0 && (
            <DataTable
              rows={list.data.items}
              rowKey={(d) => d.id}
              onRowClick={setView}
              rowLabel={(d) => `${t('admin.view')}: ${d.domain}`}
              columns={[
                {
                  id: 'domain',
                  header: t('admin.col.domain'),
                  cell: (d) => (
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
                        <AdminIcon name="domains" className="h-[18px] w-[18px]" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[13px] font-semibold">{d.domain}</p>
                        <p className="text-xs text-muted">{t('admin.d.subs')}</p>
                      </div>
                    </div>
                  ),
                },
                { id: 'reason', header: t('admin.col.reason'), className: 'max-w-[14rem]', cell: (d) => (d.reason ? <span className="inline-block max-w-full truncate rounded-full bg-ink/[0.06] px-2.5 py-0.5 align-middle text-xs font-medium" title={d.reason}>{d.reason}</span> : <span className="text-muted">—</span>) },
                { id: 'matched', header: t('admin.d.col.matched'), className: 'tabular-nums', cell: (d) => fmt.number(d.linkCount) },
                { id: 'off', header: t('admin.d.col.off'), className: 'tabular-nums', cell: (d) => (d.disabledCount > 0 ? <span className="font-semibold text-danger">{fmt.number(d.disabledCount)}</span> : <span className="text-muted">0</span>) },
                {
                  id: 'when',
                  header: t('admin.col.created'),
                  className: 'whitespace-nowrap',
                  cell: (d) => (
                    <div className="leading-tight">
                      <p className="text-muted">{fmt.date(d.createdAt)}</p>
                      {d.createdByEmail && <p className="max-w-[10rem] truncate text-xs text-muted/80" title={d.createdByEmail}>{d.createdByEmail}</p>}
                    </div>
                  ),
                },
                { id: 'actions', header: t('admin.col.actions'), className: 'w-24', cell: (d) => (
                    <div className="flex items-center gap-0.5">
                      <ActionIcon icon="eye" label={t('admin.view')} onClick={() => setView(d)} />
                      <ActionIcon icon="unlock" label={t('admin.d.unblock')} onClick={() => setAskUnblock(d)} />
                    </div>
                  ),
                },
              ]}
            />
          )}
        </ListCard>
      </div>

      <DetailModal
        open={!!view}
        title={t('admin.detail.domain')}
        subtitle={view?.domain}
        icon="domains"
        tone="danger"
        infoLabel={t('admin.tab.info')}
        onClose={() => setView(null)}
        fields={
          view
            ? [
                { icon: 'globe', label: t('admin.col.domain'), value: view.domain, copy: view.domain, mono: true },
                { icon: 'info', label: t('admin.col.reason'), value: view.reason || t('admin.f.none') },
                { half: true, icon: 'links', label: t('admin.d.col.matched'), value: fmt.number(view.linkCount) },
                { half: true, icon: 'linkOff', label: t('admin.d.col.off'), value: fmt.number(view.disabledCount) },
                { icon: 'user', label: t('admin.col.by'), value: view.createdByEmail || t('admin.f.none') },
                { half: true, icon: 'calendar', label: t('admin.col.created'), value: when.format(new Date(view.createdAt)) },
              ]
            : []
        }
        footer={
          view && (
            <button type="button" className="btn" onClick={() => { setAskUnblock(view); setView(null); }}>
              <AdminIcon name="unlock" className="h-4 w-4" />
              {t('admin.d.unblock')}
            </button>
          )
        }
      />
      <ConfirmModal
        open={askBlock}
        title={t('admin.c.block.title')}
        body={preview && !preview.alreadyBlocked && preview.willDisable > 0 ? `${t('admin.d.preview.n', { n: fmt.number(preview.willDisable) })} · ${t('admin.c.block.body')}` : t('admin.c.block.body')}
        detail={domain.trim()}
        confirmLabel={t('admin.d.submit')}
        icon="domains"
        tone="danger"
        onConfirm={add}
        onClose={() => setAskBlock(false)}
      />
      <ConfirmModal open={!!askUnblock} title={t('admin.c.unblock.title')} body={t('admin.c.unblock.body')} detail={askUnblock?.domain} confirmLabel={t('admin.d.unblock')} icon="unlock" onConfirm={unblock} onClose={() => setAskUnblock(null)} />
    </div>
  );
}
