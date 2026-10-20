'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { copyText } from '@/lib/format';
import { useI18n, type MsgKey } from '@/lib/i18n';
import { ANGLES, DEFAULT_STYLE, DOT_STYLES, EYE_STYLES, LOGOS, PRESETS, qrWarnings, renderQrSvg, svgToPngBlob, type DotStyle, type EyeStyle, type LogoId, type QrMatrix, type QrStyle } from '@/lib/qrRender';
import type { Link } from '@/lib/types';
import { AdminIcon } from './Icon';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { Select } from './ui/Select';

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3 border-0 p-0">
      <legend className="mb-0.5 text-sm font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

function Swatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2.5 text-sm font-medium">
      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl ring-1 ring-line" style={{ backgroundColor: value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={label} />
      </span>
      <span className="flex flex-col leading-tight">
        <span>{label}</span>
        <span className="font-mono text-xs uppercase text-muted">{value}</span>
      </span>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium">
      {label}
      <span className="relative inline-flex h-6 w-10 shrink-0">
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="absolute inset-0 rounded-full bg-ink/20 transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

/** ปุ่มเลือกแบบกลุ่ม (radio) ที่มีภาพตัวอย่างเล็กๆ */
function Choice<T extends string>({ value, options, onChange, name }: { value: T; options: Array<{ id: T; label: string; icon: ReactNode }>; onChange: (v: T) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-cols-5 gap-2 sm:grid-cols-5">
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
  const [upload, setUpload] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [px, setPx] = useState<number>(1024);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
  const rendered = useMemo(() => (matrix ? renderQrSvg(matrix, style, upload) : null), [matrix, style, upload]);
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

  const onFile = (file: File | undefined) => {
    setUploadError(null);
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return setUploadError(t('qr.logo.badType'));
    if (file.size > MAX_LOGO_BYTES) return setUploadError(t('qr.logo.tooBig'));
    const r = new FileReader();
    r.onload = () => setUpload(String(r.result));
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
            <div className={`flex w-full max-w-[17rem] items-center justify-center rounded-2xl p-3 shadow-sm ring-1 ring-line ${checker}`}>
              {rendered ? (
                <div role="img" aria-label={t('qr.alt', { url: link.shortUrl })} className="w-full [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: rendered.svg }} />
              ) : (
                <p className="aspect-square w-full py-24 text-center text-sm text-neutral-500">{error ?? t('qr.creating')}</p>
              )}
            </div>
            <p className="break-all text-center font-mono text-sm font-medium">{link.shortUrl}</p>

            {warnings.length > 0 ? (
              <ul className="w-full space-y-1.5" role="status">
                {warnings.map((w) => (
                  <li key={w} className="flex gap-2 rounded-xl bg-danger/10 px-3 py-2 text-xs font-medium leading-snug text-danger">
                    <span aria-hidden="true">!</span>
                    {t(`qr.warn.${w}` as MsgKey)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex w-full items-center gap-2 rounded-xl bg-ok/10 px-3 py-2 text-xs font-medium text-ok" role="status">
                <AdminIcon name="check" className="h-3.5 w-3.5" />
                {t('qr.ok')}
              </p>
            )}

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

          {/* ขวา: ตัวเลือกปรับแต่ง */}
          <div className="flex min-w-0 flex-col gap-6">
            <Section title={t('qr.preset.title')}>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setStyle((s) => ({ ...DEFAULT_STYLE, caption: s.caption, logo: s.logo, logoSize: s.logoSize, margin: s.margin, ...p.style }))}
                    className="flex items-center gap-2 rounded-full bg-ink/[0.05] py-1.5 pl-2 pr-3.5 text-sm font-medium transition-colors hover:bg-ink/[0.09]"
                  >
                    <span aria-hidden="true" className="h-5 w-5 rounded-full ring-1 ring-line" style={{ background: p.style.fg2 ? `linear-gradient(135deg, ${p.style.fg}, ${p.style.fg2})` : (p.style.fg ?? '#000') }} />
                    {t(`qr.preset.${p.id}` as MsgKey)}
                  </button>
                ))}
              </div>
            </Section>

            <Section title={t('qr.dots')}>
              <Choice<DotStyle> name="qr-dots" value={style.dots} onChange={(v) => patch({ dots: v })} options={DOT_STYLES.map((id) => ({ id, label: t(`qr.dots.${id}` as MsgKey), icon: dotIcons[id] }))} />
            </Section>

            <Section title={t('qr.eyes')}>
              <div className="max-w-xs">
                <Choice<EyeStyle> name="qr-eyes" value={style.eyes} onChange={(v) => patch({ eyes: v })} options={EYE_STYLES.map((id) => ({ id, label: t(`qr.eyes.${id}` as MsgKey), icon: eyeIcons[id] }))} />
              </div>
            </Section>

            <Section title={t('qr.colors')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Swatch label={t('qr.fg')} value={style.fg} onChange={(v) => patch({ fg: v })} />
                <div className="flex flex-col gap-3">
                  <Toggle label={t('qr.gradient')} checked={style.fg2 !== null} onChange={(on) => patch({ fg2: on ? (style.fg2 ?? '#0891b2') : null })} />
                  {style.fg2 !== null && (
                    <>
                      <Swatch label={t('qr.fg2')} value={style.fg2} onChange={(v) => patch({ fg2: v })} />
                      <Select<string> label={t('qr.angle')} value={String(style.angle)} options={angleOptions} onChange={(v) => patch({ angle: Number(v) as QrStyle['angle'] })} className="w-full" />
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <Toggle label={t('qr.transparent')} checked={style.bg === null} onChange={(on) => patch({ bg: on ? null : '#ffffff' })} />
                  {style.bg !== null && <Swatch label={t('qr.bg')} value={style.bg} onChange={(v) => patch({ bg: v })} />}
                </div>
                <div className="flex flex-col gap-3">
                  <Toggle label={t('qr.eyeColor')} checked={style.eyeColor !== null} onChange={(on) => patch({ eyeColor: on ? style.fg : null })} />
                  {style.eyeColor !== null && <Swatch label={t('qr.eyeColor')} value={style.eyeColor} onChange={(v) => patch({ eyeColor: v })} />}
                </div>
              </div>
            </Section>

            <Section title={t('qr.logo')}>
              <Choice<LogoId> name="qr-logo" value={upload ? ('none' as LogoId) : style.logo} onChange={(v) => { setUpload(null); patch({ logo: v }); }} options={LOGOS.map((id) => ({ id, label: t(`qr.logo.${id}` as MsgKey), icon: logoIcon(id) }))} />
              <div className="flex flex-wrap items-center gap-2">
                <input ref={fileRef} type="file" accept={LOGO_TYPES.join(',')} className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
                <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
                  <AdminIcon name="plus" className="h-4 w-4" />
                  {t('qr.logo.upload')}
                </button>
                {upload && (
                  <button type="button" className="btn" onClick={() => setUpload(null)}>
                    <AdminIcon name="x" className="h-4 w-4" />
                    {t('qr.logo.remove')}
                  </button>
                )}
                <span className="text-xs text-muted">{t('qr.logo.note')}</span>
              </div>
              {uploadError && (
                <p role="alert" className="text-sm font-medium text-danger">
                  {uploadError}
                </p>
              )}
              {(style.logo !== 'none' || upload) && (
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  {t('qr.logo.size', { n: style.logoSize })}
                  <input type="range" min={10} max={22} step={1} value={style.logoSize} onChange={(e) => patch({ logoSize: Number(e.target.value) })} className="w-full accent-[rgb(var(--accent))]" />
                </label>
              )}
            </Section>

            <Section title={t('qr.caption')}>
              <input className="field" maxLength={24} placeholder={t('qr.caption.ph')} value={style.caption} onChange={(e) => patch({ caption: e.target.value })} aria-label={t('qr.caption')} />
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                {t('qr.margin', { n: style.margin })}
                <input type="range" min={2} max={8} step={1} value={style.margin} onChange={(e) => patch({ margin: Number(e.target.value) })} className="w-full accent-[rgb(var(--accent))]" />
              </label>
            </Section>

            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <button type="button" className="btn-primary" disabled={saving} onClick={() => persist(style)}>
                <AdminIcon name="check" className="h-4 w-4" />
                {t('qr.save')}
              </button>
              <button type="button" className="btn" disabled={saving} onClick={() => persist(null)}>
                <AdminIcon name="x" className="h-4 w-4" />
                {t('qr.reset')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
