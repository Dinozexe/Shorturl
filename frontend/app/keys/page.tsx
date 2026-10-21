'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Header } from '@/components/Header';
import { AdminIcon } from '@/components/Icon';
import { useLoginModal } from '@/components/LoginModal';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { ActionIcon } from '@/components/ui/ActionIcon';
import { Chip } from '@/components/ui/Chip';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { copyText } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

interface ApiKey {
  id: number;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  expired: boolean;
  createdAt: string;
}

interface KeyList {
  items: ApiKey[];
  max: number;
}

type Created = ApiKey & { key: string };

function CopyBox({ text, label }: { text: string; label: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [done, setDone] = useState(false);
  const copy = async () => {
    const ok = await copyText(text);
    setDone(ok);
    toast(ok ? t('common.copied') : t('common.copyFailedManual'));
    if (ok) setTimeout(() => setDone(false), 1500);
  };
  return (
    <div className="flex items-center gap-2 rounded-xl bg-ink/[0.05] py-2 pl-4 pr-2">
      <code className="min-w-0 flex-1 break-all font-mono text-sm">{text}</code>
      <ActionIcon icon={done ? 'check' : 'copy'} tone={done ? 'ok' : 'default'} label={label} onClick={copy} />
    </div>
  );
}

export default function KeysPage() {
  const router = useRouter();
  const toast = useToast();
  const { t, fmt } = useI18n();
  const { status, signedOut } = useAuth();
  const { openLogin } = useLoginModal();

  const [data, setData] = useState<KeyList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [days, setDays] = useState('90');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [revoke, setRevoke] = useState<ApiKey | null>(null);

  useEffect(() => {
    if (status === 'anon' && !signedOut) {
      router.replace('/');
      openLogin();
    }
  }, [status, signedOut, router, openLogin]);

  const load = useCallback(() => {
    setLoading(true);
    api<KeyList>('/api/keys')
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('keys.loadFail')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    if (status === 'authed') load();
  }, [status, load]);

  const expiryOptions = [
    { value: '30', label: t('keys.exp.30') },
    { value: '90', label: t('keys.exp.90') },
    { value: '365', label: t('keys.exp.365') },
    { value: '', label: t('keys.exp.never') },
  ];

  const openCreate = () => {
    setName('');
    setDays('90');
    setFormError(null);
    setCreated(null);
    setCreating(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setFormError(t('keys.nameEmpty'));
    setBusy(true);
    setFormError(null);
    try {
      const k = await api<Created>('/api/keys', { method: 'POST', body: { name: name.trim(), expiresInDays: days ? Number(days) : null } });
      setCreated(k);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('keys.createFail'));
    } finally {
      setBusy(false);
    }
  };

  const doRevoke = async () => {
    if (!revoke) return;
    await api(`/api/keys/${revoke.id}`, { method: 'DELETE' });
    setRevoke(null);
    toast(t('keys.revoked'));
    load();
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

  const full = !!data && data.items.length >= data.max;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6 sm:pt-10">
        <section className="bento p-5 sm:p-7" aria-labelledby="keys-heading">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                <AdminIcon name="lock" className="h-6 w-6" />
              </span>
              <div>
                <h1 id="keys-heading" className="text-xl font-bold tracking-tight">
                  {t('keys.title')}
                </h1>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">{t('keys.intro')}</p>
              </div>
            </div>
            <button type="button" className="btn-primary h-11 rounded-xl px-5" onClick={openCreate} disabled={full} title={full ? t('keys.full', { n: data?.max ?? 10 }) : undefined}>
              <AdminIcon name="plus" className="h-4 w-4" />
              {t('keys.create')}
            </button>
          </div>

          <div className="mt-5 grid gap-2 rounded-2xl bg-ink/[0.04] p-4 font-mono text-[13px] leading-relaxed">
            <p className="font-sans text-xs font-semibold text-muted">{t('keys.howto')}</p>
            <p>
              <span className="text-muted">$</span> surl login --token surl_…
            </p>
            <p>
              <span className="text-muted">$</span> surl shorten https://example.com/very/long/link
            </p>
            <p>
              <span className="text-muted">$</span> surl ls
            </p>
          </div>
        </section>

        <section className="bento mt-5" aria-labelledby="keys-list-heading">
          <div className="flex items-center justify-between px-5 pb-2 pt-5 sm:px-7 sm:pt-6">
            <h2 id="keys-list-heading" className="text-lg font-bold">
              {t('keys.list')}
              {data && <span className="ml-2 font-normal text-muted">{data.items.length}/{data.max}</span>}
            </h2>
          </div>
          <div className="px-2 pb-3 sm:px-3">
            {error && <ErrorState message={error} onRetry={load} busy={loading} />}
            {loading && !data && !error && <LoadingState text={t('keys.loading')} />}
            {data && data.items.length === 0 && <EmptyState icon="lock" title={t('keys.emptyTitle')} body={t('keys.emptyBody')} />}
            {data && data.items.length > 0 && (
              <ul className="flex flex-col gap-1">
                {data.items.map((k) => (
                  <li key={k.id} className="flex items-center gap-4 rounded-2xl px-3 py-3.5 transition-colors hover:bg-ink/[0.035] sm:px-4">
                    <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${k.expired ? 'bg-ink/[0.06] text-muted' : 'bg-accent/15 text-accent'}`}>
                      <AdminIcon name="lock" className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold">{k.name}</span>
                        {k.expired && <Chip>{t('keys.expired')}</Chip>}
                      </p>
                      <p className="mt-0.5 font-mono text-sm text-muted">{k.prefix}…</p>
                      <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted">
                        <span>{t('row.created', { d: fmt.date(k.createdAt) })}</span>
                        <span>{k.lastUsedAt ? t('keys.lastUsed', { d: fmt.date(k.lastUsedAt) }) : t('keys.neverUsed')}</span>
                        <span>{k.expiresAt ? t(k.expired ? 'row.expiredOn' : 'row.expires', { d: fmt.date(k.expiresAt) }) : t('keys.noExpiry')}</span>
                      </p>
                    </div>
                    <ActionIcon icon="trash" tone="danger" label={t('keys.revokeAria', { name: k.name })} onClick={() => setRevoke(k)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>

      <Modal open={creating} onClose={() => setCreating(false)} title={created ? t('keys.createdTitle') : t('keys.create')}>
        {created ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium leading-relaxed text-danger">{t('keys.once')}</p>
            <CopyBox text={created.key} label={t('keys.copyKey')} />
            <div>
              <p className="mb-1.5 text-sm font-medium">{t('keys.thenRun')}</p>
              <CopyBox text={`surl login --token ${created.key}`} label={t('keys.copyCmd')} />
            </div>
            <button type="button" className="btn-ink mx-auto h-11 px-8" onClick={() => setCreating(false)}>
              <AdminIcon name="check" className="h-4 w-4" />
              {t('keys.done')}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t('keys.name')}
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('keys.namePh')} maxLength={40} autoComplete="off" autoFocus />
              <span className="text-xs font-normal text-muted">{t('keys.nameHelp')}</span>
            </label>
            <div className="flex flex-col gap-1.5 text-sm font-medium">
              {t('keys.expires')}
              <Select<string> variant="field" icon="clock" label={t('keys.expires')} value={days} options={expiryOptions} onChange={setDays} />
            </div>
            {formError && (
              <p role="alert" className="text-sm font-medium text-danger">
                {formError}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className="btn h-11 justify-center" onClick={() => setCreating(false)}>
                <AdminIcon name="x" className="h-4 w-4" />
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn-ink h-11 justify-center" disabled={busy}>
                <AdminIcon name="plus" className="h-4 w-4" />
                {busy ? t('keys.creating') : t('keys.create')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={!!revoke}
        title={t('keys.revokeTitle')}
        body={t('keys.revokeBody')}
        detail={revoke ? `${revoke.name} · ${revoke.prefix}…` : undefined}
        confirmLabel={t('keys.revoke')}
        icon="trash"
        tone="danger"
        onConfirm={doRevoke}
        onClose={() => setRevoke(null)}
      />
    </>
  );
}
