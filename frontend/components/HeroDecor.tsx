'use client';

import type { CSSProperties } from 'react';
import { useI18n } from '@/lib/i18n';

// การ์ดตกแต่งลอยรอบหัวข้อหน้าแรก (เฉพาะจอใหญ่) — เป็นภาพประกอบ ไม่ใช่ข้อมูลจริง จึงซ่อนจากโปรแกรมอ่านหน้าจอ
// ภาพเคลื่อนไหวทั้งหมดอยู่ใน globals.css (ใช้ transform/opacity เท่านั้น และหยุดเมื่อผู้ใช้ตั้งลดการเคลื่อนไหว)
const QR_CELLS = ['0010110', '1101001', '0111010', '1010111', '0101101', '1100010', '0011011'];

const card = 'decor absolute rounded-xl border border-line bg-surface p-3 shadow-[0_6px_20px_rgba(0,0,0,0.07)]';
const vars = (v: Record<string, string>) => v as CSSProperties;

function MiniQr() {
  let n = 0;
  return (
    <div className="relative h-14 w-14">
      <svg viewBox="0 0 70 70" width="56" height="56">
        {QR_CELLS.flatMap((row, y) =>
          [...row].map((c, x) => {
            if (c !== '1') return null;
            n += 1;
            // จุดทุกๆ 3 จุดกะพริบสลับกัน
            return <rect key={`${x}-${y}`} x={x * 10} y={y * 10} width="9" height="9" rx="1.5" className={`fill-ink ${n % 3 === 0 ? 'decor-twinkle' : ''}`} style={vars({ '--i': String(n) })} />;
          }),
        )}
      </svg>
      <span className="decor-scan absolute inset-x-0 top-0 h-0.5 rounded bg-ink/70" />
    </div>
  );
}

export function HeroDecor() {
  const { t } = useI18n();
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
      {/* ลิงก์ยาว → ลิงก์สั้น */}
      <div className={`${card} left-[4%] top-[9%] w-40`} style={vars({ '--r': '-3deg', '--in': '0.1s', '--fd': '7s' })}>
        <p className="relative mb-2 h-4 text-[11px] font-semibold text-muted">
          <span className="decor-label-long absolute left-0 top-0">{t('decor.long')}</span>
          <span className="decor-label-short absolute left-0 top-0 text-ink">{t('decor.short')}</span>
        </p>
        <div className="decor-line h-1.5 w-full rounded bg-line" style={vars({ '--to': '0.3', '--ld': '0s' })} />
        <div className="decor-line mt-1.5 h-1.5 w-4/5 rounded bg-line" style={vars({ '--to': '0.2', '--ld': '0.08s' })} />
        <div className="decor-line mt-1.5 h-1.5 w-3/5 rounded bg-line" style={vars({ '--to': '0.15', '--ld': '0.16s' })} />
      </div>

      {/* QR Code */}
      <div className={`${card} right-[5%] top-[8%]`} style={vars({ '--r': '3deg', '--in': '0.3s', '--fd': '8s' })}>
        <p className="mb-2 text-[11px] font-semibold text-muted">{t('decor.qr')}</p>
        <MiniQr />
      </div>

      {/* การเปิดลิงก์ */}
      <div className={`${card} bottom-[5%] left-[4%] w-48`} style={vars({ '--r': '2deg', '--in': '0.5s', '--fd': '6.5s' })}>
        <p className="mb-2 text-[11px] font-semibold text-muted">{t('decor.opens7')}</p>
        <div className="flex h-12 items-end gap-1.5">
          {[30, 52, 38, 70, 55, 92, 64].map((h, i) => (
            <div key={i} className={`decor-bar flex-1 rounded-t-[2px] ${i === 5 ? 'bg-ink' : 'bg-line'}`} style={vars({ height: `${h}%`, '--i': String(i) })} />
          ))}
        </div>
      </div>

      {/* เปิดจากอุปกรณ์ */}
      <div className={`${card} bottom-[6%] right-[5%] w-36`} style={vars({ '--r': '-2deg', '--in': '0.7s', '--fd': '7.5s' })}>
        <p className="mb-2 text-[11px] font-semibold text-muted">{t('decor.from')}</p>
        <div className="flex flex-col gap-2 text-xs font-medium">
          <div>
            <span className="flex items-center gap-2">
              <span className="decor-dot h-2 w-2 rounded-full bg-muted" />
              {t('decor.mobile')}
            </span>
            <div className="mt-1 h-1 rounded-full bg-line">
              <div className="decor-fill-a h-full w-full rounded-full bg-muted" />
            </div>
          </div>
          <div>
            <span className="flex items-center gap-2">
              <span className="decor-dot h-2 w-2 rounded-full bg-ink" style={vars({ animationDelay: '1.1s' })} />
              {t('decor.desktop')}
            </span>
            <div className="mt-1 h-1 rounded-full bg-line">
              <div className="decor-fill-b h-full w-full rounded-full bg-ink" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
