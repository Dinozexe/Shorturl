import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DICT } from '../lib/i18n';

const keys = (l: 'th' | 'en') => Object.keys(DICT[l]);
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const th = DICT.th as Record<string, string>;
const en = DICT.en as Record<string, string>;

describe('i18n ไทย/อังกฤษ', () => {
  it('คีย์ครบตรงกันทั้งสองภาษา (ไม่มีข้อความตกหล่น)', () => {
    assert.deepEqual(keys('th').filter((k) => !(k in en)), [], 'มีใน th ไม่มีใน en');
    assert.deepEqual(keys('en').filter((k) => !(k in th)), [], 'มีใน en ไม่มีใน th');
  });
  it('ไม่มีข้อความว่าง', () => {
    for (const l of ['th', 'en'] as const) assert.deepEqual(keys(l).filter((k) => !(DICT[l] as Record<string, string>)[k].trim()), [], l);
  });
  it('ตัวแปรในข้อความ {n} {d} ฯลฯ เหมือนกันทั้งสองภาษา (ไม่งั้นข้อความแสดงผลพัง)', () => {
    const bad = keys('th').filter((k) => JSON.stringify(placeholders(th[k])) !== JSON.stringify(placeholders(en[k])));
    assert.deepEqual(bad.map((k) => `${k}: ${placeholders(th[k])} ≠ ${placeholders(en[k])}`), []);
  });
  it('ภาษาอังกฤษไม่มีอักษรไทยหลงมา (ยกเว้นชื่อภาษา "ไทย")', () => {
    const leaked = keys('en').filter((k) => /[\u0E00-\u0E7F]/.test(en[k]) && en[k] !== 'ไทย');
    assert.deepEqual(leaked.map((k) => `${k}: ${en[k]}`), []);
  });
  it('ภาษาไทยใช้คำสะกดที่ตกลงกัน: "ลิงก์" ไม่ใช่ "ลิงค์"', () => {
    assert.deepEqual(keys('th').filter((k) => th[k].includes('ลิงค์')), []);
  });
  it('ไม่มีคำศัพท์เทคนิคที่ตั้งใจเลี่ยงในข้อความผู้ใช้: UUID', () => {
    for (const l of ['th', 'en'] as const) assert.deepEqual(keys(l).filter((k) => /uuid/i.test((DICT[l] as Record<string, string>)[k])), [], l);
  });
  it('คีย์ที่ถอดออกแล้วไม่ค้างอยู่ (หน้ารหัส API / การ์ด referer ถูกถอดออก)', () => {
    assert.deepEqual(keys('th').filter((k) => k.startsWith('keys.') || k === 'nav.keys' || k === 'stats.referrers'), []);
  });
});
