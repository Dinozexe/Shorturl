'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { DEFAULT_STYLE, renderQrSvg, svgToPngBlob, type QrMatrix } from '@/lib/qrRender';
import type { Link } from '@/lib/types';
import { AdminIcon } from './Icon';
import { save } from './QrDialog';
import { StatsBody } from './StatsDialog';
import { useToast } from './Toast';
import { Chip } from './ui/Chip';
import { DetailModal, type DetailField } from './ui/DetailModal';

export type DetailAction = 'qr' | 'edit' | 'toggle' | 'delete';

function statusOf(link: Link): { key: Parameters<ReturnType<typeof useI18n>['t']>[0]; tone: 'ok' | 'danger' | 'accent' | 'muted' } {
  if (link.status === 'ADMIN_DISABLED') return { key: 'status.adminDisabled', tone: 'danger' };
  if (link.status === 'DISABLED') return { key: 'status.disabled', tone: 'muted' };
  if (link.expired) return { key: 'status.expired', tone: 'muted' };
  if (link.limitReached) return { key: 'status.limitReached', tone: 'muted' };
  if (link.notStarted) return { key: 'status.notStarted', tone: 'accent' };
  return { key: 'status.active', tone: 'ok' };
}

/** แท็บ QR: ตัวอย่างตามสไตล์ที่บันทึกไว้ + ดาวน์โหลดเร็ว + ปุ่มไปปรับแต่งเต็มรูปแบบ */
function QrTab({ link, onCustomize }: { link: Link; onCustomize: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [matrix, setMatrix] = useState<QrMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setMatrix(null);
    setError(null);
    api<QrMatrix>(`/api/links/${link.id}/qr?format=matrix`)
      .then((m) => alive && setMatrix(m))
      .catch((e) => alive && setError(e instanceof Error ? e.message : t('qr.loadFail')));
    return () => {
      alive = false;
    };
  }, [link.id, t]);

  const rendered = useMemo(() => (matrix ? renderQrSvg(matrix, { ...DEFAULT_STYLE, ...(link.qrStyle ?? {}) }) : null), [matrix, link.qrStyle]);

  const dl = async (format: 'png' | 'svg') => {
    if (!rendered) return;
    setBusy(true);
    try {
      if (format === 'svg') save(new Blob([rendered.svg], { type: 'image/svg+xml' }), `qr-${link.shortCode}.svg`);
      else save(await svgToPngBlob(rendered, 1024), `qr-${link.shortCode}.png`);
    } catch {
      toast(t('qr.dlFail'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-[16rem] items-center justify-center rounded-2xl bg-white p-3 shadow-sm ring-1 ring-line">
        {rendered ? <div role="img" aria-label={t('qr.alt', { url: link.shortUrl })} className="w-full [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: rendered.svg }} /> : <p className="aspect-square w-full py-24 text-center text-sm text-neutral-500">{error ?? t('qr.creating')}</p>}
      </div>
      <p className="break-all text-center font-mono text-sm font-medium">{link.shortUrl}</p>
      <div className="grid w-full max-w-xs grid-cols-2 gap-2">
        <button type="button" className="btn-primary h-11 justify-center" disabled={!rendered || busy} onClick={() => dl('png')}>
          <AdminIcon name="download" className="h-4 w-4" />
          PNG
        </button>
        <button type="button" className="btn-primary h-11 justify-center" disabled={!rendered || busy} onClick={() => dl('svg')}>
          <AdminIcon name="download" className="h-4 w-4" />
          SVG
        </button>
        <button type="button" className="btn col-span-2 h-11 justify-center" onClick={onCustomize}>
          <AdminIcon name="palette" className="h-4 w-4" />
          {t('detail.customQr')}
        </button>
      </div>
    </div>
  );
}

/** กดแถวลิงก์ในแดชบอร์ด → รายละเอียดครบในหน้าต่างเดียว: ข้อมูล · สถิติ · QR + ปุ่มแก้ไข/ปิด-เปิด/ลบ */
export function LinkDetailDialog({ link, onClose, onAction }: { link: Link | null; onClose: () => void; onAction: (a: DetailAction, l: Link) => void }) {
  const { t, fmt, lang } = useI18n();
  const when = new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const go = (a: DetailAction) => () => {
    if (!link) return;
    onClose();
    onAction(a, link);
  };

  const fields: DetailField[] = [];
  if (link) {
    const st = statusOf(link);
    fields.push(
      { label: t('admin.col.shortUrl'), icon: 'links', value: link.shortUrl, copy: link.shortUrl, mono: true },
      { label: t('admin.col.dest'), icon: 'globe', value: link.originalUrl, copy: link.originalUrl, mono: true },
      { label: t('admin.col.status'), icon: 'info', half: true, value: <Chip tone={st.tone}>{t(st.key)}</Chip> },
      { label: t('admin.col.opens'), icon: 'clicks', half: true, value: fmt.number(link.clickCount) },
      { label: t('admin.col.created'), icon: 'calendar', half: true, value: when.format(new Date(link.createdAt)) },
      { label: t('admin.f.expires'), icon: 'clock', half: true, value: link.expiresAt ? when.format(new Date(link.expiresAt)) : t('admin.f.never') },
      { label: t('detail.starts'), icon: 'calendar', half: true, value: link.startsAt ? when.format(new Date(link.startsAt)) : t('detail.none') },
      { label: t('detail.limit'), icon: 'clicks', half: true, value: link.maxClicks !== null ? t('detail.limitVal', { n: fmt.number(link.maxClicks) }) : t('detail.none') },
      { label: t('detail.password'), icon: 'lock', half: true, value: link.hasPassword ? t('detail.passwordOn') : t('detail.none') },
    );
  }
  const on = link?.status === 'ACTIVE';

  return (
    <DetailModal
      open={!!link}
      title={t('detail.title')}
      subtitle={link ? link.shortUrl.replace(/^https?:\/\//, '') : undefined}
      icon="links"
      infoLabel={t('admin.tab.info')}
      onClose={onClose}
      tabs={
        link
          ? [
              { id: 'stats', label: t('row.stats'), icon: 'clicks', content: <StatsBody link={link} /> },
              { id: 'qr', label: t('detail.tab.qr'), icon: 'qr', content: <QrTab link={link} onCustomize={go('qr')} /> },
            ]
          : []
      }
      fields={fields}
      footer={
        link && (
          <>
            <button type="button" className="btn" onClick={go('edit')}>
              <AdminIcon name="edit" className="h-4 w-4" />
              {t('row.edit')}
            </button>
            {link.status !== 'ADMIN_DISABLED' && (
              <button type="button" className="btn" onClick={go('toggle')}>
                <AdminIcon name={on ? 'linkOff' : 'links'} className="h-4 w-4" />
                {t(on ? 'detail.off' : 'detail.on')}
              </button>
            )}
            <button type="button" className="btn-danger" onClick={go('delete')}>
              <AdminIcon name="trash" className="h-4 w-4" />
              {t('row.delete')}
            </button>
          </>
        )
      }
    />
  );
}
