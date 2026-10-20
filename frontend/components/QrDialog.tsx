'use client';

import { useEffect, useState } from 'react';
import { apiBlob } from '@/lib/api';
import { copyText } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Link } from '@/lib/types';
import { Modal } from './Modal';
import { useToast } from './Toast';

const SIZES = [
  { key: 'qr.small', scale: 6 },
  { key: 'qr.medium', scale: 10 },
  { key: 'qr.large', scale: 20 },
] as const;

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function QrDialog({ link, onClose }: { link: Link | null; onClose: () => void }) {
  const toast = useToast();
  const { t } = useI18n();
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(10);
  const [busy, setBusy] = useState(false);

  // พรีวิวเสมอเป็น scale 8 (เร็ว คมพอ); ขนาดที่เลือกใช้ตอนดาวน์โหลด PNG
  useEffect(() => {
    if (!link) return;
    let url: string | null = null;
    let alive = true;
    setPreview(null);
    setError(null);
    apiBlob(`/api/links/${link.id}/qr?format=png&scale=8`)
      .then((b) => {
        if (!alive) return;
        url = URL.createObjectURL(b);
        setPreview(url);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : t('qr.loadFail')));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [link]);

  const download = async (format: 'png' | 'svg') => {
    if (!link) return;
    setBusy(true);
    try {
      const blob = await apiBlob(`/api/links/${link.id}/qr?format=${format}&scale=${scale}`);
      save(blob, `qr-${link.shortCode}.${format}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : t('qr.dlFail'));
    } finally {
      setBusy(false);
    }
  };

  const isLocal = link ? /^https?:\/\/(localhost|127\.|\[::1\])/.test(link.shortUrl) : false;

  return (
    <Modal open={!!link} onClose={onClose} title={t('qr.title')}>
      {link && (
        <div className="flex flex-col items-center gap-5">
          <div className="flex aspect-square w-full max-w-[15rem] items-center justify-center rounded-md bg-white p-1 ring-1 ring-line">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt={t('qr.alt', { url: link.shortUrl })} className="h-full w-full [image-rendering:pixelated]" />
            ) : (
              <p className="text-sm text-neutral-500">{error ?? t('qr.creating')}</p>
            )}
          </div>

          <p className="break-all text-center font-mono text-sm font-medium">{link.shortUrl}</p>

          {isLocal && (
            <p className="rounded-md border border-line bg-surface px-3 py-2 text-sm leading-relaxed text-muted">
              {t('qr.local')}
            </p>
          )}

          <fieldset className="w-full">
            <legend className="mb-2 text-sm font-medium">{t('qr.sizeLegend')}</legend>
            <div className="flex gap-2">
              {SIZES.map((s) => (
                <label key={s.scale} className={`btn flex-1 cursor-pointer ${scale === s.scale ? 'border-ink bg-ink text-paper hover:border-ink' : ''}`}>
                  <input type="radio" name="qr-size" className="sr-only" checked={scale === s.scale} onChange={() => setScale(s.scale)} />
                  {t(s.key)}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex w-full flex-wrap gap-2">
            <button type="button" className="btn-ink flex-1" disabled={busy || !preview} onClick={() => download('png')}>
              {t('qr.dlPng')}
            </button>
            <button type="button" className="btn-ink flex-1" disabled={busy || !preview} onClick={() => download('svg')}>
              {t('qr.dlSvg')}
            </button>
            <button type="button" className="btn" onClick={async () => toast((await copyText(link.shortUrl)) ? t('common.copied') : t('common.copyFailed'))}>
              {t('result.copy')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
