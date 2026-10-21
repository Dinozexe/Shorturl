'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { copyText } from '@/lib/format';
import { useI18n, type MsgKey } from '@/lib/i18n';
import { ANGLES, CAPTION_STYLES, DEFAULT_STYLE, DOT_STYLES, EYE_STYLES, LOGOS, PRESETS, qrWarnings, renderQrSvg, svgToPngBlob, type CaptionStyle, type DotStyle, type EyeStyle, type LogoId, type QrMatrix, type QrStyle } from '@/lib/qrRender';
import type { Link } from '@/lib/types';
import { AdminIcon, type AdminIconName } from './Icon';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { ColorPicker } from './ui/ColorPicker';
import { FileDrop } from './ui/FileDrop';
import { Select } from './ui/Select';
import { Slider } from './ui/Slider';

const SIZES = [
  { key: 'qr.small', px: 512 },
  { key: 'qr.medium', px: 1024 },
  { key: 'qr.large', px: 2048 },
] as const;

const MAX_LOGO_BYTES = 400 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- ชิ้นส่วนฟอร์ม ----------

function Card({ icon, title, children }: { icon: AdminIconName; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line p-4 sm:p-5" aria-label={title}>
      <h3 className="flex items-center gap-2.5 text-sm font-bold">
        <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <AdminIcon name={icon} className="h-4 w-4" />
        </span>
        {title}
      </h3>
      <div className="mt-4 flex flex-col gap-5">{children}</div>
    </section>
  );
}

function SubTitle({ children }: { children: ReactNode }) {
  return <p className="text-sm font-semibold text-ink/80">{children}</p>;
}

/** แถวตัวเลือกสี: ชื่อซ้าย ตัวเลือกขวา */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-4">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}

/** สวิตช์ (button role=switch) วาดเอง */
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row label={label}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${checked ? 'bg-accent' : 'bg-ink/20'}`}
      >
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </Row>
  );
}

/** ปุ่มเลือกแบบกลุ่ม (radio) ที่มีภาพตัวอย่างเล็กๆ */
function Choice<T extends string>({ value, options, onChange, name }: { value: T; options: Array<{ id: T; label: string; icon: ReactNode }>; onChange: (v: T) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label={name} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <label key={o.id} title={o.label} className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 text-[11px] font-medium transition-colors ${on ? 'bg-accent/10 text-accent ring-2 ring-accent' : 'bg-ink/[0.04] text-ink/80 ring-1 ring-transparent hover:bg-ink/[0.07]'}`}>
            <input type="radio" name={name} value={o.id} checked={on} onChange={() => onChange(o.id)} className="sr-only" />
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              {o.icon}
            </svg>
            <span className="truncate">{o.label}</span>
          </label>
        );
      })}
    </div>
  );
}

const dotIcons: Record<DotStyle, ReactNode> = {
  square: (
    <g fill="currentColor">
      <rect x="3" y="3" width="8" height="8" />
      <rect x="13" y="13" width="8" height="8" />
    </g>
  ),
  rounded: (
    <g fill="currentColor">
      <rect x="3" y="3" width="8" height="8" rx="3.5" />
      <rect x="13" y="13" width="8" height="8" rx="3.5" />
    </g>
  ),
  dots: (
    <g fill="currentColor">
      <circle cx="7" cy="7" r="4" />
      <circle cx="17" cy="17" r="4" />
    </g>
  ),
  diamond: (
    <g fill="currentColor">
      <path d="M5.4 3h3.2L11 5.4v3.2L8.6 11H5.4L3 8.6V5.4z" />
      <path d="M15.4 13h3.2L21 15.4v3.2L18.6 21h-3.2L13 18.6v-3.2z" />
    </g>
  ),
  classy: (
    <g fill="currentColor">
      <path d="M3 3h5a3 3 0 0 1 3 3v5H6a3 3 0 0 1-3-3z" transform="rotate(0)" />
      <path d="M13 13h5a3 3 0 0 1 3 3v5h-5a3 3 0 0 1-3-3z" />
    </g>
  ),
};

const eyeIcons: Record<EyeStyle, ReactNode> = {
  square: (
    <g fill="none" stroke="currentColor" strokeWidth="2.4">
      <rect x="3.5" y="3.5" width="17" height="17" />
      <rect x="9" y="9" width="6" height="6" fill="currentColor" stroke="none" />
    </g>
  ),
  rounded: (
    <g fill="none" stroke="currentColor" strokeWidth="2.4">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <rect x="9" y="9" width="6" height="6" rx="2" fill="currentColor" stroke="none" />
    </g>
  ),
  circle: (
    <g fill="none" stroke="currentColor" strokeWidth="2.4">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
    </g>
  ),
};

const capIcons: Record<CaptionStyle, ReactNode> = {
  pill: (
    <g fill="currentColor">
      <rect x="3" y="4" width="18" height="9" rx="1.5" opacity="0.25" />
      <rect x="6" y="15.5" width="12" height="5" rx="2.5" />
    </g>
  ),
  bar: (
    <g fill="currentColor">
      <rect x="3" y="4" width="18" height="10" rx="1.5" opacity="0.25" />
      <rect x="3" y="15.5" width="18" height="5" rx="1" />
    </g>
  ),
  text: (
    <g fill="currentColor">
      <rect x="3" y="4" width="18" height="10" rx="1.5" opacity="0.25" />
      <path d="M7 18.5h10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </g>
  ),
};

const logoIcon = (id: LogoId): ReactNode =>
  id === 'none' ? (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="8" />
      <path d="m6.3 6.3 11.4 11.4" />
    </g>
  ) : id === 'link' ? (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </g>
  ) : id === 'star' ? (
    <path fill="currentColor" d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.5l6.1-.7z" />
  ) : id === 'heart' ? (
    <path fill="currentColor" d="M12 20.5s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.8a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10.2-7.5 10.2z" />
  ) : (
    <path fill="currentColor" d="M13 2.5 5 13.5h6l-1 8 8-11h-6z" />
  );

// ---------- หน้าต่างหลัก ----------

export function QrDialog({ link, onClose, onSaved }: { link: Link | null; onClose: () => void; onSaved?: () => void }) {
  const toast = useToast();
  const { t } = useI18n();
  const [matrix, setMatrix] = useState<QrMatrix | null>(null);
  const [style, setStyle] = useState<QrStyle>(DEFAULT_STYLE);
  const [upload, setUpload] = useState<{ src: string; name: string; size: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [px, setPx] = useState<number>(1024);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  // เปิดหน้าต่าง → โหลดเมทริกซ์ + สไตล์ที่บันทึกไว้
  useEffect(() => {
    if (!link) return;
    let alive = true;
    setMatrix(null);
    setError(null);
    setUpload(null);
    setUploadError(null);
    setStyle({ ...DEFAULT_STYLE, ...(link.qrStyle ?? {}) });
    api<QrMatrix>(`/api/links/${link.id}/qr?format=matrix`)
      .then((m) => alive && setMatrix(m))
      .catch((e) => alive && setError(e instanceof Error ? e.message : t('qr.loadFail')));
    return () => {
      alive = false;
    };
  }, [link, t]);

  const patch = (p: Partial<QrStyle>) => setStyle((s) => ({ ...s, ...p }));
  const rendered = useMemo(() => (matrix ? renderQrSvg(matrix, style, upload?.src ?? null) : null), [matrix, style, upload]);
  const warnings = useMemo(() => qrWarnings(style), [style]);
  const isLocal = link ? /^https?:\/\/(localhost|127\.|\[::1\])/.test(link.shortUrl) : false;

  const dl = async (format: 'png' | 'svg') => {
    if (!rendered || !link) return;
    setBusy(true);
    try {
      if (format === 'svg') save(new Blob([rendered.svg], { type: 'image/svg+xml' }), `qr-${link.shortCode}.svg`);
      else save(await svgToPngBlob(rendered, px), `qr-${link.shortCode}.png`);
    } catch {
      toast(t('qr.dlFail'));
    } finally {
      setBusy(false);
    }
  };

  const persist = async (next: QrStyle | null) => {
    if (!link) return;
    setSaving(true);
    try {
      await api(`/api/links/${link.id}/qr-style`, { method: 'PUT', body: { style: next } });
      toast(next ? t('qr.saved') : t('qr.resetDone'));
      if (!next) {
        setStyle(DEFAULT_STYLE);
        setUpload(null);
      }
      onSaved?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : t('qr.saveFail'));
    } finally {
      setSaving(false);
    }
  };

  const onFile = (file: File) => {
    setUploadError(null);
    if (!LOGO_TYPES.includes(file.type)) return setUploadError(t('qr.logo.badType'));
    if (file.size > MAX_LOGO_BYTES) return setUploadError(t('qr.logo.tooBig'));
    const r = new FileReader();
    r.onload = () => setUpload({ src: String(r.result), name: file.name, size: file.size });
    r.readAsDataURL(file);
  };

  const angleOptions = ANGLES.map((a) => ({ value: String(a), label: t(`qr.angle.${a}` as MsgKey) }));
  const checker = style.bg === null ? 'bg-[length:16px_16px] [background-image:linear-gradient(45deg,#e5e7eb_25%,transparent_25%,transparent_75%,#e5e7eb_75%),linear-gradient(45deg,#e5e7eb_25%,#fff_25%,#fff_75%,#e5e7eb_75%)] [background-position:0_0,8px_8px]' : 'bg-white';

  return (
    <Modal open={!!link} onClose={onClose} title={t('qr.title')} wide>
      {link && (
        <div className="grid gap-6 md:grid-cols-[17rem_minmax(0,1fr)]">
          {/* ซ้าย: ตัวอย่างสด + ดาวน์โหลด */}
          <div className="flex flex-col items-center gap-4 md:sticky md:top-0 md:self-start">
            {warnings.length > 0 && (
              <ul className="w-full max-w-[17rem] space-y-2" role="status">
                {warnings.map((w) => (
                  <li key={w} className="flex items-start gap-2.5 rounded-xl bg-danger/10 px-3.5 py-3 text-[13px] font-medium leading-relaxed text-danger">
                    <AdminIcon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 [text-wrap:balance]">{t(`qr.warn.${w}` as MsgKey)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className={`flex w-full max-w-[17rem] items-center justify-center rounded-2xl p-3 shadow-sm ring-1 ring-line ${checker}`}>
              {rendered ? (
                <div role="img" aria-label={t('qr.alt', { url: link.shortUrl })} className="w-full [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: rendered.svg }} />
              ) : (
                <p className="aspect-square w-full py-24 text-center text-sm text-neutral-500">{error ?? t('qr.creating')}</p>
              )}
            </div>
            <p className="break-all text-center font-mono text-sm font-medium">{link.shortUrl}</p>

            <div className="flex w-full flex-col gap-2">
              <div role="radiogroup" aria-label={t('qr.sizeLegend')} className="grid grid-cols-3 gap-1.5 rounded-xl bg-ink/[0.05] p-1">
                {SIZES.map((s) => (
                  <label key={s.px} className={`cursor-pointer rounded-lg py-1.5 text-center text-xs font-semibold transition-colors ${px === s.px ? 'bg-surface shadow-sm' : 'text-muted hover:text-ink'}`}>
                    <input type="radio" name="qr-size" className="sr-only" checked={px === s.px} onChange={() => setPx(s.px)} />
                    {t(s.key)} · {s.px}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-ink flex-1" disabled={busy || !rendered} onClick={() => dl('png')}>
                  <AdminIcon name="download" className="h-4 w-4" />
                  PNG
                </button>
                <button type="button" className="btn-ink flex-1" disabled={busy || !rendered} onClick={() => dl('svg')}>
                  <AdminIcon name="download" className="h-4 w-4" />
                  SVG
                </button>
              </div>
              <button type="button" className="btn" onClick={async () => toast((await copyText(link.shortUrl)) ? t('common.copied') : t('common.copyFailed'))}>
                <AdminIcon name="copy" className="h-4 w-4" />
                {t('result.copy')}
              </button>
            </div>
            {isLocal && <p className="rounded-xl bg-ink/[0.05] px-3 py-2 text-xs leading-relaxed text-muted">{t('qr.local')}</p>}
          </div>

          {/* ขวา: ตัวเลือกปรับแต่ง (แยกเป็นการ์ดตามหมวด) */}
          <div className="flex min-w-0 flex-col gap-4">
            <Card icon="palette" title={t('qr.preset.title')}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setStyle((s) => ({ ...DEFAULT_STYLE, caption: s.caption, logo: s.logo, logoSize: s.logoSize, margin: s.margin, ...p.style }))}
                    className="flex min-w-0 items-center gap-2.5 rounded-xl bg-ink/[0.05] px-3 py-2.5 text-sm font-medium outline-none transition-colors hover:bg-ink/[0.09] focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span aria-hidden="true" className="h-6 w-6 shrink-0 rounded-full ring-1 ring-line" style={{ background: p.style.fg2 ? `linear-gradient(135deg, ${p.style.fg}, ${p.style.fg2})` : (p.style.fg ?? '#000') }} />
                    <span className="truncate">{t(`qr.preset.${p.id}` as MsgKey)}</span>
                  </button>
                ))}
              </div>
            </Card>

            <Card icon="qr" title={t('qr.sec.shape')}>
              <div className="flex flex-col gap-3">
                <SubTitle>{t('qr.dots')}</SubTitle>
                <Choice<DotStyle> name="qr-dots" value={style.dots} onChange={(v) => patch({ dots: v })} options={DOT_STYLES.map((id) => ({ id, label: t(`qr.dots.${id}` as MsgKey), icon: dotIcons[id] }))} />
              </div>
              <div className="flex flex-col gap-3 border-t border-line pt-5">
                <SubTitle>{t('qr.eyes')}</SubTitle>
                <Choice<EyeStyle> name="qr-eyes" value={style.eyes} onChange={(v) => patch({ eyes: v })} options={EYE_STYLES.map((id) => ({ id, label: t(`qr.eyes.${id}` as MsgKey), icon: eyeIcons[id] }))} />
              </div>
            </Card>

            <Card icon="edit" title={t('qr.colors')}>
              <div className="flex flex-col divide-y divide-line [&>*]:py-1 first:[&>*]:pt-0 last:[&>*]:pb-0">
                <Row label={t('qr.fg')}>
                  <ColorPicker label={t('qr.fg')} value={style.fg} onChange={(v) => patch({ fg: v })} />
                </Row>

                <div>
                  <Toggle label={t('qr.gradient')} checked={style.fg2 !== null} onChange={(on) => patch({ fg2: on ? (style.fg2 ?? '#0891b2') : null })} />
                  {style.fg2 !== null && (
                    <div className="mb-2 ml-3 flex flex-col gap-1 border-l-2 border-accent/30 pl-4">
                      <Row label={t('qr.fg2')}>
                        <ColorPicker label={t('qr.fg2')} value={style.fg2} onChange={(v) => patch({ fg2: v })} />
                      </Row>
                      <Row label={t('qr.angle')}>
                        <Select<string> label={t('qr.angle')} value={String(style.angle)} options={angleOptions} onChange={(v) => patch({ angle: Number(v) as QrStyle['angle'] })} className="w-48" />
                      </Row>
                    </div>
                  )}
                </div>

                <div>
                  <Toggle label={t('qr.transparent')} checked={style.bg === null} onChange={(on) => patch({ bg: on ? null : '#ffffff' })} />
                  {style.bg !== null && (
                    <div className="mb-2 ml-3 border-l-2 border-accent/30 pl-4">
                      <Row label={t('qr.bg')}>
                        <ColorPicker label={t('qr.bg')} value={style.bg} onChange={(v) => patch({ bg: v })} />
                      </Row>
                    </div>
                  )}
                </div>

                <div>
                  <Toggle label={t('qr.eyeColor')} checked={style.eyeColor !== null} onChange={(on) => patch({ eyeColor: on ? style.fg : null })} />
                  {style.eyeColor !== null && (
                    <div className="mb-2 ml-3 border-l-2 border-accent/30 pl-4">
                      <Row label={t('qr.eyeColor')}>
                        <ColorPicker label={t('qr.eyeColor')} value={style.eyeColor} onChange={(v) => patch({ eyeColor: v })} />
                      </Row>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <Card icon="image" title={t('qr.logo')}>
              <Choice<LogoId> name="qr-logo" value={upload ? ('none' as LogoId) : style.logo} onChange={(v) => { setUpload(null); patch({ logo: v }); }} options={LOGOS.map((id) => ({ id, label: t(`qr.logo.${id}` as MsgKey), icon: logoIcon(id) }))} />
              <FileDrop accept={LOGO_TYPES} preview={upload} error={uploadError} hint={t('qr.drop.hint')} onFile={onFile} onRemove={() => { setUpload(null); setUploadError(null); }} />
              <p className="-mt-2 text-xs text-muted">{t('qr.logo.note')}</p>
              {(style.logo !== 'none' || upload) && <Slider label={t('qr.logo.sizeLabel')} min={10} max={22} value={style.logoSize} onChange={(v) => patch({ logoSize: v })} format={(v) => `${v}%`} />}
            </Card>

            <Card icon="type" title={t('qr.caption')}>
              <input className="field" maxLength={24} placeholder={t('qr.caption.ph')} value={style.caption} onChange={(e) => patch({ caption: e.target.value })} aria-label={t('qr.caption')} />
              <div className="-mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t('qr.cap.quick')}>
                {(['qr.cap.q1', 'qr.cap.q2', 'qr.cap.q3', 'qr.cap.q4'] as const).map((k) => (
                  <button key={k} type="button" onClick={() => patch({ caption: t(k) })} className="rounded-full bg-ink/[0.05] px-3 py-1 text-xs font-medium text-ink/80 outline-none transition-colors hover:bg-ink/[0.09] focus-visible:ring-2 focus-visible:ring-accent">
                    {t(k)}
                  </button>
                ))}
              </div>
              {style.caption.trim() && (
                <div className="max-w-sm">
                  <Choice<CaptionStyle> name="qr-capstyle" value={style.captionStyle} onChange={(v) => patch({ captionStyle: v })} options={CAPTION_STYLES.map((id) => ({ id, label: t(`qr.cap.${id}` as MsgKey), icon: capIcons[id] }))} />
                </div>
              )}
              <Slider label={t('qr.marginLabel')} min={2} max={8} value={style.margin} onChange={(v) => patch({ margin: v })} format={(v) => t('qr.cells', { n: v })} />
            </Card>

            {/* แถบบันทึกค้างด้านล่าง: เลื่อนดูตัวเลือกยาวๆ ก็กดบันทึกได้ตลอด */}
            <div className="sticky -bottom-5 z-10 -mx-5 -mb-5 flex flex-wrap gap-2 border-t border-line bg-surface px-5 pb-5 pt-3 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6">
              <button type="button" className="btn-primary h-11 flex-1 rounded-xl sm:flex-none sm:px-8" disabled={saving} onClick={() => persist(style)}>
                <AdminIcon name="check" className="h-4 w-4" />
                {t('qr.save')}
              </button>
              <button type="button" className="btn h-11 rounded-xl px-5" disabled={saving} onClick={() => persist(null)}>
                <AdminIcon name="refresh" className="h-4 w-4" />
                {t('qr.reset')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
