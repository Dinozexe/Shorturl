import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashLinkPassword, verifyLinkPassword } from '../../src/common/password';

describe('รหัสผ่านของลิงก์ (scrypt)', () => {
  it('hash แล้ว verify ผ่าน; รหัสผิด/ว่าง/ต่างตัวพิมพ์ไม่ผ่าน', async () => {
    const h = await hashLinkPassword('Secret-1');
    assert.match(h, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    assert.equal(await verifyLinkPassword('Secret-1', h), true);
    assert.equal(await verifyLinkPassword('secret-1', h), false);
    assert.equal(await verifyLinkPassword('Secret-2', h), false);
    assert.equal(await verifyLinkPassword('', h), false);
  });
  it('salt สุ่ม: รหัสเดียวกันได้ hash ต่างกัน แต่ verify ผ่านทั้งคู่', async () => {
    const [a, b] = await Promise.all([hashLinkPassword('same-pass'), hashLinkPassword('same-pass')]);
    assert.notEqual(a, b);
    assert.equal(await verifyLinkPassword('same-pass', a), true);
    assert.equal(await verifyLinkPassword('same-pass', b), true);
  });
  it('hash ที่รูปแบบพัง/ไม่รู้จัก → ไม่ผ่าน ไม่ throw', async () => {
    for (const bad of ['', 'plain', 'bcrypt$a$b', 'scrypt$', 'scrypt$zz$zz', 'scrypt$00$']) assert.equal(await verifyLinkPassword('x', bad), false);
  });
  it('รหัสยาว/ภาษาไทย/อีโมจิใช้ได้', async () => {
    for (const p of ['รหัสผ่านภาษาไทย๑๒๓๔', '🔒🔑pass', 'x'.repeat(64)]) assert.equal(await verifyLinkPassword(p, await hashLinkPassword(p)), true);
  });
});
