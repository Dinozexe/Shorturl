import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { prisma } from '../../src/prisma/client';
import { redis } from '../../src/redis/client';
import { client, makeUser, resetState, shutdown, startServer, type TestServer } from '../helpers';

let srv: TestServer;
let api: ReturnType<typeof client>;
let me: Awaited<ReturnType<typeof makeUser>>;

before(async () => {
  srv = await startServer();
  api = client(srv.base);
});
after(() => shutdown(srv));
beforeEach(async () => {
  await resetState();
  me = await makeUser();
});

describe('ย่อลิงก์โดยไม่ล็อกอิน (guest)', () => {
  const guest = (body: unknown) => api.post('/api/guest/links', body);

  it('ได้ลิงก์สั้น หมดอายุใน 7 วัน ไม่ผูกกับผู้ใช้ และตอบเฉพาะฟิลด์ที่จำเป็น', async () => {
    const r = await guest({ url: 'https://example.com/guest' });
    assert.equal(r.status, 201);
    assert.deepEqual(Object.keys(r.body).sort(), ['expiresAt', 'originalUrl', 'shortUrl']);
    assert.match(r.body.shortUrl, /^https:\/\/s\.example\.test\/[0-9A-Za-z]{5}$/);
    const days = (Date.parse(r.body.expiresAt) - Date.now()) / 864e5;
    assert.ok(days > 6.99 && days <= 7.001, String(days));
    const row = await prisma.link.findFirstOrThrow({ where: { shortCode: r.body.shortUrl.split('/').pop() } });
    assert.equal(row.userId, null);
  });
  it('ไม่รับฟิลด์พิเศษ (alias/รหัสผ่าน/จำกัดครั้ง/วันหมดอายุเอง): ถูกเมินทั้งหมด', async () => {
    const r = await guest({ url: 'https://example.com/guest', alias: 'my-alias', password: 'abcd', maxClicks: 1, startsAt: '2030-01-01', expiresAt: '2099-01-01T00:00:00Z' });
    const code = r.body.shortUrl.split('/').pop();
    assert.notEqual(code, 'my-alias');
    const row = await prisma.link.findFirstOrThrow({ where: { shortCode: code } });
    assert.deepEqual([row.passwordHash, row.maxClicks, row.startsAt], [null, null, null]);
    assert.ok(row.expiresAt!.getTime() < Date.now() + 7.01 * 864e5);
  });
  for (const [name, body] of Object.entries({ 'ไม่ส่ง url': {}, 'ไม่ใช่ http': { url: 'ftp://x.com' }, 'IP ภายใน': { url: 'http://127.0.0.1' }, 'ลิงก์ของระบบเอง': { url: 'https://s.example.test/abc' } })) {
    it(`ปฏิเสธ 400: ${name}`, async () => assert.equal((await guest(body)).status, 400));
  }
  it('โดเมนต้องห้ามใช้กับ guest ด้วย', async () => {
    await prisma.blockedDomain.create({ data: { domain: 'blocked.test' } });
    assert.equal((await guest({ url: 'https://blocked.test/x' })).status, 400);
  });
  it('จำกัดอัตรา 10 ครั้ง/นาที/IP → ครั้งที่ 11 ได้ 429', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) codes.push((await guest({ url: `https://example.com/${i}` })).status);
    assert.deepEqual(codes, [...Array(10).fill(201), 429]);
  });
  it('เขียน cache ให้ redirect-service ใช้ได้ทันที พร้อม TTL ไม่เกิน 1 ชม.', async () => {
    const r = await guest({ url: 'https://example.com/guest' });
    const code = r.body.shortUrl.split('/').pop();
    assert.equal(JSON.parse((await redis.get(`link:${code}`))!).u, 'https://example.com/guest');
    assert.ok((await redis.ttl(`link:${code}`)) <= 3600);
  });
  it('guest ใช้ API ของสมาชิกไม่ได้ (QR/สถิติ/รายการ → 401)', async () => {
    for (const p of ['/api/links', '/api/links/1/qr', '/api/links/1/stats']) assert.equal((await api.get(p)).status, 401);
  });
});

describe('QR Code', () => {
  const mk = async (token = me.token) => (await api.post('/api/links', { url: 'https://example.com/qr', alias: `qr-${Math.random().toString(36).slice(2, 8)}` }, token)).body;

  it('PNG: ไฟล์ PNG จริง (magic bytes) เป็นค่าเริ่มต้น และขนาดโตตาม scale', async () => {
    const l = await mk();
    const small = await api.get(`/api/links/${l.id}/qr?scale=2`, me.token);
    const big = await api.get(`/api/links/${l.id}/qr?scale=12`, me.token);
    assert.equal(small.status, 200);
    assert.match(small.headers.get('content-type')!, /image\/png/);
    assert.deepEqual([...small.body.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
    assert.ok(big.body.length > small.body.length);
  });
  it('SVG: เป็น <svg> และ download=1 ได้ชื่อไฟล์', async () => {
    const l = await mk();
    const r = await api.get(`/api/links/${l.id}/qr?format=svg&download=1`, me.token);
    assert.match(r.headers.get('content-type')!, /svg/);
    assert.match(String(r.body), /<svg/);
    assert.match(r.headers.get('content-disposition')!, new RegExp(`qr-${l.shortCode}\\.svg`));
  });
  it('matrix: คืน {size,rows,style} (style = null ถ้ายังไม่เคยตั้ง)', async () => {
    const l = await mk();
    const r = await api.get(`/api/links/${l.id}/qr?format=matrix`, me.token);
    assert.equal(r.status, 200);
    assert.ok(r.body.size >= 25 && r.body.rows.length === r.body.size && r.body.style === null);
  });
  for (const q of ['format=gif', 'format=', 'scale=0', 'scale=21', 'scale=1.5', 'scale=abc']) {
    it(`พารามิเตอร์ผิด ${q} → 400`, async () => assert.equal((await api.get(`/api/links/${(await mk()).id}/qr?${q}`, me.token)).status, 400));
  }
  it('QR ของคนอื่น → 404', async () => {
    const l = await mk();
    const other = await makeUser();
    assert.equal((await api.get(`/api/links/${l.id}/qr`, other.token)).status, 404);
  });
});

describe('สไตล์ QR ที่บันทึกกับลิงก์', () => {
  const put = (id: number, style: unknown, token = me.token) => api.put(`/api/links/${id}/qr-style`, { style }, token);
  const mk = async () => (await api.post('/api/links', { url: 'https://example.com/qr' }, me.token)).body;

  it('บันทึกได้ → ถูกตรวจ/เติมค่าเริ่มต้น → คืนใน dto และใน matrix', async () => {
    const l = await mk();
    const r = await put(l.id, { dots: 'diamond', fg: '#1D4ED8', caption: 'สแกนเลย' });
    assert.equal(r.status, 200);
    assert.equal(r.body.style.fg, '#1d4ed8');
    assert.equal(r.body.style.eyes, 'square');
    assert.equal((await api.get(`/api/links/${l.id}`, me.token)).body.qrStyle.dots, 'diamond');
    assert.equal((await api.get(`/api/links/${l.id}/qr?format=matrix`, me.token)).body.style.caption, 'สแกนเลย');
  });
  it('null = ล้างสไตล์กลับค่าเริ่มต้น', async () => {
    const l = await mk();
    await put(l.id, { dots: 'dots' });
    assert.equal((await put(l.id, null)).status, 200);
    assert.equal((await api.get(`/api/links/${l.id}`, me.token)).body.qrStyle, null);
  });
  for (const [name, style] of Object.entries({ 'dots ผิด': { dots: 'star' }, 'สีผิด': { fg: 'red' }, 'ข้อความยาวเกิน': { caption: 'x'.repeat(25) }, 'ไม่ใช่ออบเจ็กต์': 'abc' })) {
    it(`ปฏิเสธ: ${name} → 400 และของเดิมไม่เปลี่ยน`, async () => {
      const l = await mk();
      await put(l.id, { dots: 'rounded' });
      assert.equal((await put(l.id, style)).status, 400);
      assert.equal((await api.get(`/api/links/${l.id}`, me.token)).body.qrStyle.dots, 'rounded');
    });
  }
  it('ไม่ส่ง style → 400; ของคนอื่น → 404', async () => {
    const l = await mk();
    assert.equal((await api.put(`/api/links/${l.id}/qr-style`, {}, me.token)).status, 400);
    assert.equal((await put(l.id, { dots: 'dots' }, (await makeUser()).token)).status, 404);
  });
});
