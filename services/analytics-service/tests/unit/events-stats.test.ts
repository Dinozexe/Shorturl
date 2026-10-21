import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseEvent } from '../../src/events';
import { windowStart } from '../../src/stats';

const H = 'a'.repeat(64);
const good = (o: object = {}) => JSON.stringify({ l: 1, h: H, ua: 'Mozilla', r: 'https://t.co', c: 'TH', d: 'mobile', o: 'iOS', b: 'Safari', t: 1_800_000_000_000, ...o });
const NOW = 1_800_000_000_000;

describe('parseEvent (ตรวจเหตุการณ์คลิกจากคิว — ข้อมูลผิดถูกทิ้ง ไม่ขวางรายการอื่น)', () => {
  it('เหตุการณ์ถูกต้อง → แปลงชื่อฟิลด์ครบ', () => {
    assert.deepEqual(parseEvent(good(), NOW), { linkId: 1, ipHash: H, userAgent: 'Mozilla', referer: 'https://t.co', country: 'TH', device: 'mobile', os: 'iOS', browser: 'Safari', ts: 1_800_000_000_000 });
  });
  for (const [name, raw] of Object.entries({
    'ไม่ใช่ JSON': '{oops', 'null': 'null', 'array': '[]', 'string': '"x"', 'ไม่มี l': good({ l: undefined }), 'l เป็น string': good({ l: '1' }), 'l = 0': good({ l: 0 }), 'l ติดลบ': good({ l: -3 }),
    'l ทศนิยม': good({ l: 1.5 }), 'l เกิน int32': good({ l: 2147483648 }), 'h สั้นไป': good({ h: 'abc' }), 'h ไม่ใช่ hex': good({ h: 'z'.repeat(64) }), 'h ตัวพิมพ์ใหญ่': good({ h: 'A'.repeat(64) }),
    'ไม่มี t': good({ t: undefined }), 't ก่อนปี 2020': good({ t: 1000 }), 't อนาคตเกิน 1 วัน': good({ t: NOW + 2 * 864e5 }), 't เป็น string': good({ t: '1800000000000' }), 't = NaN/null': good({ t: null }),
  })) it(`ทิ้ง: ${name}`, () => assert.equal(parseEvent(raw, NOW), null));

  it('ยอมเวลาล้ำอนาคตไม่เกิน 1 วัน (นาฬิกาเครื่องเพี้ยนเล็กน้อย)', () => assert.ok(parseEvent(good({ t: NOW + 3_600_000 }), NOW)));
  it('ประเทศต้องเป็น ISO2 ตัวใหญ่ ไม่งั้นเป็น null', () => {
    for (const c of ['th', 'THA', 'T', '1A', 5, null]) assert.equal(parseEvent(good({ c }), NOW)!.country, null, String(c));
    assert.equal(parseEvent(good({ c: 'JP' }), NOW)!.country, 'JP');
  });
  it('device ที่ไม่รู้จักกลายเป็น unknown', () => {
    assert.equal(parseEvent(good({ d: 'toaster' }), NOW)!.device, 'unknown');
    for (const d of ['desktop', 'mobile', 'tablet', 'bot', 'unknown']) assert.equal(parseEvent(good({ d }), NOW)!.device, d);
  });
  it('ตัด NUL (\\u0000) ที่ Postgres รับไม่ได้ และจำกัดความยาวข้อความ', () => {
    const e = parseEvent(good({ ua: 'a\u0000b', r: 'x'.repeat(2000), o: 'o'.repeat(500) }), NOW)!;
    assert.equal(e.userAgent, 'ab');
    assert.equal(e.referer!.length, 512);
    assert.equal(e.os!.length, 64);
  });
  it('ข้อความว่าง/ไม่ใช่ string → null', () => {
    const e = parseEvent(good({ ua: '', r: 5, o: null, b: undefined }), NOW)!;
    assert.deepEqual([e.userAgent, e.referer, e.os, e.browser], [null, null, null, null]);
  });
  it('ts ถูกปัดเป็นจำนวนเต็ม ms', () => assert.equal(parseEvent(good({ t: NOW + 0.7 }), NOW)!.ts, NOW));
});

describe('windowStart', () => {
  it('days วันล่าสุดรวมวันนี้ (UTC) เริ่มตอน 00:00', () => {
    const now = new Date('2026-10-21T15:30:00Z');
    assert.equal(windowStart(1, now).toISOString(), '2026-10-21T00:00:00.000Z');
    assert.equal(windowStart(7, now).toISOString(), '2026-10-15T00:00:00.000Z');
    assert.equal(windowStart(30, now).toISOString(), '2026-09-22T00:00:00.000Z');
  });
  it('ข้ามเดือน/ปี และปีอธิกสุรทิน', () => {
    assert.equal(windowStart(3, new Date('2027-01-01T00:00:00Z')).toISOString(), '2026-12-30T00:00:00.000Z');
    assert.equal(windowStart(2, new Date('2028-03-01T10:00:00Z')).toISOString(), '2028-02-29T00:00:00.000Z');
  });
});
