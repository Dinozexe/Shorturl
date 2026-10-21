import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ANGLES, CAPTION_STYLES, contrastRatio, DEFAULT_STYLE, DOT_STYLES, EYE_STYLES, LOGOS, PRESETS, qrWarnings, renderQrSvg, type QrMatrix, type QrStyle } from '../lib/qrRender';

// เมทริกซ์ 25×25 จำลอง: finder 3 มุม + ลวดลายสุ่มแบบกำหนดได้ (ไม่ต้องพึ่ง backend)
function fakeMatrix(n = 25): QrMatrix {
  const rows: string[] = [];
  for (let y = 0; y < n; y++) {
    let r = '';
    for (let x = 0; x < n; x++) {
      const finder = (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
      const ring = (cx: number, cy: number) => { const d = Math.max(Math.abs(x - cx), Math.abs(y - cy)); return d === 3 || d <= 1; };
      const inFinder = finder && (ring(3, 3) || ring(n - 4, 3) || ring(3, n - 4));
      r += finder ? (inFinder ? '1' : '0') : (x * 7 + y * 13 + x * y) % 3 === 0 ? '1' : '0';
    }
    rows.push(r);
  }
  return { size: n, rows };
}
const M = fakeMatrix();
const style = (o: Partial<QrStyle> = {}): QrStyle => ({ ...DEFAULT_STYLE, ...o });
const svgOf = (o: Partial<QrStyle> = {}, logo?: string | null) => renderQrSvg(M, style(o), logo).svg;

describe('contrastRatio / qrWarnings', () => {
  it('ดำ/ขาว = 21:1, สีเดียวกัน = 1:1, สลับที่ได้ผลเท่ากัน', () => {
    assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 0.01);
    assert.ok(Math.abs(contrastRatio('#336699', '#336699') - 1) < 1e-9);
    assert.equal(contrastRatio('#123456', '#fedcba'), contrastRatio('#fedcba', '#123456'));
  });
  it('ค่าเริ่มต้น (ดำบนขาว) ไม่มีคำเตือน', () => assert.deepEqual(qrWarnings(style()), []));
  it('สีใกล้พื้น → lowContrast; จุดสว่างกว่าพื้น → inverted; พื้นโปร่งใส → transparent', () => {
    assert.ok(qrWarnings(style({ fg: '#f0f0f0' })).includes('lowContrast'));
    assert.ok(qrWarnings(style({ fg: '#ffffff', bg: '#000000' })).includes('inverted'));
    assert.deepEqual(qrWarnings(style({ bg: null })), ['transparent']);
  });
  it('ตรวจสีที่สอง/สีตาด้วย ไม่ใช่แค่สีหลัก', () => {
    assert.ok(qrWarnings(style({ fg2: '#fafafa' })).includes('lowContrast'));
    assert.ok(qrWarnings(style({ eyeColor: '#fafafa' })).includes('lowContrast'));
  });
  it('พรีเซ็ตสำเร็จรูปทุกอันต้องสแกนง่าย (ไม่มีคำเตือน)', () => {
    for (const p of PRESETS) assert.deepEqual(qrWarnings(style(p.style)), [], p.id);
  });
});

describe('renderQrSvg', () => {
  it('SVG ถูกต้อง: มี viewBox, กว้าง=สูงตามเมทริกซ์+ขอบ, พื้นหลังตาม bg', () => {
    const r = renderQrSvg(M, style({ margin: 4 }));
    assert.match(r.svg, /^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(r.svg, /viewBox="0 0 /);
    assert.ok(r.svg.includes('#ffffff'));
    assert.ok(r.width > 0 && r.height > 0);
    assert.equal(r.width, r.height, 'ไม่มีข้อความใต้ QR = จัตุรัส');
  });
  it('ขอบ (margin) เพิ่ม → ภาพใหญ่ขึ้น', () => assert.ok(renderQrSvg(M, style({ margin: 8 })).width > renderQrSvg(M, style({ margin: 2 })).width));
  it('ทุกลายจุด × ทุกรูปตา สร้างได้และต่างกัน (ไม่ว่าง ไม่ throw)', () => {
    const seen = new Set<string>();
    for (const dots of DOT_STYLES) for (const eyes of EYE_STYLES) {
      const s = svgOf({ dots, eyes });
      assert.ok(s.length > 500 && !s.includes('undefined') && !s.includes('NaN'), `${dots}/${eyes}`);
      seen.add(s);
    }
    assert.equal(seen.size, DOT_STYLES.length * EYE_STYLES.length);
  });
  it('ไล่เฉดสี: มี linearGradient ทั้งสองสี และทุกทิศมุมให้ผลต่างกัน; ไม่ไล่เฉดไม่มี defs', () => {
    assert.ok(!svgOf({ fg2: null }).includes('linearGradient'));
    const outs = ANGLES.map((angle) => svgOf({ fg: '#112233', fg2: '#445566', angle }));
    for (const s of outs) assert.ok(s.includes('linearGradient') && s.includes('#112233') && s.includes('#445566'));
    assert.equal(new Set(outs).size, ANGLES.length);
  });
  it('พื้นโปร่งใส: ไม่มีแถบพื้นขาวเต็มภาพ', () => {
    assert.ok(svgOf({ bg: '#ffffff' }).includes('#ffffff'));
    assert.ok(!svgOf({ bg: null }).includes('#ffffff'));
  });
  it('สีตาแยก: ปรากฏใน SVG; ไม่ตั้ง = ใช้สีหลัก', () => {
    assert.ok(svgOf({ eyeColor: '#a1b2c3' }).includes('#a1b2c3'));
    assert.ok(!svgOf({ eyeColor: null }).includes('#a1b2c3'));
  });
  it('โลโก้สำเร็จรูปทุกแบบ + โลโก้อัปโหลด: สร้างได้ ขนาดโลโก้มีผล', () => {
    const none = svgOf({ logo: 'none' });
    for (const logo of LOGOS.filter((l) => l !== 'none')) assert.notEqual(svgOf({ logo }), none, logo);
    assert.notEqual(svgOf({ logo: 'star', logoSize: 12 }), svgOf({ logo: 'star', logoSize: 22 }));
    assert.ok(svgOf({}, 'data:image/png;base64,AAAA').includes('data:image/png;base64,AAAA'));
  });
  it('ข้อความใต้ QR: ภาพสูงขึ้น (ไม่ใช่จัตุรัส) ทุกรูปแบบ และ escape อักขระอันตราย', () => {
    const plain = renderQrSvg(M, style());
    for (const captionStyle of CAPTION_STYLES) {
      const r = renderQrSvg(M, style({ caption: 'สแกนเลย', captionStyle }));
      assert.ok(r.height > plain.height, captionStyle);
      assert.ok(r.svg.includes('สแกนเลย'));
    }
    const evil = svgOf({ caption: '<script>alert(1)</script>&"\'' });
    assert.ok(!evil.includes('<script>'), 'ต้อง escape ไม่ให้ฝังสคริปต์');
    assert.ok(evil.includes('&lt;script&gt;'));
  });
  it('เมทริกซ์ขนาดต่างกัน (เวอร์ชัน QR ต่างกัน) ก็วาดได้', () => {
    for (const n of [21, 25, 29, 33, 41]) assert.ok(renderQrSvg(fakeMatrix(n), style({ dots: 'classy', eyes: 'circle' })).svg.length > 500, String(n));
  });
  it('พรีเซ็ตทุกอัน render ได้', () => {
    for (const p of PRESETS) assert.ok(svgOf(p.style).includes('<svg'), p.id);
  });
});
