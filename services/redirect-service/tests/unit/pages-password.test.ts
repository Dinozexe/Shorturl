import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashLinkPassword as hashFromCore, verifyLinkPassword as verifyInCore } from '../../../core-api/src/common/password';
import { limitReachedPage, notFoundPage, notStartedPage, passwordPage } from '../../src/pages';
import { hashLinkPassword, verifyLinkPassword } from '../../src/password';

describe('หน้าข้อความ', () => {
  it('ทุกหน้าเป็น HTML ครบ lang=th, noindex และไม่มีค่าหลุด (undefined/NaN)', () => {
    for (const html of [notFoundPage(), limitReachedPage(), notStartedPage(Date.UTC(2030, 0, 2, 3, 4)), passwordPage('abc12')]) {
      assert.match(html, /^<!doctype html>/i);
      assert.match(html, /<html lang="th">/);
      assert.match(html, /noindex/);
      assert.ok(!html.includes('undefined') && !html.includes('NaN'));
    }
  });
  it('หน้าข้อความ (ไม่พบ/ครบจำนวน/ยังไม่เริ่ม) มีลิงก์กลับหน้าเว็บ และมีทั้งไทย-อังกฤษ', () => {
    for (const html of [notFoundPage(), limitReachedPage(), notStartedPage(Date.UTC(2030, 0, 2, 3, 4))]) {
      assert.match(html, /href="https:\/\/app\.example\.test"/);
      assert.match(html, /<h2>/);
    }
  });
  it('notStarted แสดงวันเริ่มเป็นเวลาไทย (UTC+7)', () => {
    const html = notStartedPage(Date.UTC(2030, 0, 2, 3, 4)); // 10:04 ที่กรุงเทพ
    assert.match(html, /10:04|10\.04/);
    assert.match(html, /2573|2030/);
  });
  it('หน้ารหัสผ่าน: ฟอร์ม POST ไปที่ /{code}, ช่อง password จำกัด 64, ไม่มีค่าปลายทาง', () => {
    const html = passwordPage('abc12');
    assert.match(html, /<form method="post" action="\/abc12">/);
    assert.match(html, /type="password"[^>]*maxlength="64"/);
    assert.ok(!/https?:\/\/(?!app\.example\.test)/.test(html.replace(/xmlns="[^"]*"/g, '')));
  });
  it('ข้อความผิดพลาดแยกกรณี wrong/locked และไม่แสดงเมื่อไม่มีปัญหา', () => {
    assert.ok(!passwordPage('abc12').includes('class="err"'));
    assert.match(passwordPage('abc12', 'wrong'), /class="err"[^>]*>รหัสผ่านไม่ถูกต้อง/);
    assert.match(passwordPage('abc12', 'locked'), /class="err"[^>]*>ลองผิดหลายครั้ง/);
  });
});

describe('รหัสผ่านลิงก์: สองบริการต้องเข้ากันได้ (สัญญาข้ามบริการ)', () => {
  it('hash จาก core-api ตรวจใน redirect-service ได้ และกลับกัน', async () => {
    const fromCore = await hashFromCore('ข้ามบริการ-123');
    const fromRedirect = await hashLinkPassword('ข้ามบริการ-123');
    assert.equal(await verifyLinkPassword('ข้ามบริการ-123', fromCore), true);
    assert.equal(await verifyInCore('ข้ามบริการ-123', fromRedirect), true);
    assert.equal(await verifyLinkPassword('ผิด', fromCore), false);
  });
  it('รูปแบบ hash เหมือนกันทุกประการ scrypt$salt$hash', async () => assert.match(await hashLinkPassword('x-pass'), /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/));
});
