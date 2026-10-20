'use client';

import { useLoginModal } from '@/components/LoginModal';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DeleteDialog } from '@/components/ConfirmDialog';
import { CreateForm } from '@/components/CreateForm';
import { EditDialog } from '@/components/EditDialog';
import { Header } from '@/components/Header';
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

const PAGE_SIZE = 10;

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const { t, fmt } = useI18n();
  const { status, signedOut } = useAuth();

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LinkPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const { openLogin } = useLoginModal();
  const [busyId, setBusyId] = useState<number | null>(null);

  const [created, setCreated] = useState<Link | null>(null);
  const [prefill, setPrefill] = useState<{ url: string; error: string } | null>(null);
  const pendingChecked = useRef(false);
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

  if (status !== 'authed') {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <p className="text-muted">{t('dash.checking')}</p>
        </main>
      </>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const isEmpty = data !== null && data.total === 0 && !debouncedQ;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6 sm:pt-10">
        <section className="card p-5 sm:p-7" aria-labelledby="create-heading">
          <h1 id="create-heading" className="text-2xl font-bold tracking-tight">
            {t('dash.newTitle')}
          </h1>
          <div className="mt-5">
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

        <section className="card mt-8" aria-labelledby="links-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-7">
            <h2 id="links-heading" className="text-lg font-bold">
              {t('dash.myLinks')}{data ? <>{' '}<span className="ml-1 font-normal text-muted">{t(data.total === 1 ? 'dash.countOne' : 'dash.count', { n: fmt.number(data.total) })}</span></> : null}
            </h2>
            {!isEmpty && (
              <label className="w-full sm:w-72">
                <span className="sr-only">{t('dash.searchLabel')}</span>
                <input className="field py-2" type="search" placeholder={t('dash.search')} value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
            )}
          </div>

          <div className="px-5 sm:px-7">
            {error && (
              <div role="alert" className="flex flex-wrap items-center gap-3 py-5 text-sm font-medium text-danger">
                {error}
                <button type="button" className="btn" onClick={refresh}>
                  {t('common.retry')}
                </button>
              </div>
            )}

            {loading && !data && <p className="py-8 text-muted">{t('dash.loadingList')}</p>}

            {isEmpty && (
              <div className="py-12 text-center">
                <p className="text-lg font-semibold">{t('dash.emptyTitle')}</p>
                <p className="mt-1 text-muted">{t('dash.emptyBody')}</p>
              </div>
            )}

            {data && data.total === 0 && debouncedQ && <p className="py-10 text-center text-muted">{t('dash.noMatch', { q: debouncedQ })}</p>}

            {data && data.items.length > 0 && (
              <ul className={`divide-y divide-line transition-opacity ${loading ? 'opacity-60' : ''}`}>
                {data.items.map((l) => (
                  <LinkRow key={l.id} link={l} onAction={onAction} busy={busyId === l.id} />
                ))}
              </ul>
            )}
          </div>

          {data && totalPages > 1 && (
            <nav aria-label={t('dash.pagesNav')} className="flex items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-7">
              <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t('dash.prev')}
              </button>
              <span className="text-sm text-muted">
                {t('dash.page', { p: page, n: totalPages })}
              </span>
              <button type="button" className="btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                {t('dash.next')}
              </button>
            </nav>
          )}
        </section>
      </main>

      <QrDialog link={qrLink} onClose={() => setQrLink(null)} />
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
