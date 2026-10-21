import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { hashApiKey } from '../../src/auth/api-key';
import { prisma } from '../../src/prisma/client';
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

const mkKey = async (name = 'laptop', body: Record<string, unknown> = {}, token = me.token) => (await api.post('/api/keys', { name, ...body }, token)).body;

describe('สร้าง / ดู / เพิกถอน (เฉพาะ session เว็บ)', () => {
  it('สร้าง: ได้ key เต็มครั้งเดียวรูป surl_ + 32 ตัว; DB เก็บแค่ sha256 + prefix', async () => {
    const r = await api.post('/api/keys', { name: 'laptop' }, me.token);
    assert.equal(r.status, 201);
    assert.match(r.body.key, /^surl_[A-Za-z0-9_-]{32}$/);
    const row = await prisma.apiKey.findUniqueOrThrow({ where: { id: r.body.id } });
    assert.equal(row.keyHash, hashApiKey(r.body.key));
    assert.equal(row.prefix, r.body.key.slice(0, 11));
    assert.ok(!JSON.stringify(row).includes(r.body.key));
  });
  it('รายการไม่เคยคืน key เต็ม/hash และบอกจำนวนสูงสุด', async () => {
    const k = await mkKey();
    const r = await api.get('/api/keys', me.token);
    const text = JSON.stringify(r.body);
    assert.ok(!text.includes(k.key) && !text.includes(hashApiKey(k.key)));
    assert.equal(r.body.max, 10);
    assert.equal(r.body.items[0].name, 'laptop');
  });
  it('แต่ละคนเห็นเฉพาะของตัวเอง และลบของคนอื่นไม่ได้ (404)', async () => {
    const k = await mkKey();
    const other = await makeUser();
    assert.equal((await api.get('/api/keys', other.token)).body.items.length, 0);
    assert.equal((await api.del(`/api/keys/${k.id}`, other.token)).status, 404);
    assert.equal((await api.del('/api/keys/abc', me.token)).status, 404);
  });
  for (const [name, body] of Object.entries({ 'ชื่อว่าง': { name: '  ' }, 'ชื่อยาวเกิน 40': { name: 'x'.repeat(41) }, 'อายุ 0 วัน': { name: 'a', expiresInDays: 0 }, 'อายุเกิน 365': { name: 'a', expiresInDays: 366 }, 'อายุไม่ใช่ตัวเลข': { name: 'a', expiresInDays: '5' }, 'อายุทศนิยม': { name: 'a', expiresInDays: 1.5 } })) {
    it(`ปฏิเสธ: ${name} → 400`, async () => assert.equal((await api.post('/api/keys', body, me.token)).status, 400));
  }
  it('ตั้งอายุได้ (≈ +N วัน) และ null = ไม่หมดอายุ', async () => {
    const e = await mkKey('exp', { expiresInDays: 30 });
    assert.ok(Math.abs(Date.parse(e.expiresAt) - (Date.now() + 30 * 864e5)) < 60_000);
    assert.equal((await mkKey('never', { expiresInDays: null })).expiresAt, null);
  });
  it('สูงสุด 10 อัน/คน (อันที่ 11 → 400) และเพิกถอนแล้วสร้างใหม่ได้', async () => {
    for (let i = 0; i < 10; i++) await prisma.apiKey.create({ data: { userId: me.user.id, name: `k${i}`, prefix: 'surl_xxxxxx', keyHash: hashApiKey(`seed-${i}`) } });
    const r = await api.post('/api/keys', { name: 'eleventh' }, me.token);
    assert.equal(r.status, 400);
    assert.match(r.body.message, /10/);
    const first = await prisma.apiKey.findFirstOrThrow({ where: { userId: me.user.id } });
    await api.del(`/api/keys/${first.id}`, me.token);
    assert.equal((await api.post('/api/keys', { name: 'again' }, me.token)).status, 201);
  });
  it('บันทึก audit ตอนสร้างและเพิกถอน', async () => {
    const k = await mkKey('audited');
    await api.del(`/api/keys/${k.id}`, me.token);
    assert.equal(await prisma.auditLog.count({ where: { action: 'API_KEY_CREATE', actorId: me.user.id } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { action: 'API_KEY_REVOKE', actorId: me.user.id } }), 1);
  });
  it('ต้องล็อกอิน (401)', async () => assert.equal((await api.get('/api/keys')).status, 401));
});

describe('ใช้ key เรียก API', () => {
  it('ใช้เป็น Bearer ได้กับ /me และลิงก์ของเจ้าของ (สร้าง/ดู/แก้/QR/ลบ)', async () => {
    const { key } = await mkKey();
    assert.equal((await api.get('/api/auth/me', key)).body.email, me.user.email);
    const l = await api.post('/api/links', { url: 'https://example.com/via-key' }, key);
    assert.equal(l.status, 201);
    assert.equal((await prisma.link.findUniqueOrThrow({ where: { id: l.body.id } })).userId, me.user.id);
    assert.equal((await api.get('/api/links', key)).body.total, 1);
    assert.equal((await api.patch(`/api/links/${l.body.id}`, { status: 'DISABLED' }, key)).status, 200);
    assert.equal((await api.get(`/api/links/${l.body.id}/qr?format=svg`, key)).status, 200);
    assert.equal((await api.del(`/api/links/${l.body.id}`, key)).status, 204);
  });
  it('ไม่เห็นลิงก์ของคนอื่น', async () => {
    const { key } = await mkKey();
    const other = await makeUser();
    const t = (await api.post('/api/links', { url: 'https://example.com/t' }, other.token)).body;
    assert.equal((await api.get(`/api/links/${t.id}`, key)).status, 404);
  });
  it('จัดการ key เองด้วย key ไม่ได้ (403 ทั้ง list/create/delete)', async () => {
    const k = await mkKey();
    assert.equal((await api.get('/api/keys', k.key)).status, 403);
    assert.equal((await api.post('/api/keys', { name: 'x' }, k.key)).status, 403);
    assert.equal((await api.del(`/api/keys/${k.id}`, k.key)).status, 403);
  });
  it('เจ้าของเป็น ADMIN แต่ใช้ key เข้า /api/admin/* ไม่ได้ (403) — ต่างจาก session', async () => {
    const admin = await makeUser('ADMIN');
    const { key } = await mkKey('admin-key', {}, admin.token);
    assert.equal((await api.get('/api/admin/overview', admin.token)).status, 200);
    assert.equal((await api.get('/api/admin/overview', key)).status, 403);
  });
  it('บันทึก lastUsedAt', async () => {
    const k = await mkKey();
    assert.equal((await prisma.apiKey.findUniqueOrThrow({ where: { id: k.id } })).lastUsedAt, null);
    await api.get('/api/auth/me', k.key);
    await new Promise((r) => setTimeout(r, 150));
    assert.ok((await prisma.apiKey.findUniqueOrThrow({ where: { id: k.id } })).lastUsedAt);
  });
  for (const [name, mutate] of [['key มั่ว', () => `surl_${'a'.repeat(32)}`], ['แก้ 1 ตัวอักษร', (k: string) => k.slice(0, -1) + (k.endsWith('A') ? 'B' : 'A')], ['มีแต่ prefix', () => 'surl_'], ['ต่อท้ายเพิ่ม', (k: string) => k + 'x']] as const) {
    it(`401: ${name}`, async () => {
      const { key } = await mkKey();
      assert.equal((await api.get('/api/links', mutate(key))).status, 401);
    });
  }
  it('เพิกถอนแล้วใช้ไม่ได้ทันที (401)', async () => {
    const k = await mkKey();
    assert.equal((await api.get('/api/links', k.key)).status, 200);
    await api.del(`/api/keys/${k.id}`, me.token);
    assert.equal((await api.get('/api/links', k.key)).status, 401);
  });
  it('หมดอายุแล้วใช้ไม่ได้ (401) และรายการขึ้น expired', async () => {
    const k = await mkKey('short', { expiresInDays: 1 });
    await prisma.apiKey.update({ where: { id: k.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await api.get('/api/links', k.key)).status, 401);
    assert.equal((await api.get('/api/keys', me.token)).body.items.find((x: { id: number }) => x.id === k.id).expired, true);
  });
  it('เจ้าของถูกระงับ → key ใช้ไม่ได้ทันที (403)', async () => {
    const { key } = await mkKey();
    await prisma.user.update({ where: { id: me.user.id }, data: { isBanned: true } });
    assert.equal((await api.get('/api/links', key)).status, 403);
  });
  it('ลบผู้ใช้ → key หายตาม (cascade)', async () => {
    const k = await mkKey();
    await prisma.user.delete({ where: { id: me.user.id } });
    assert.equal(await prisma.apiKey.count({ where: { id: k.id } }), 0);
    assert.equal((await api.get('/api/links', k.key)).status, 401);
  });
});
