import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpError } from '../../src/common/http-error';
import { generateShortCode, hostSuffixes, validateAlias, validateTargetUrl } from '../../src/common/url-validator';

const rejects = (fn: () => unknown, re?: RegExp) =>
  assert.throws(fn, (e: unknown) => e instanceof HttpError && e.status === 400 && (!re || re.test(e.message)));

describe('validateTargetUrl', () => {
  it('รับ http/https สาธารณะ และคืน href + host (lowercase)', () => {
    const r = validateTargetUrl('  https://Example.COM/Path?q=1#x ');
    assert.equal(r.host, 'example.com');
    assert.equal(r.href, 'https://example.com/Path?q=1#x');
    assert.equal(validateTargetUrl('http://sub.example.co.th').host, 'sub.example.co.th');
  });

  it('ตัดจุดท้ายชื่อโดเมน (example.com. = example.com)', () => {
    assert.equal(validateTargetUrl('https://example.com./a').host, 'example.com');
  });

  for (const bad of ['', '   ', 'example.com', 'ftp://example.com', 'javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,hi', 'not a url', '//example.com']) {
    it(`ปฏิเสธ scheme/รูปแบบที่ไม่ใช่ http(s): ${JSON.stringify(bad)}`, () => rejects(() => validateTargetUrl(bad)));
  }

  it('ปฏิเสธ credentials ฝังใน URL', () => rejects(() => validateTargetUrl('https://user:pw@example.com'), /ชื่อผู้ใช้/));
  it('ปฏิเสธ URL ยาวเกินกำหนด', () => rejects(() => validateTargetUrl(`https://example.com/${'a'.repeat(2100)}`)));

  const internal = [
    'http://localhost/x', 'http://intranet', 'http://printer.local', 'http://svc.internal', 'http://router.lan',
    'http://127.0.0.1', 'http://127.1.2.3', 'http://10.0.0.5', 'http://172.16.0.1', 'http://172.31.255.255', 'http://192.168.1.1',
    'http://169.254.169.254/latest/meta-data', 'http://100.64.0.1', 'http://0.0.0.0', 'http://224.0.0.1', 'http://255.255.255.255',
    'http://[::1]/', 'http://[fe80::1]/',
  ];
  for (const u of internal) it(`ปฏิเสธปลายทางภายใน/สงวน (กัน SSRF): ${u}`, () => rejects(() => validateTargetUrl(u)));

  it('IP สาธารณะที่ติดช่วงสงวนใกล้เคียงต้องผ่าน (172.32.x, 100.128.x)', () => {
    assert.equal(validateTargetUrl('http://172.32.0.1').host, '172.32.0.1');
    assert.equal(validateTargetUrl('http://8.8.8.8').host, '8.8.8.8');
  });

  it('ปฏิเสธโดเมนของระบบเอง (ลิงก์สั้น/API) แต่หน้าเว็บหลักย่อได้', () => {
    rejects(() => validateTargetUrl('https://s.example.test/abc12'), /ระบบนี้/);
    rejects(() => validateTargetUrl('https://api.example.test/api/health'), /ระบบนี้/);
    assert.equal(validateTargetUrl('https://app.example.test/features/').host, 'app.example.test');
  });
});

describe('validateAlias', () => {
  for (const ok of ['abc', 'Promo-2026', 'a_b-c', 'A1b', 'x'.repeat(30)]) it(`รับ ${ok.slice(0, 12)}`, () => assert.equal(validateAlias(ok), ok));
  for (const bad of ['', 'ab', 'x'.repeat(31), '-abc', 'abc-', '_abc', 'a b c', 'ไทย123', 'a/b', 'a.b', 'a@b']) {
    it(`ปฏิเสธรูปแบบผิด ${JSON.stringify(bad.slice(0, 12))}`, () => rejects(() => validateAlias(bad)));
  }
  for (const reserved of ['api', 'ADMIN', 'Login', 'dashboard', 'keys']) {
    it(`ปฏิเสธคำสงวน ${reserved} (ไม่แยกตัวพิมพ์)`, () => rejects(() => validateAlias(reserved), /สงวน/));
  }
  it('_next ถูกปฏิเสธ (ขึ้นต้นด้วย _ ผิดรูปแบบอยู่แล้ว)', () => rejects(() => validateAlias('_next')));
  it('alias แยกตัวพิมพ์เล็กใหญ่ (เก็บตามที่ผู้ใช้พิมพ์)', () => assert.equal(validateAlias('MyLink'), 'MyLink'));
});

describe('generateShortCode', () => {
  it('ได้ความยาวตามสั่งและมีเฉพาะ base62', () => {
    for (const n of [3, 5, 8, 12]) {
      const c = generateShortCode(n);
      assert.equal(c.length, n);
      assert.match(c, /^[0-9A-Za-z]+$/);
    }
  });
  it('สุ่มจริง: 200 รหัสความยาว 8 ไม่ซ้ำกัน', () => {
    const set = new Set(Array.from({ length: 200 }, () => generateShortCode(8)));
    assert.equal(set.size, 200);
  });
  it('ไม่เคยได้คำสงวน', () => {
    for (let i = 0; i < 500; i++) assert.ok(!['api', 'www', 'app', 'qr'].includes(generateShortCode(3).toLowerCase()));
  });
});

describe('hostSuffixes', () => {
  it('a.b.com → [a.b.com, b.com, com]', () => assert.deepEqual(hostSuffixes('a.b.com'), ['a.b.com', 'b.com', 'com']));
  it('host เดียว', () => assert.deepEqual(hostSuffixes('com'), ['com']));
});
