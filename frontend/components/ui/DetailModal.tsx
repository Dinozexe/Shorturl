'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AdminIcon, type AdminIconName } from '@/components/Icon';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { copyText } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

export interface DetailField {
  label: string;
  value: ReactNode;
  icon?: AdminIconName;
  copy?: string; // ถ้ามี จะมีปุ่มคัดลอกค่านี้
  mono?: boolean;
  control?: ReactNode; // ใส่ตัวควบคุมที่เป็นช่องกรอบเอง (เช่น Select แบบ field) แทนช่องค่าปกติ
  half?: boolean; // ค่าสั้นๆ (สถานะ/ตัวเลข/วันที่) วางคู่กันสองช่อง; ค่าอื่นกินเต็มแถว
}

export interface DetailTab {
  id: string;
  label: string;
  icon: AdminIconName;
  content: ReactNode;
}

function Field({ f }: { f: DetailField }) {
  const { t } = useI18n();
  const toast = useToast();
  const [done, setDone] = useState(false);
  const copy = async () => {
    if (await copyText(f.copy ?? '')) {
      setDone(true);
      toast(t('common.copied'));
      setTimeout(() => setDone(false), 1500);
    } else toast(t('common.copyFailed'));
  };
  return (
    <div className={f.half ? '' : 'col-span-2'}>
      <dt className="mb-1.5 text-[13px] font-medium text-muted">{f.label}</dt>
      {f.control ? (
        <dd>{f.control}</dd>
      ) : (
      <dd className="flex min-h-11 items-start gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
        {f.icon && <AdminIcon name={f.icon} className="mt-0.5 h-[18px] w-[18px] shrink-0 text-muted" />}
        <span className={`min-w-0 flex-1 break-all text-sm font-medium ${f.mono ? 'font-mono text-[13px] leading-relaxed' : 'leading-relaxed'}`}>{f.value}</span>
        {f.copy && (
          <button type="button" onClick={copy} aria-label={`${t('common.copy')}: ${f.label}`} title={t('common.copy')} className="-mr-1.5 -mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-ink/[0.07] hover:text-ink">
            <AdminIcon name={done ? 'check' : 'copy'} className="h-4 w-4" />
          </button>
        )}
      </dd>
      )}
    </div>
  );
}

interface DetailModalProps {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  icon: AdminIconName;
  fields: DetailField[];
  infoLabel: string; // ชื่อแท็บแรก (ข้อมูล)
  tabs?: DetailTab[]; // แท็บเพิ่มเติม (เช่น สถิติ)
  footer?: ReactNode;
  tone?: 'default' | 'danger'; // danger = แบนเนอร์/ไอคอนโทนแดง (โดเมนที่บล็อก, ผู้ใช้ที่ถูกระงับ ฯลฯ)
  onClose: () => void;
}

// หน้าต่างดูข้อมูลเต็มของแถวในตาราง: แบนเนอร์หัวไล่เฉดอ่อน + ไอคอน/ชื่อ/คำอธิบาย + แท็บ + ช่องข้อมูลแบบกรอบ (ไอคอนนำ, ปุ่มคัดลอกท้ายช่อง) + ปุ่มล่างซ้าย-ขวา
export function DetailModal({ open, title, subtitle, icon, fields, infoLabel, tabs = [], footer, tone = 'default', onClose }: DetailModalProps) {
  const danger = tone === 'danger';
  const [tab, setTab] = useState('info');
  useEffect(() => {
    if (open) setTab('info');
  }, [open]);
  const all: Array<{ id: string; label: string; icon: AdminIconName }> = [{ id: 'info', label: infoLabel, icon: 'info' }, ...tabs];
  const extra = tabs.find((x) => x.id === tab);

  return (
    <Modal open={open} onClose={onClose} title={title} flush>
      <div className={`bg-gradient-to-b to-transparent px-6 pb-4 pt-6 sm:px-7 ${danger ? 'from-danger/[0.14] via-danger/[0.05]' : 'from-accent/[0.12] via-accent/[0.04]'}`}>
        <div className="flex items-center gap-4 pr-10">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface shadow-sm ring-1 ring-line/60 ${danger ? 'text-danger' : 'text-accent'}`}>
            <AdminIcon name={icon} className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h2 id="modal-title" className="truncate text-xl font-bold leading-tight">
              {title}
            </h2>
            {subtitle && <div className="mt-0.5 truncate text-sm text-muted">{subtitle}</div>}
          </div>
        </div>

        {tabs.length > 0 && (
          <div role="tablist" className="mt-5 grid gap-1 rounded-xl bg-ink/[0.07] p-1" style={{ gridTemplateColumns: `repeat(${all.length}, minmax(0, 1fr))` }}>
            {all.map((x) => {
              const on = x.id === tab;
              return (
                <button key={x.id} type="button" role="tab" aria-selected={on} onClick={() => setTab(x.id)} className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-colors ${on ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
                  <AdminIcon name={x.icon} className={`h-4 w-4 ${on ? 'text-accent' : ''}`} />
                  {x.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-6 pb-6 pt-4 sm:px-7" role={tabs.length > 0 ? 'tabpanel' : undefined}>
        {extra ? (
          extra.content
        ) : (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-4">
            {fields.map((f) => (
              <Field key={f.label} f={f} />
            ))}
          </dl>
        )}
        {footer && <div className="mt-6 flex gap-3 [&>button]:h-11 [&>button]:flex-1 [&>button]:justify-center [&>button:only-child]:mx-auto [&>button:only-child]:max-w-[16rem]">{footer}</div>}
      </div>
    </Modal>
  );
}
