'use client';

import type { CSSProperties } from 'react';
import { useI18n } from '@/lib/i18n';

// การ์ดตกแต่งลอยรอบหัวข้อ (เฉพาะจอใหญ่) — เป็นภาพประกอบ ไม่ใช่ข้อมูลจริง จึงซ่อนจากโปรแกรมอ่านหน้าจอ
// ภาพเคลื่อนไหวทั้งหมดอยู่ใน globals.css (ใช้ transform/opacity เท่านั้น และหยุดเมื่อผู้ใช้ตั้งลดการเคลื่อนไหว)
const QR_CELLS = ['0010110', '1101001', '0111010', '1010111', '0101101', '1100010', '0011011'];

const card = 'decor absolute rounded-2xl border border-line bg-surface p-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)]';
const title = 'mb-3 text-[13px] font-semibold text-muted';
const vars = (v: Record<string, string>) => v as CSSProperties;

function MiniQr() {
  let n = 0;
  return (
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 70 70" width="96" height="96">
        {QR_CELLS.flatMap((row, y) =>
          [...row].map((c, x) => {
            if (c !== '1') return null;
            n += 1;
            // จุดทุกๆ 3 จุดกะพริบสลับกัน
            return <rect key={`${x}-${y}`} x={x * 10} y={y * 10} width="9" height="9" rx="1.5" className={`fill-ink ${n % 3 === 0 ? 'decor-twinkle' : ''}`} style={vars({ '--i': String(n) })} />;
          }),
        )}
      </svg>
      <span className="decor-scan absolute inset-x-0 top-0 h-0.5 rounded bg-accent" />
    </div>
  );
}

export function HeroDecor() {
  const { t } = useI18n();
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
      {/* ลิงก์ยาว → ลิงก์สั้น */}
      <div className={`${card} left-[3%] top-[7%] w-60`} style={vars({ '--r': '-3deg', '--in': '0.1s', '--fd': '7s' })}>
        <p className={`relative h-5 ${title}`}>
          <span className="decor-label-long absolute left-0 top-0">{t('decor.long')}</span>
          <span className="decor-label-short absolute left-0 top-0 text-ink">{t('decor.short')}</span>
        </p>
        <div className="decor-line h-2 w-full rounded bg-line" style={vars({ '--to': '0.3', '--ld': '0s' })} />
        <div className="decor-line mt-2.5 h-2 w-4/5 rounded bg-line" style={vars({ '--to': '0.2', '--ld': '0.08s' })} />
        <div className="decor-line mt-2.5 h-2 w-3/5 rounded bg-line" style={vars({ '--to': '0.15', '--ld': '0.16s' })} />
      </div>

      {/* QR Code */}
      <div className={`${card} right-[3.5%] top-[6%]`} style={vars({ '--r': '3deg', '--in': '0.3s', '--fd': '8s' })}>
        <p className={title}>{t('decor.qr')}</p>
        <MiniQr />
      </div>

      {/* การเปิดลิงก์ */}
      <div className={`${card} bottom-[4%] left-[3%] w-72`} style={vars({ '--r': '2deg', '--in': '0.5s', '--fd': '6.5s' })}>
        <p className={title}>{t('decor.opens7')}</p>
        <div className="flex h-20 items-end gap-2">
          {[30, 52, 38, 70, 55, 92, 64].map((h, i) => (
            <div key={i} className={`decor-bar flex-1 rounded-t-[3px] ${i === 5 ? 'bg-accent' : 'bg-line'}`} style={vars({ height: `${h}%`, '--i': String(i) })} />
          ))}
        </div>
      </div>

      {/* เปิดจากอุปกรณ์ */}
      <div className={`${card} bottom-[5%] right-[3.5%] w-56`} style={vars({ '--r': '-2deg', '--in': '0.7s', '--fd': '7.5s' })}>
        <p className={title}>{t('decor.from')}</p>
        <div className="flex flex-col gap-3 text-sm font-medium">
          <div>
            <span className="flex items-center gap-2.5">
              <span className="decor-dot h-2.5 w-2.5 rounded-full bg-muted" />
              {t('decor.mobile')}
            </span>
            <div className="mt-1.5 h-1.5 rounded-full bg-line">
              <div className="decor-fill-a h-full w-full rounded-full bg-muted" />
            </div>
          </div>
          <div>
            <span className="flex items-center gap-2.5">
              <span className="decor-dot h-2.5 w-2.5 rounded-full bg-accent" style={vars({ animationDelay: '1.1s' })} />
              {t('decor.desktop')}
            </span>
            <div className="mt-1.5 h-1.5 rounded-full bg-line">
              <div className="decor-fill-b h-full w-full rounded-full bg-accent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
