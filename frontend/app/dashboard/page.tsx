'use client';

import { useLoginModal } from '@/components/LoginModal';
import { PAGE_SIZE, Pager } from '@/components/ui/Pager';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageLoading } from '@/components/ui/PageLoading';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DeleteDialog } from '@/components/ConfirmDialog';
import { CreateForm } from '@/components/CreateForm';
import { EditDialog } from '@/components/EditDialog';
import { Header } from '@/components/Header';
import { AdminIcon, type AdminIconName } from '@/components/Icon';
import { LinkDetailDialog } from '@/components/LinkDetailDialog';
import { LinkRow, type RowAction } from '@/components/LinkRow';
import { QrDialog } from '@/components/QrDialog';
import { ResultStrip } from '@/components/ResultStrip';
import { StatsDialog } from '@/components/StatsDialog';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { takePendingUrl } from '@/lib/pending';
import type { Link, LinkPage } from '@/lib/types';

interface Summary {
  total: number;
  active: number;
  clicks: number;
}


export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const { t, fmt } = useI18n();
  const { status, signedOut, retry } = useAuth();

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LinkPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const { openLogin } = useLoginModal();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [created, setCreated] = useState<Link | null>(null);
  const [prefill, setPrefill] = useState<{ url: string; error: string } | null>(null);
  const pendingChecked = useRef(false);
  const [detailLink, setDetailLink] = useState<Link | null>(null);
  const [qrLink, setQrLink] = useState<Link | null>(null);
  const [statsLink, setStatsLink] = useState<Link | null>(null);
  const [editLink, setEditLink] = useState<Link | null>(null);
  const [deleteLink, setDeleteLink] = useState<Link | null>(null);

  useEffect(() => {
    // session หมดอายุ → ไปหน้าเข้าสู่ระบบ; แต่ถ้าผู้ใช้กดออกจากระบบเอง ปุ่มนั้นจะพาไปหน้าแรกเอง
    if (status === 'anon' && !signedOut) {
      router.replace('/');
      openLogin();
    }
  }, [status, signedOut, router, openLogin]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (status !== 'authed') return;
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (debouncedQ) params.set('q', debouncedQ);
    api<LinkPage>(`/api/links?${params}`)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : t('dash.loadFail')))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [status, page, debouncedQ, reload, t]);

  useEffect(() => {
    if (status !== 'authed') return;
    api<Summary>('/api/links/summary').then(setSummary).catch(() => {});
  }, [status, reload]);

  const refresh = useCallback(() => setReload((n) => n + 1), []);

  // ลิงก์ที่วางไว้ที่หน้าแรกก่อนล็อกอิน → ย่อให้ทันทีที่เข้ามา (ไม่สำเร็จก็เติมกลับในช่องพร้อมเหตุผล)
  useEffect(() => {
    if (status !== 'authed' || pendingChecked.current) return;
    pendingChecked.current = true;
    const pending = takePendingUrl();
    if (!pending) return;
    api<Link>('/api/links', { method: 'POST', body: { url: pending } })
      .then((l) => {
        setCreated(l);
        refresh();
      })
      .catch((e) => setPrefill({ url: pending, error: e instanceof Error ? e.message : t('dash.pendingFail') }));
  }, [status, refresh, t]);

  const onAction = async (action: RowAction, link: Link) => {
    if (action === 'view') return setDetailLink(link);
    if (action === 'qr') return setQrLink(link);
    if (action === 'stats') return setStatsLink(link);
    if (action === 'edit') return setEditLink(link);
    if (action === 'delete') return setDeleteLink(link);
    setBusyId(link.id);
    try {
      const next = link.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
      await api(`/api/links/${link.id}`, { method: 'PATCH', body: { status: next } });
      toast(next === 'ACTIVE' ? t('dash.enabled') : t('dash.disabled'));
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : t('dash.statusFail'));
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (link: Link) => {
    await api(`/api/links/${link.id}`, { method: 'DELETE' });
    setDeleteLink(null);
    if (created?.id === link.id) setCreated(null);
    toast(t('dash.deleted'));
    // ลบแถวสุดท้ายของหน้าที่ไม่ใช่หน้าแรก → ถอยไปหน้าก่อนหน้า
    if (data && data.items.length === 1 && page > 1) setPage(page - 1);
    else refresh();
  };

  if (status === 'offline') {
    return (
      <>
        <Header />
        <main className="mx-auto flex min-h-[70svh] max-w-5xl items-center justify-center px-4 sm:px-6">
          <ErrorState title={t('wake.offlineTitle')} message={t('wake.offlineBody')} onRetry={retry} />
        </main>
      </>
    );
  }

  if (status !== 'authed') {
    return (
      <>
        <Header />
        <PageLoading text={t('dash.checking')} />
      </>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const isEmpty = data !== null && data.total === 0 && !debouncedQ;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6 sm:pt-10">
        <h1 className="sr-only">{t('dash.myLinks')}</h1>

        <section className="bento p-5 sm:p-7" aria-labelledby="create-heading">
          <h2 id="create-heading" className="text-xl font-bold tracking-tight">
            {t('dash.newTitle')}
          </h2>
          <div className="mt-4">
            <CreateForm
              prefill={prefill}
              onCreated={(l) => {
                setCreated(l);
                setQ('');
                setPage(1);
                refresh();
              }}
            />
          </div>
        </section>

        {created && (
          <div className="mt-5">
            <ResultStrip link={created} onQr={setQrLink} onDismiss={() => setCreated(null)} />
          </div>
        )}

        <dl className="mt-5 grid grid-cols-3 gap-3 sm:gap-4">
          {([
            { icon: 'links', label: t('dash.sum.total'), value: summary?.total },
            { icon: 'power', label: t('dash.sum.active'), value: summary?.active },
            { icon: 'clicks', label: t('dash.sum.clicks'), value: summary?.clicks },
          ] as Array<{ icon: AdminIconName; label: string; value?: number }>).map((x) => (
            <div key={x.label} className="bento flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <AdminIcon name={x.icon} className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <dd className="text-2xl font-bold leading-none tabular-nums sm:text-3xl">{x.value === undefined ? '–' : fmt.number(x.value)}</dd>
                <dt className="mt-1.5 truncate text-xs text-muted sm:text-sm">{x.label}</dt>
              </div>
            </div>
          ))}
        </dl>

        <section className="bento mt-5" aria-labelledby="links-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-7 sm:pt-6">
            <h2 id="links-heading" className="text-lg font-bold">
              {t('dash.myLinks')}{data ? <>{' '}<span className="ml-1 font-normal text-muted">{t(data.total === 1 ? 'dash.countOne' : 'dash.count', { n: fmt.number(data.total) })}</span></> : null}
            </h2>
            {!isEmpty && (
              <label className="relative w-full sm:w-72">
                <span className="sr-only">{t('dash.searchLabel')}</span>
                <AdminIcon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input className="field rounded-xl bg-ink/[0.035] py-2.5 pl-10" type="search" placeholder={t('dash.search')} value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
            )}
          </div>

          <div className="px-2 pb-2 sm:px-3">
            {error && <ErrorState message={error} onRetry={refresh} busy={loading} />}

            {loading && !data && !error && <LoadingState text={t('dash.loadingList')} />}

            {isEmpty && <EmptyState icon="links" title={t('dash.emptyTitle')} body={t('dash.emptyBody')} />}

            {data && data.total === 0 && debouncedQ && (
              <EmptyState
                icon="search"
                title={t('dash.noMatch', { q: debouncedQ })}
                action={
                  <button type="button" className="btn" onClick={() => setQ('')}>
                    {t('dash.clearSearch')}
                  </button>
                }
              />
            )}

            {data && data.items.length > 0 && (
              <ul className={`flex flex-col gap-1 transition-opacity ${loading ? 'opacity-60' : ''}`}>
                {data.items.map((l) => (
                  <LinkRow key={l.id} link={l} onAction={onAction} busy={busyId === l.id} />
                ))}
              </ul>
            )}
          </div>

          {data && data.total > 0 && <Pager page={page} totalPages={totalPages} total={data.total} onPage={setPage} />}
        </section>
      </main>

      <LinkDetailDialog link={detailLink} onClose={() => setDetailLink(null)} onAction={onAction} />
      <QrDialog link={qrLink} onClose={() => setQrLink(null)} onSaved={refresh} />
      <StatsDialog link={statsLink} onClose={() => setStatsLink(null)} />
      <EditDialog
        link={editLink}
        onClose={() => setEditLink(null)}
        onSaved={() => {
          setEditLink(null);
          toast(t('dash.saved'));
          refresh();
        }}
      />
      <DeleteDialog link={deleteLink} onClose={() => setDeleteLink(null)} onConfirm={onDelete} />
    </>
  );
}
