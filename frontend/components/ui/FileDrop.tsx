'use client';

import { useRef, useState, type DragEvent } from 'react';
import { AdminIcon } from '@/components/Icon';
import { useI18n } from '@/lib/i18n';

interface FileDropProps {
  accept: string[]; // MIME types
  onFile: (file: File) => void;
  onRemove: () => void;
  /** มีรูปแล้ว: แสดงตัวอย่าง (data URL) + ชื่อ/ขนาด */
  preview: { src: string; name: string; size: number } | null;
  error?: string | null;
  hint: string;
}

const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;

/** ช่องอัปโหลดรูปที่ออกแบบเอง: ลากไฟล์มาวางหรือกดเลือก; ไม่มีรูป = กรอบประ, มีรูป = การ์ดตัวอย่าง + ปุ่มเอาออก (ปุ่มเลือกไฟล์ของระบบถูกซ่อน) */
export function FileDrop({ accept, onFile, onRemove, preview, error, hint }: FileDropProps) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div className="flex flex-col gap-2">
      <input ref={input} type="file" accept={accept.join(',')} tabIndex={-1} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />

      {preview ? (
        <div className="flex items-center gap-3 rounded-2xl bg-ink/[0.04] p-2.5 pr-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-line [background-image:linear-gradient(45deg,#e5e7eb_25%,transparent_25%,transparent_75%,#e5e7eb_75%),linear-gradient(45deg,#e5e7eb_25%,#fff_25%,#fff_75%,#e5e7eb_75%)] [background-position:0_0,6px_6px] [background-size:12px_12px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.src} alt="" className="max-h-full max-w-full object-contain" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold" title={preview.name}>{preview.name}</span>
            <span className="text-xs text-muted">{kb(preview.size)}</span>
          </span>
          <button type="button" onClick={() => input.current?.click()} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/10">
            {t('qr.drop.change')}
          </button>
          <button type="button" onClick={onRemove} aria-label={t('qr.logo.remove')} title={t('qr.logo.remove')} className="flex h-8 w-8 items-center justify-center rounded-lg text-danger transition-colors hover:bg-danger/10">
            <AdminIcon name="trash" className="h-[18px] w-[18px]" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
          className={`flex w-full flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-4 py-5 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${over ? 'border-accent bg-accent/10' : 'border-line bg-ink/[0.02] hover:border-ink/30 hover:bg-ink/[0.04]'}`}
        >
          <span className={`mb-1 flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${over ? 'bg-accent text-on-accent' : 'bg-accent/15 text-accent'}`}>
            <AdminIcon name="image" className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold">{over ? t('qr.drop.release') : t('qr.drop.title')}</span>
          <span className="text-xs text-muted">{t('qr.drop.or')}</span>
          <span className="mt-1 text-[11px] text-muted">{hint}</span>
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
