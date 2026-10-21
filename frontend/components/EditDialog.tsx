'use client';

import { AdminIcon } from './Icon';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { isoToLocalInput, localInputToIso } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Link } from '@/lib/types';
import { Modal } from './Modal';
import { emptyProtection, ProtectionFields, protectionBody, protectionError, protectionOf, type Protection } from './ProtectionFields';

export function EditDialog({ link, onClose, onSaved }: { link: Link | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [url, setUrl] = useState('');
  const [expires, setExpires] = useState('');
  const [prot, setProt] = useState<Protection>(emptyProtection);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!link) return;
    setUrl(link.originalUrl);
    setExpires(isoToLocalInput(link.expiresAt));
    setProt(protectionOf(link));
    setError(null);
  }, [link]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!link) return;
    const bad = protectionError(prot);
    if (bad) {
      setError(t(bad));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/links/${link.id}`, {
        method: 'PATCH',
        body: { url: url.trim(), expiresAt: expires ? localInputToIso(expires) : null, ...protectionBody(prot, link) },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('edit.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!link} onClose={onClose} title={t('edit.title')} wide>
      {link && (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium">{t('edit.short')}</p>
            <p className="mt-1 break-all font-mono text-sm">{link.shortUrl}</p>
            <p className="mt-1 text-xs text-muted">{t('edit.aliasNote')}</p>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t('edit.dest')}
            <input className="field font-mono" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" spellCheck={false} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t('edit.expires')}
            <input className="field" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
            <span className="text-xs font-normal text-muted">{t('edit.expiresHelp')}</span>
          </label>
          <div className="border-t border-line pt-4">
            <ProtectionFields value={prot} onChange={setProt} hasPassword={link.hasPassword} />
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" className="btn-ink" disabled={busy || !url.trim()}>
              <AdminIcon name="check" className="h-4 w-4" />
              {busy ? t('edit.saving') : t('edit.save')}
            </button>
            <button type="button" className="btn" onClick={onClose}>
              <AdminIcon name="x" className="h-4 w-4" />
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
