'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, warmShortLink } from '@/lib/api';
import { localInputToIso } from '@/lib/format';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { useI18n } from '@/lib/i18n';
import { useSlowHint } from '@/lib/useSlowHint';
import type { Link } from '@/lib/types';
import { LinkBar } from './LinkBar';
import { emptyProtection, ProtectionFields, protectionBody, protectionError, type Protection } from './ProtectionFields';

export function CreateForm({ onCreated, prefill }: { onCreated: (link: Link) => void; prefill?: { url: string; error: string } | null }) {
  const { t } = useI18n();
  const [url, setUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [expires, setExpires] = useState('');
  const [prot, setProt] = useState<Protection>(emptyProtection);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const slow = useSlowHint(busy);

  // ลิงก์ที่วางไว้จากหน้าแรกแล้วย่อไม่สำเร็จ: เติมกลับในช่องพร้อมเหตุผล ให้แก้แล้วลองใหม่ได้
  useEffect(() => {
    if (!prefill) return;
    setUrl(prefill.url);
    setError(prefill.error);
  }, [prefill]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!url.trim()) {
      setError(t('hero.empty'));
      return;
    }
    const bad = protectionError(prot);
    if (bad) {
      setError(t(bad));
      return;
    }
    setBusy(true);
    try {
      const link = await api<Link>('/api/links', {
        method: 'POST',
        body: { url: url.trim(), alias: alias.trim() || undefined, expiresAt: localInputToIso(expires), ...protectionBody(prot) },
      });
      setUrl('');
      setAlias('');
      setExpires('');
      setProt(emptyProtection);
      warmShortLink(link.shortUrl); // ปลุก redirect-service ไว้ล่วงหน้า
      onCreated(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('create.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate aria-label={t('create.aria')}>
      <LinkBar
        value={url}
        onChange={setUrl}
        placeholder={t('hero.placeholder')}
        label={t('hero.label')}
        submit={busy ? t('create.submitting') : t('hero.submit')}
        disabled={busy}
        invalid={!!error}
        describedBy={error ? 'create-error' : undefined}
      />

      <details className="mt-3">
        <summary className="inline-block cursor-pointer text-sm font-medium text-muted hover:text-ink">{t('create.more')}</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t('create.alias')}
            <input className="field font-mono" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder={t('create.aliasPh')} autoComplete="off" spellCheck={false} maxLength={30} />
            <span className="text-xs font-normal text-muted">{t('create.aliasHelp')}</span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t('create.expires')}
            <DateTimePicker label={t('create.expires')} value={expires} onChange={setExpires} defaultTime="23:59" />
            <span className="text-xs font-normal text-muted">{t('create.expiresHelp')}</span>
          </label>
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <ProtectionFields value={prot} onChange={setProt} />
        </div>
      </details>

      {busy && slow && (
        <p role="status" className="mt-3 text-sm text-muted">
          {t('wake.hint')}
        </p>
      )}

      {error && (
        <p id="create-error" role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
