import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { verifyLinkPassword } from '../../src/common/password';
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

const create = (extra: Record<string, unknown> = {}) => api.post('/api/links', { url: 'https://example.com/p', ...extra }, me.token);
const patch = (id: number, body: Record<string, unknown>) => api.patch(`/api/links/${id}`, body, me.token);
const cached = async (code: string) => JSON.parse((await redis.get(`link:${code}`))!);
const hour = 3_600_000;

describe('ค่าเริ่มต้น: ไม่ตั้งอะไร = ทำงานเหมือนเดิม', () => {
  it('dto ไม่มีการป้องกัน และ cache ไม่มี s/m/p', async () => {
    const r = await create();
    assert.deepEqual({ s: r.body.startsAt, ns: r.body.notStarted, m: r.body.maxClicks, lr: r.body.limitReached, pw: r.body.hasPassword }, { s: null, ns: false, m: null, lr: false, pw: false });
    assert.deepEqual(Object.keys(await cached(r.body.shortCode)).sort(), ['e', 'i', 'u']);
    assert.equal(await redis.exists(`lim:${r.body.id}`), 0);
  });
});

describe('รหัสผ่านของลิงก์', () => {
  it('ตั้งได้: hasPassword=true, DB เก็บ scrypt hash (ไม่ใช่ข้อความจริง), API ไม่คืน hash/รหัส', async () => {
    const r = await create({ password: 'secret-1' });
    assert.equal(r.status, 201);
    assert.equal(r.body.hasPassword, true);
    const text = JSON.stringify(r.body);
    assert.ok(!text.includes('secret-1') && !text.includes('scrypt') && !('passwordHash' in r.body));
    const row = await prisma.link.findUniqueOrThrow({ where: { id: r.body.id } });
    assert.ok(row.passwordHash!.startsWith('scrypt$') && !row.passwordHash!.includes('secret-1'));
    assert.equal(await verifyLinkPassword('secret-1', row.passwordHash!), true);
    assert.equal((await cached(r.body.shortCode)).p, 1, 'cache ต้องบอก redirect-service ว่ามีรหัส');
    assert.ok(!(await redis.get(`link:${r.body.shortCode}`))!.includes('scrypt'), 'hash ต้องไม่อยู่ใน cache');
  });
  for (const [name, pw] of [['สั้นไป (3)', 'abc'], ['ยาวไป (65)', 'x'.repeat(65)], ['ว่างหลังตัด? (ช่องว่างล้วน 3)', '   '], ['ไม่ใช่ string', 12345]] as const) {
    it(`ปฏิเสธ: ${name} → 400`, async () => assert.equal((await create({ password: pw })).status, 400));
  }
  it('ความยาวขอบเขต 4 และ 64 ผ่าน; ภาษาไทย/อีโมจิผ่าน', async () => {
    for (const pw of ['abcd', 'x'.repeat(64), 'รหัสผ่านลับ', '🔒🔒🔒🔒']) assert.equal((await create({ password: pw })).status, 201, pw.slice(0, 6));
  });
  it('แก้รหัส: เปลี่ยนได้; ส่ง null = ลบ; ไม่ส่ง = ไม่เปลี่ยน', async () => {
    const l = (await create({ password: 'first-pass' })).body;
    const h1 = (await prisma.link.findUniqueOrThrow({ where: { id: l.id } })).passwordHash;
    await patch(l.id, { url: 'https://example.com/changed' });
    assert.equal((await prisma.link.findUniqueOrThrow({ where: { id: l.id } })).passwordHash, h1, 'แก้อย่างอื่นต้องไม่ทำรหัสหาย');
    await patch(l.id, { password: 'second-pass' });
    const h2 = (await prisma.link.findUniqueOrThrow({ where: { id: l.id } })).passwordHash!;
    assert.notEqual(h2, h1);
    assert.equal(await verifyLinkPassword('second-pass', h2), true);
    const off = await patch(l.id, { password: null });
    assert.equal(off.body.hasPassword, false);
    assert.equal((await cached(l.shortCode)).p, undefined);
    assert.equal((await patch(l.id, { password: 'ab' })).status, 400);
  });
});

describe('จำกัดจำนวนครั้งที่เปิด', () => {
  it('ตั้งได้: dto + cache m + ตัวนับ lim:{id} เริ่มจากยอดคลิกปัจจุบัน', async () => {
    const r = await create({ maxClicks: 5 });
    assert.deepEqual({ m: r.body.maxClicks, lr: r.body.limitReached }, { m: 5, lr: false });
    assert.equal((await cached(r.body.shortCode)).m, 5);
    assert.equal(await redis.get(`lim:${r.body.id}`), '0');
  });
  for (const v of [0, -1, 1.5, '5', 1_000_001, true]) {
    it(`ปฏิเสธ: ${JSON.stringify(v)} → 400`, async () => assert.equal((await create({ maxClicks: v })).status, 400));
  }
  it('ขอบเขต 1 และ 1,000,000 ผ่าน', async () => {
    for (const v of [1, 1_000_000]) assert.equal((await create({ maxClicks: v })).status, 201);
  });
  it('limitReached = true เมื่อ clickCount ถึงเพดาน', async () => {
    const l = (await create({ maxClicks: 3 })).body;
    await prisma.link.update({ where: { id: l.id }, data: { clickCount: 3 } });
    assert.equal((await api.get(`/api/links/${l.id}`, me.token)).body.limitReached, true);
  });
  it('เปลี่ยนเพดาน → รีเซ็ตตัวนับจากยอดคลิกใน DB; เอาออก (null) → ลบตัวนับ + m หายจาก cache; ลบลิงก์ → ตัวนับหาย', async () => {
    const l = (await create({ maxClicks: 3 })).body;
    await prisma.link.update({ where: { id: l.id }, data: { clickCount: 2 } });
    await patch(l.id, { maxClicks: 10 });
    assert.equal(await redis.get(`lim:${l.id}`), '2');
    assert.equal((await cached(l.shortCode)).m, 10);
    await patch(l.id, { maxClicks: null });
    assert.equal(await redis.exists(`lim:${l.id}`), 0);
    assert.equal((await cached(l.shortCode)).m, undefined);
    await patch(l.id, { maxClicks: 4 });
    assert.equal(await redis.exists(`lim:${l.id}`), 1);
    await api.del(`/api/links/${l.id}`, me.token);
    assert.equal(await redis.exists(`lim:${l.id}`), 0);
  });
  it('แก้อย่างอื่น (ไม่แตะ maxClicks) ต้องไม่รีเซ็ตตัวนับ', async () => {
    const l = (await create({ maxClicks: 9 })).body;
    await redis.set(`lim:${l.id}`, '4');
    await patch(l.id, { url: 'https://example.com/other' });
    assert.equal(await redis.get(`lim:${l.id}`), '4');
  });
});

describe('วันเริ่มใช้งาน', () => {
  it('อนาคต: notStarted=true และ cache s = เวลานั้น', async () => {
    const at = new Date(Date.now() + hour).toISOString();
    const r = await create({ startsAt: at });
    assert.equal(r.body.notStarted, true);
    assert.equal((await cached(r.body.shortCode)).s, Date.parse(at));
  });
  it('อดีตผ่านได้ (หมายถึงเริ่มแล้ว) notStarted=false', async () => {
    const r = await create({ startsAt: new Date(Date.now() - hour).toISOString() });
    assert.equal(r.status, 201);
    assert.equal(r.body.notStarted, false);
  });
  for (const [name, v] of [['ข้อความมั่ว', 'soon'], ['เกิน 10 ปี', new Date(Date.now() + 11 * 365 * 864e5).toISOString()], ['ไม่ใช่ string', 123]] as const) {
    it(`ปฏิเสธ: ${name} → 400`, async () => assert.equal((await create({ startsAt: v })).status, 400));
  }
  it('ต้องมาก่อนวันหมดอายุเสมอ (ทั้งตอนสร้างและตอนแก้ ไม่ว่าฝั่งไหนเปลี่ยน)', async () => {
    const a = new Date(Date.now() + 2 * hour).toISOString();
    const b = new Date(Date.now() + hour).toISOString();
    assert.equal((await create({ startsAt: a, expiresAt: b })).status, 400);
    assert.equal((await create({ startsAt: a, expiresAt: a })).status, 400);
    const l = (await create({ startsAt: b, expiresAt: a })).body;
    assert.equal((await patch(l.id, { expiresAt: new Date(Date.now() + 1800_000).toISOString() })).status, 400, 'ย้ายวันหมดอายุมาก่อนวันเริ่ม');
    assert.equal((await patch(l.id, { startsAt: new Date(Date.now() + 3 * hour).toISOString() })).status, 400, 'ย้ายวันเริ่มไปหลังวันหมดอายุ');
  });
  it('แก้/ล้าง: ตั้งใหม่ได้, null = เริ่มทันที', async () => {
    const l = (await create({ startsAt: new Date(Date.now() + hour).toISOString() })).body;
    const cleared = await patch(l.id, { startsAt: null });
    assert.equal(cleared.body.startsAt, null);
    assert.equal(cleared.body.notStarted, false);
    assert.equal((await cached(l.shortCode)).s, undefined);
  });
});

describe('ใช้ร่วมกัน + ความเป็นเจ้าของ', () => {
  it('ตั้งครบสามอย่างพร้อมกัน แล้ว cache มี s,m,p ครบ', async () => {
    const r = await create({ password: 'combo-pass', maxClicks: 2, startsAt: new Date(Date.now() + hour).toISOString() });
    const c = await cached(r.body.shortCode);
    assert.deepEqual([typeof c.s, c.m, c.p], ['number', 2, 1]);
  });
  it('ลิงก์ที่ถูกปิด: ไม่มี cache แม้ตั้งการป้องกัน', async () => {
    const l = (await create({ password: 'combo-pass', maxClicks: 2 })).body;
    await patch(l.id, { status: 'DISABLED' });
    assert.equal(await redis.get(`link:${l.shortCode}`), null);
  });
  it('คนอื่นแก้การป้องกันของลิงก์เราไม่ได้ (404)', async () => {
    const l = (await create({ password: 'combo-pass' })).body;
    const intruder = await makeUser();
    assert.equal((await api.patch(`/api/links/${l.id}`, { password: null }, intruder.token)).status, 404);
    assert.equal((await prisma.link.findUniqueOrThrow({ where: { id: l.id } })).passwordHash !== null, true);
  });
  it('รายการลิงก์มีฟิลด์การป้องกันครบทุกแถว', async () => {
    await create({ password: 'combo-pass' });
    await create({ maxClicks: 3 });
    const r = await api.get('/api/links', me.token);
    assert.ok(r.body.items.every((l: object) => ['hasPassword', 'maxClicks', 'startsAt', 'notStarted', 'limitReached'].every((k) => k in l)));
  });
});
