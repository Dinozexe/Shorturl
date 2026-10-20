// วาด QR Code แบบกำหนดสไตล์เองเป็น SVG จากเมทริกซ์โมดูล (backend ส่งมา: ECC ระดับ H)
// ไม่พึ่งไลบรารี: ลายจุด / ตา / ไล่เฉด / โลโก้ / ข้อความใต้ QR ทั้งหมดอยู่ในไฟล์นี้ และใช้ผลลัพธ์เดียวกันทั้งตัวอย่างสด, ดาวน์โหลด SVG และ PNG

export const DOT_STYLES = ['square', 'rounded', 'dots', 'diamond', 'classy'] as const;
export const EYE_STYLES = ['square', 'rounded', 'circle'] as const;
export const LOGOS = ['none', 'link', 'star', 'heart', 'bolt'] as const;
export const ANGLES = [0, 45, 90, 135] as const;

export type DotStyle = (typeof DOT_STYLES)[number];
export type EyeStyle = (typeof EYE_STYLES)[number];
export type LogoId = (typeof LOGOS)[number];

export interface QrStyle {
  dots: DotStyle;
  eyes: EyeStyle;
  fg: string;
  fg2: string | null;
  angle: (typeof ANGLES)[number];
  bg: string | null; // null = พื้นโปร่งใส
  eyeColor: string | null; // null = ใช้สีหลัก
  logo: LogoId;
  logoSize: number; // % ของความกว้าง
  caption: string;
  margin: number; // quiet zone (โมดูล)
}

export interface QrMatrix {
  size: number;
  rows: string[];
}

export const DEFAULT_STYLE: QrStyle = {
  dots: 'square',
  eyes: 'square',
  fg: '#000000',
  fg2: null,
  angle: 45,
  bg: '#ffffff',
  eyeColor: null,
  logo: 'none',
  logoSize: 18,
  caption: '',
  margin: 4,
};

/** สไตล์สำเร็จรูป: ทุกอันคอนทราสต์สูง (เข้มบนอ่อน) เพื่อให้สแกนติดง่าย */
export const PRESETS: Array<{ id: string; style: Partial<QrStyle> }> = [
  { id: 'classic', style: {} },
  { id: 'ocean', style: { dots: 'rounded', eyes: 'rounded', fg: '#1d4ed8', fg2: '#0891b2', angle: 135, eyeColor: '#1e3a8a' } },
  { id: 'sunset', style: { dots: 'dots', eyes: 'circle', fg: '#be123c', fg2: '#c2410c', angle: 45, eyeColor: '#9f1239' } },
  { id: 'forest', style: { dots: 'classy', eyes: 'rounded', fg: '#166534', fg2: '#0f766e', angle: 90, eyeColor: '#14532d' } },
  { id: 'grape', style: { dots: 'diamond', eyes: 'square', fg: '#6d28d9', fg2: '#be185d', angle: 135, eyeColor: '#4c1d95' } },
  { id: 'night', style: { dots: 'rounded', eyes: 'circle', fg: '#0f172a', bg: '#e2e8f0', eyeColor: '#1e293b' } },
];

const U = 10; // 1 โมดูล = 10 หน่วย SVG
const CAPTION_H = 64;

// ---------------------------------------------------------------- สี

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lum = (hex: string) => {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

export function contrastRatio(a: string, b: string): number {
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export type QrWarning = 'lowContrast' | 'inverted' | 'transparent';

/** คำเตือนที่ทำให้สแกนยาก: คอนทราสต์ต่ำ (< 3:1), สีสลับ (จุดอ่อนกว่าพื้น), พื้นโปร่งใส (ขึ้นกับพื้นหลังที่นำไปวาง) */
export function qrWarnings(s: QrStyle): QrWarning[] {
  const out: QrWarning[] = [];
  if (s.bg === null) {
    out.push('transparent');
    return out;
  }
  const fgs = [s.fg, s.fg2, s.eyeColor].filter((c): c is string => !!c);
  if (fgs.some((c) => contrastRatio(c, s.bg as string) < 3)) out.push('lowContrast');
  if (fgs.some((c) => lum(c) > lum(s.bg as string))) out.push('inverted');
  return out;
}

// ---------------------------------------------------------------- รูปทรง

const f = (n: number) => String(Math.round(n * 100) / 100);

/** สี่เหลี่ยมมุมมนแยกรัศมีต่อมุม (tl, tr, br, bl) */
function roundRect(x: number, y: number, w: number, h: number, tl: number, tr: number, br: number, bl: number) {
  return (
    `M${f(x + tl)} ${f(y)}H${f(x + w - tr)}` +
    (tr ? `A${f(tr)} ${f(tr)} 0 0 1 ${f(x + w)} ${f(y + tr)}` : '') +
    `V${f(y + h - br)}` +
    (br ? `A${f(br)} ${f(br)} 0 0 1 ${f(x + w - br)} ${f(y + h)}` : '') +
    `H${f(x + bl)}` +
    (bl ? `A${f(bl)} ${f(bl)} 0 0 1 ${f(x)} ${f(y + h - bl)}` : '') +
    `V${f(y + tl)}` +
    (tl ? `A${f(tl)} ${f(tl)} 0 0 1 ${f(x + tl)} ${f(y)}` : '') +
    'Z'
  );
}
const circle = (cx: number, cy: number, r: number) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;

function eyePath(style: EyeStyle, x: number, y: number): { ring: string; pupil: string } {
  const S = 7 * U;
  if (style === 'circle') {
    return { ring: circle(x + S / 2, y + S / 2, S / 2) + circle(x + S / 2, y + S / 2, S / 2 - U), pupil: circle(x + S / 2, y + S / 2, 1.5 * U) };
  }
  const ro = style === 'rounded' ? 2.2 * U : 0;
  const ri = style === 'rounded' ? 1.2 * U : 0;
  const rp = style === 'rounded' ? 0.9 * U : 0;
  return {
    ring: roundRect(x, y, S, S, ro, ro, ro, ro) + roundRect(x + U, y + U, S - 2 * U, S - 2 * U, ri, ri, ri, ri),
    pupil: roundRect(x + 2 * U, y + 2 * U, 3 * U, 3 * U, rp, rp, rp, rp),
  };
}

// โลโก้สำเร็จรูป (เส้นทางบนกริด 24x24)
const LOGO_PATHS: Record<Exclude<LogoId, 'none'>, string> = {
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  star: 'M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.5l6.1-.7z',
  heart: 'M12 20.5s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.8a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10.2-7.5 10.2z',
  bolt: 'M13 2.5 5 13.5h6l-1 8 8-11h-6z',
};
const LOGO_FILLED: Record<Exclude<LogoId, 'none'>, boolean> = { link: false, star: true, heart: true, bolt: true };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------- ตัววาดหลัก

export interface RenderResult {
  svg: string;
  width: number;
  height: number;
}

/** logoDataUrl: รูปที่ผู้ใช้อัปโหลด (มีผลก่อนโลโก้สำเร็จรูป; ไม่ถูกเก็บลงฐานข้อมูล) */
export function renderQrSvg(m: QrMatrix, style: QrStyle, logoDataUrl?: string | null): RenderResult {
  const { size, rows } = m;
  const mg = style.margin;
  const side = (size + 2 * mg) * U;
  const caption = style.caption.trim();
  const width = side;
  const height = side + (caption ? CAPTION_H : 0);
  const dark = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size && rows[y][x] === '1';
  const inEye = (x: number, y: number) => (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);

  // พื้นที่โลโก้กลาง (จำนวนโมดูล lm; ให้ size-lm เป็นเลขคู่ จะได้ชิดกริดและอยู่กึ่งกลางพอดี)
  const hasLogo = style.logo !== 'none' || !!logoDataUrl;
  let lm = 0;
  if (hasLogo) {
    lm = Math.max(3, Math.round((size * style.logoSize) / 100));
    if ((size - lm) % 2 !== 0) lm += 1;
  }
  const l0 = (size - lm) / 2;
  const inLogo = (x: number, y: number) => hasLogo && x >= l0 - 0 && x < l0 + lm && y >= l0 && y < l0 + lm;

  // ลายจุดข้อมูล (รวมเป็น path เดียว)
  let d = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!dark(x, y) || inEye(x, y) || inLogo(x, y)) continue;
      const px = (x + mg) * U;
      const py = (y + mg) * U;
      switch (style.dots) {
        case 'square':
          d += `M${px} ${py}h${U}v${U}h${-U}Z`;
          break;
        case 'dots':
          d += circle(px + U / 2, py + U / 2, 5.05); // เกือบชนกัน (เกินครึ่งโมดูลนิดเดียว) จุดจึงยังเป็นเนื้อเดียวพอให้ตัวถอดรหัสมองเห็นเป็นโมดูล
          break;
        case 'diamond':
          // 'เพชร' = สี่เหลี่ยมตัดมุม 8 เหลี่ยม (ตัดมุมละ 2.4) ครอบคลุมพื้นที่ ~88% จึงสแกนง่ายกว่าสี่เหลี่ยมหมุน 45°
          d += `M${f(px + 2.4)} ${py}H${f(px + U - 2.4)}L${px + U} ${f(py + 2.4)}V${f(py + U - 2.4)}L${f(px + U - 2.4)} ${py + U}H${f(px + 2.4)}L${px} ${f(py + U - 2.4)}V${f(py + 2.4)}Z`;
          break;
        case 'classy':
          d += roundRect(px, py, U, U, 3.6, 0, 3.6, 0);
          break;
        case 'rounded': {
          // มนเฉพาะมุมที่ไม่มีเพื่อนบ้านทั้งสองด้านของมุมนั้น → ก้อนที่ติดกันดูต่อเนื่องเป็นเนื้อเดียว
          const up = dark(x, y - 1), dn = dark(x, y + 1), lf = dark(x - 1, y), rt = dark(x + 1, y);
          const r = U / 2;
          d += roundRect(px, py, U, U, !up && !lf ? r : 0, !up && !rt ? r : 0, !dn && !rt ? r : 0, !dn && !lf ? r : 0);
          break;
        }
      }
    }
  }

  // ตา (finder) ทั้งสามมุม
  const eyes = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ].map(([ex, ey]) => eyePath(style.eyes, (ex + mg) * U, (ey + mg) * U));
  const ringD = eyes.map((e) => e.ring).join('');
  const pupilD = eyes.map((e) => e.pupil).join('');

  // ไล่เฉดครอบพื้นที่ QR ทั้งหมด
  const grad = style.fg2 !== null;
  const a = (style.angle * Math.PI) / 180;
  const cx = side / 2;
  const cy = side / 2;
  const gx = Math.cos(a) * (side / 2);
  const gy = Math.sin(a) * (side / 2);
  const defs = grad ? `<defs><linearGradient id="qg" gradientUnits="userSpaceOnUse" x1="${f(cx - gx)}" y1="${f(cy - gy)}" x2="${f(cx + gx)}" y2="${f(cy + gy)}"><stop offset="0" stop-color="${style.fg}"/><stop offset="1" stop-color="${style.fg2}"/></linearGradient></defs>` : '';
  const fill = grad ? 'url(#qg)' : style.fg;
  const eyeFill = style.eyeColor ?? fill;

  let body = '';
  if (style.bg !== null) body += `<rect width="${width}" height="${height}" fill="${style.bg}"/>`;
  body += `<path d="${d}" fill="${fill}"/>`;
  body += `<path d="${ringD}" fill="${eyeFill}" fill-rule="evenodd"/><path d="${pupilD}" fill="${eyeFill}"/>`;

  // โลโก้
  if (hasLogo) {
    const lx = (l0 + mg) * U;
    const ly = (l0 + mg) * U;
    const L = lm * U;
    const pad = U * 0.6;
    const inner = L - 2 * pad;
    if (style.bg !== null) body += `<rect x="${lx}" y="${ly}" width="${L}" height="${L}" rx="${f(L * 0.2)}" fill="${style.bg}"/>`;
    if (logoDataUrl) {
      body += `<clipPath id="lc"><rect x="${f(lx + pad)}" y="${f(ly + pad)}" width="${f(inner)}" height="${f(inner)}" rx="${f(inner * 0.16)}"/></clipPath>`;
      body += `<image href="${esc(logoDataUrl)}" x="${f(lx + pad)}" y="${f(ly + pad)}" width="${f(inner)}" height="${f(inner)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#lc)"/>`;
    } else if (style.logo !== 'none') {
      const sc = inner / 24;
      const filled = LOGO_FILLED[style.logo];
      body += `<g transform="translate(${f(lx + pad)} ${f(ly + pad)}) scale(${f(sc)})"><path d="${LOGO_PATHS[style.logo]}" fill="${filled ? fill : 'none'}" stroke="${fill}" stroke-width="${filled ? 1 : 2.2}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    }
  }

  // ข้อความใต้ QR
  if (caption) {
    const fs = Math.min(30, Math.max(14, (side * 0.9) / Math.max(caption.length * 0.62, 1)));
    body += `<text x="${f(width / 2)}" y="${f(side + CAPTION_H / 2 + fs * 0.12)}" text-anchor="middle" dominant-baseline="middle" font-family="'Noto Sans Thai','Sarabun',system-ui,sans-serif" font-size="${f(fs)}" font-weight="700" fill="${style.eyeColor ?? style.fg}">${esc(caption)}</text>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="geometricPrecision">${defs}${body}</svg>`;
  return { svg, width, height };
}

/** SVG → PNG (ความกว้าง px พิกเซล, คงสัดส่วน) — ทำบนหน้าเว็บด้วย canvas */
export function svgToPngBlob(r: RenderResult, px: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([r.svg], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = px;
      canvas.height = Math.round((px * r.height) / r.width);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas'));
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('svg'));
    };
    img.src = url;
  });
}
