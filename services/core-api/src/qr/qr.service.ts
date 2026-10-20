import QRCode from 'qrcode';

export type QrFormat = 'png' | 'svg';

// ดำบนขาว, ECC ระดับ H, quiet zone 4 โมดูล (ตามมาตรฐาน) — ไม่ใส่โลโก้/สีเพื่อให้สแกนติดแน่
const BASE = { errorCorrectionLevel: 'H', margin: 4, color: { dark: '#000000', light: '#ffffff' } } as const;

/** PNG: scale = จำนวนพิกเซลต่อ 1 โมดูล (จำนวนเต็ม) ภาพจึงคมไม่เบลอ */
export async function renderQr(text: string, format: QrFormat, scale: number): Promise<Buffer | string> {
  if (format === 'svg') return QRCode.toString(text, { ...BASE, type: 'svg' });
  return QRCode.toBuffer(text, { ...BASE, type: 'png', scale });
}

/** เมทริกซ์โมดูลของ QR (ECC ระดับ H) ให้หน้าเว็บวาดเองตามสไตล์: rows[y][x] = '1' (โมดูลเข้ม) | '0' */
export function qrMatrix(text: string): { size: number; rows: string[] } {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const rows: string[] = [];
  for (let y = 0; y < size; y++) {
    let r = '';
    for (let x = 0; x < size; x++) r += data[y * size + x] ? '1' : '0';
    rows.push(r);
  }
  return { size, rows };
}
