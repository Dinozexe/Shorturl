import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { isoToLocalInput, localInputToIso } from '../lib/format';
import { peekPendingUrl, setPendingUrl, takePendingUrl } from '../lib/pending';

describe('format: datetime-local ↔ ISO', () => {
  it('รูปแบบ YYYY-MM-DDTHH:mm เวลาในเครื่อง และแปลงไป-กลับได้ค่าเดิม', () => {
    const iso = localInputToIso('2030-05-06T07:08')!;
    assert.match(iso, /^2030-05-0\dT\d\d:\d\d:00\.000Z$/);
    assert.equal(isoToLocalInput(iso), '2030-05-06T07:08');
  });
  it('ว่าง/พัง → undefined และสตริงว่าง', () => {
    assert.equal(localInputToIso(''), undefined);
    assert.equal(localInputToIso('not-a-date'), undefined);
    assert.equal(isoToLocalInput(null), '');
  });
  it('เติมศูนย์นำหน้าเดือน/วัน/ชั่วโมง/นาที', () => assert.equal(isoToLocalInput(new Date(2031, 0, 2, 3, 4).toISOString()), '2031-01-02T03:04'));
});

describe('pending url (sessionStorage)', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { sessionStorage?: unknown }).sessionStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  });
  it('set → peek ไม่ลบ → take ลบหลังอ่าน (ใช้ได้ครั้งเดียว)', () => {
    setPendingUrl('https://example.com/x');
    assert.equal(peekPendingUrl(), 'https://example.com/x');
    assert.equal(takePendingUrl(), 'https://example.com/x');
    assert.equal(takePendingUrl(), null);
  });
  it('storage ใช้ไม่ได้ (โหมดส่วนตัว/ถูกบล็อก) ต้องไม่ throw', () => {
    (globalThis as { sessionStorage?: unknown }).sessionStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    assert.doesNotThrow(() => setPendingUrl('https://x.com'));
    assert.equal(peekPendingUrl(), null);
    assert.equal(takePendingUrl(), null);
  });
});
