import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpError } from '../../src/common/http-error';
import { qrMatrix } from '../../src/qr/qr.service';
import { parseQrStyle } from '../../src/qr/qr-style';

const rejects = (raw: unknown) => assert.throws(() => parseQrStyle(raw), (e: unknown) => e instanceof HttpError && e.status === 400);

describe('parseQrStyle', () => {
  it('ค่าเริ่มต้นเมื่อส่งออบเจ็กต์ว่าง', () => {
    const s = parseQrStyle({});
    assert.deepEqual(s, { dots: 'square', eyes: 'square', fg: '#000000', fg2: null, angle: 45, bg: '#ffffff', eyeColor: null, logo: 'none', logoSize: 18, caption: '', captionStyle: 'pill', margin: 4 });
  });

  it('รับค่าถูกต้องทั้งหมด และแปลงสีเป็นตัวพิมพ์เล็ก', () => {
    const s = parseQrStyle({ dots: 'classy', eyes: 'circle', fg: '#1D4ED8', fg2: '#0EA5E9', angle: 90, bg: null, eyeColor: '#FF0000', logo: 'bolt', logoSize: 12, caption: ' สแกนเลย ', captionStyle: 'bar', margin: 6 });
    assert.equal(s.fg, '#1d4ed8');
    assert.equal(s.bg, null);
    assert.equal(s.caption, 'สแกนเลย');
    assert.equal(s.eyeColor, '#ff0000');
    assert.equal(s.dots, 'classy');
  });

  for (const [name, raw] of Object.entries({
    'ไม่ใช่ออบเจ็กต์': 'x', 'null': null, 'array': [], 'dots ผิด': { dots: 'hex' }, 'eyes ผิด': { eyes: 'tri' }, 'สีไม่ใช่ hex6': { fg: 'red' }, 'สี 3 หลัก': { fg: '#fff' },
    'fg2 ผิด': { fg2: 'blue' }, 'มุมไม่อยู่ในรายการ': { angle: 30 }, 'โลโก้ผิด': { logo: 'rocket' }, 'logoSize ต่ำไป': { logoSize: 9 }, 'logoSize สูงไป': { logoSize: 23 },
    'caption ยาวเกิน 24': { caption: 'x'.repeat(25) }, 'captionStyle ผิด': { captionStyle: 'neon' }, 'margin ต่ำไป': { margin: 1 }, 'margin สูงไป': { margin: 9 }, 'margin ทศนิยม': { margin: 3.5 },
    'สีเป็นตัวเลข': { fg: 123 }, 'logoSize ไม่ใช่ตัวเลข': { logoSize: 'abc' },
  })) it(`ปฏิเสธ: ${name}`, () => rejects(raw));

  it('ไม่เก็บฟิลด์แปลกปลอม (ตัดทิ้ง ไม่ปนเข้ามา)', () => {
    const s = parseQrStyle({ dots: 'dots', evil: '<script>', __proto__: { x: 1 } }) as unknown as Record<string, unknown>;
    assert.equal('evil' in s, false);
  });
});

describe('qrMatrix', () => {
  it('เมทริกซ์สี่เหลี่ยมจัตุรัส 0/1 และมี finder pattern มุมซ้ายบน', () => {
    const m = qrMatrix('https://s.example.test/abc12');
    assert.ok(m.size >= 25);
    assert.equal(m.rows.length, m.size);
    assert.ok(m.rows.every((r) => r.length === m.size && /^[01]+$/.test(r)));
    assert.equal(m.rows[0].slice(0, 7), '1111111');
    assert.equal(m.rows[3].slice(0, 7), '1011101');
  });
  it('ข้อความต่างกัน → เมทริกซ์ต่างกัน', () => assert.notDeepEqual(qrMatrix('https://a.test/1').rows, qrMatrix('https://a.test/2').rows));
});
