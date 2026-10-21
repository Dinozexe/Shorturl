import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { prisma } from '../../src/prisma/client';
import { redis } from '../../src/redis/client';
import { client, makeUser, resetState, shutdown, startServer, type TestServer } from '../helpers';

let srv: TestServer;
let api: ReturnType<typeof client>;
let admin: Awaited<ReturnType<typeof makeUser>>;
let mod: Awaited<ReturnType<typeof makeUser>>;
let user: Awaited<ReturnType<typeof makeUser>>;

before(async () => {
  srv = await startServer();
  api = client(srv.base);
});
after(() => shutdown(srv));
beforeEach(async () => {
  await resetState();
  admin = await makeUser('ADMIN');
  mod = await makeUser('MODERATOR');
  user = await makeUser('USER');
});

const link = (userId: string | null, code: string, host = 'example.com', extra: object = {}) =>
  prisma.link.create({ data: { userId, shortCode: code, originalUrl: `https://${host}/x`, originalHost: host, ...extra } });

describe('สิทธิ์ตามบทบาท (RBAC)', () => {
  const MOD_OK = ['/api/admin/overview', '/api/admin/links', '/api/admin/blocked-domains'];
  const ADMIN_ONLY = ['/api/admin/users', '/api/admin/audit'];

  it('ไม่ล็อกอิน → 401 ทุก endpoint', async () => {
    for (const p of [...MOD_OK, ...ADMIN_ONLY]) assert.equal((await api.get(p)).status, 401, p);
  });
  it('USER ธรรมดา → 403 ทุก endpoint', async () => {
    for (const p of [...MOD_OK, ...ADMIN_ONLY]) assert.equal((await api.get(p, user.token)).status, 403, p);
  });
  it('MODERATOR: ภาพรวม/ลิงก์/โดเมนได้ แต่ผู้ใช้กับ audit → 403', async () => {
    for (const p of MOD_OK) assert.equal((await api.get(p, mod.token)).status, 200, p);
    for (const p of ADMIN_ONLY) assert.equal((await api.get(p, mod.token)).status, 403, p);
  });
  it('ADMIN ได้ทั้งหมด', async () => {
    for (const p of [...MOD_OK, ...ADMIN_ONLY]) assert.equal((await api.get(p, admin.token)).status, 200, p);
  });
  it('ADMIN ที่ถูกลดเป็น USER → สิทธิ์หายทันที (ไม่ต้องรอ token หมดอายุ)', async () => {
    await prisma.user.update({ where: { id: admin.user.id }, data: { role: 'USER' } });
    assert.equal((await api.get('/api/admin/overview', admin.token)).status, 403);
  });
});

describe('ภาพรวม', () => {
  it('ตัวเลขถูกต้อง', async () => {
    await prisma.user.update({ where: { id: user.user.id }, data: { isBanned: true } });
    await link(user.user.id, 'ov-a', 'example.com', { clickCount: 4 });
    await link(null, 'ov-b', 'example.com', { clickCount: 6, status: 'ADMIN_DISABLED' });
    await prisma.blockedDomain.create({ data: { domain: 'bad.test' } });
    const la = await prisma.link.findUniqueOrThrow({ where: { shortCode: 'ov-a' } });
    await prisma.linkDailyStat.create({ data: { linkId: la.id, day: new Date(new Date().toISOString().slice(0, 10)), clicks: 7 } });
    const r = await api.get('/api/admin/overview', admin.token);
    const { users, bannedUsers, links: nLinks, adminDisabledLinks, blockedDomains, clicks, newUsers7d, newLinks7d, linksByStatus, daily, topLinks } = r.body;
    assert.deepEqual({ users, bannedUsers, links: nLinks, adminDisabledLinks, blockedDomains, clicks }, { users: 3, bannedUsers: 1, links: 2, adminDisabledLinks: 1, blockedDomains: 1, clicks: 10 });
    assert.equal(newUsers7d, 3);
    assert.equal(newLinks7d, 2);
    assert.deepEqual(linksByStatus, { active: 1, disabled: 0, adminDisabled: 1 });
    assert.equal(daily.length, 14);
    assert.equal(daily[13].clicks, 7); // วันนี้ (UTC) อยู่ท้ายสุด
    assert.equal(daily.slice(0, 13).reduce((n: number, d: { clicks: number }) => n + d.clicks, 0), 0);
    assert.deepEqual(topLinks.map((l: { clickCount: number }) => l.clickCount), [4]); // เฉพาะลิงก์ที่ ACTIVE และมีคลิก
    assert.match(topLinks[0].shortUrl, /ov-a$/);
  });
});

describe('ผู้ใช้', () => {
  it('รายการ + ตัวกรองบทบาท/สถานะ + ค้นหา + นับจำนวนลิงก์', async () => {
    await link(user.user.id, 'us-a');
    await link(user.user.id, 'us-b');
    await prisma.user.update({ where: { id: mod.user.id }, data: { isBanned: true } });
    const all = await api.get('/api/admin/users', admin.token);
    assert.equal(all.body.total, 3);
    assert.equal(all.body.items.find((u: { id: string }) => u.id === user.user.id).linkCount, 2);
    assert.equal((await api.get('/api/admin/users?role=MODERATOR', admin.token)).body.total, 1);
    assert.equal((await api.get('/api/admin/users?banned=1', admin.token)).body.items[0].id, mod.user.id);
    assert.equal((await api.get('/api/admin/users?banned=0', admin.token)).body.total, 2);
    assert.equal((await api.get(`/api/admin/users?q=${encodeURIComponent(user.user.email.slice(0, 8))}`, admin.token)).body.total >= 1, true);
    assert.equal((await api.get('/api/admin/users?q=%00evil', admin.token)).status, 200, 'NUL ในคำค้นต้องไม่ทำให้ 500');
  });
  it('แบ่งหน้า: pageSize ถูกจำกัด, หน้าเกิน = ว่าง', async () => {
    const r = await api.get('/api/admin/users?pageSize=2&page=2', admin.token);
    assert.deepEqual([r.body.items.length, r.body.total, r.body.page, r.body.pageSize], [1, 3, 2, 2]);
    assert.equal((await api.get('/api/admin/users?pageSize=9999', admin.token)).body.pageSize, 100);
  });

  it('ระงับผู้ใช้: ตั้ง isBanned + เพิกถอนทุก session ทันที + audit USER_BAN; ปลดแล้วใช้ได้อีก', async () => {
    assert.equal((await api.get('/api/auth/me', user.token)).status, 200);
    const r = await api.patch(`/api/admin/users/${user.user.id}`, { isBanned: true }, admin.token);
    assert.deepEqual(r.body, { id: user.user.id, role: 'USER', isBanned: true });
    assert.equal((await api.get('/api/auth/me', user.token)).status, 401, 'session ถูกเพิกถอนทันที (ไม่ใช่แค่ถูกปฏิเสธ)');
    assert.equal(await prisma.auditLog.count({ where: { action: 'USER_BAN', actorId: admin.user.id, targetId: user.user.id } }), 1);
    await api.patch(`/api/admin/users/${user.user.id}`, { isBanned: false }, admin.token);
    assert.equal(await prisma.auditLog.count({ where: { action: 'USER_UNBAN' } }), 1);
  });
  it('เปลี่ยนบทบาท: มีผล + audit USER_ROLE_CHANGE (บอกบทบาทเดิม→ใหม่) + ต้องล็อกอินใหม่', async () => {
    const r = await api.patch(`/api/admin/users/${user.user.id}`, { role: 'MODERATOR' }, admin.token);
    assert.equal(r.body.role, 'MODERATOR');
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'USER_ROLE_CHANGE' } });
    assert.match(log.detail!, /USER → MODERATOR/);
    assert.ok((await redis.get(`rtnbf:${user.user.id}`)) !== null);
  });
  it('ไม่ทำอะไรถ้าค่าเดิม (ไม่เขียน audit ซ้ำ)', async () => {
    await api.patch(`/api/admin/users/${user.user.id}`, { role: 'USER', isBanned: false }, admin.token);
    assert.equal(await prisma.auditLog.count(), 0);
  });
  for (const [name, id, body, status] of [
    ['แก้ตัวเอง', () => admin.user.id, { isBanned: true }, 400],
    ['บทบาทไม่มีจริง', () => user.user.id, { role: 'GOD' }, 400],
    ['isBanned ไม่ใช่ boolean', () => user.user.id, { isBanned: 'yes' }, 400],
    ['ไม่มีอะไรให้แก้', () => user.user.id, {}, 400],
    ['id ไม่ใช่ UUID', () => 'abc', { isBanned: true }, 404],
    ['ไม่มีผู้ใช้นี้', () => '00000000-0000-4000-8000-000000000000', { isBanned: true }, 404],
  ] as const) {
    it(`ปฏิเสธ: ${name} → ${status}`, async () => assert.equal((await api.patch(`/api/admin/users/${id()}`, body, admin.token)).status, status));
  }
  it('MODERATOR แก้ผู้ใช้ไม่ได้เลย (403) — endpoint นี้เฉพาะ ADMIN', async () => {
    assert.equal((await api.patch(`/api/admin/users/${user.user.id}`, { isBanned: true }, mod.token)).status, 403);
  });
});

describe('ลิงก์ทั้งหมด', () => {
  it('กรองตามสถานะ/ผู้สร้าง (สมาชิก-guest) และเรียงตามคลิก', async () => {
    await link(user.user.id, 'ad-a', 'example.com', { clickCount: 5 });
    await link(null, 'ad-b', 'example.com', { clickCount: 9 });
    await link(user.user.id, 'ad-c', 'example.com', { clickCount: 1, status: 'ADMIN_DISABLED' });
    assert.equal((await api.get('/api/admin/links', mod.token)).body.total, 3);
    assert.equal((await api.get('/api/admin/links?status=ADMIN_DISABLED', mod.token)).body.total, 1);
    assert.equal((await api.get('/api/admin/links?owner=guest', mod.token)).body.items[0].shortCode, 'ad-b');
    assert.equal((await api.get('/api/admin/links?owner=member', mod.token)).body.total, 2);
    assert.deepEqual((await api.get('/api/admin/links?sort=clicks', mod.token)).body.items.map((l: { shortCode: string }) => l.shortCode), ['ad-b', 'ad-a', 'ad-c']);
    assert.equal((await api.get('/api/admin/links?q=ad-b', mod.token)).body.items[0].ownerEmail, null);
  });
  it('ปิดโดยผู้ดูแล: ล้าง cache + audit LINK_DISABLE; เปิดคืน: เขียน cache + audit LINK_ENABLE', async () => {
    const l = await link(user.user.id, 'ad-x');
    await redis.set('link:ad-x', JSON.stringify({ i: l.id, u: l.originalUrl, e: null }));
    const off = await api.patch(`/api/admin/links/${l.id}`, { status: 'ADMIN_DISABLED' }, mod.token);
    assert.equal(off.status, 200);
    assert.equal(await redis.get('link:ad-x'), null);
    assert.equal(await prisma.auditLog.count({ where: { action: 'LINK_DISABLE', actorId: mod.user.id } }), 1);
    const on = await api.patch(`/api/admin/links/${l.id}`, { status: 'ACTIVE' }, mod.token);
    assert.equal(on.status, 200);
    assert.ok(await redis.get('link:ad-x'));
    assert.equal(await prisma.auditLog.count({ where: { action: 'LINK_ENABLE' } }), 1);
  });
  it('สถานะอื่นนอก ADMIN_DISABLED/ACTIVE → 400; ไม่มีลิงก์ → 404', async () => {
    const l = await link(user.user.id, 'ad-y');
    assert.equal((await api.patch(`/api/admin/links/${l.id}`, { status: 'DISABLED' }, admin.token)).status, 400);
    assert.equal((await api.patch('/api/admin/links/999999', { status: 'ACTIVE' }, admin.token)).status, 404);
  });
  it('เปิดคืนลิงก์ที่ไม่ได้ถูกผู้ดูแลปิด → 400', async () => {
    const l = await link(user.user.id, 'ad-z');
    assert.equal((await api.patch(`/api/admin/links/${l.id}`, { status: 'ACTIVE' }, admin.token)).status, 400);
  });
});

describe('โดเมนต้องห้าม', () => {
  const block = (domain: string, reason?: string, token = mod.token) => api.post('/api/admin/blocked-domains', { domain, reason }, token);

  it('preview: นับลิงก์ที่จะถูกปิด (รวม subdomain) โดยยังไม่เปลี่ยนอะไร', async () => {
    await link(user.user.id, 'bd-1', 'evil.test');
    await link(user.user.id, 'bd-2', 'www.evil.test');
    await link(user.user.id, 'bd-3', 'notevil.test');
    const r = await api.get('/api/admin/blocked-domains/preview?domain=evil.test', mod.token);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { domain: 'evil.test', alreadyBlocked: false, willDisable: 2, totalLinks: 2 });
    assert.equal(await prisma.blockedDomain.count(), 0);
  });
  it('บล็อก: ปิดลิงก์เดิมที่ตรง (รวม subdomain, ไม่รวมชื่อคล้าย) + ล้าง cache + audit DOMAIN_BLOCK', async () => {
    const a = await link(user.user.id, 'bd-1', 'evil.test');
    const b = await link(user.user.id, 'bd-2', 'www.evil.test');
    const c = await link(user.user.id, 'bd-3', 'notevil.test');
    await redis.set('link:bd-1', '{}');
    const r = await block('Evil.Test', 'phishing');
    assert.equal(r.status, 201);
    assert.equal(r.body.domain, 'evil.test');
    const st = async (id: number) => (await prisma.link.findUniqueOrThrow({ where: { id } })).status;
    assert.deepEqual([await st(a.id), await st(b.id), await st(c.id)], ['ADMIN_DISABLED', 'ADMIN_DISABLED', 'ACTIVE']);
    assert.equal(await redis.get('link:bd-1'), null);
    assert.equal(await prisma.auditLog.count({ where: { action: 'DOMAIN_BLOCK' } }), 1);
  });
  it('หลังบล็อก ย่อลิงก์ของโดเมนนั้นไม่ได้ และเปิดคืนลิงก์เดิมไม่ได้ขณะยังบล็อก', async () => {
    const a = await link(user.user.id, 'bd-1', 'evil.test');
    await block('evil.test');
    assert.equal((await api.post('/api/links', { url: 'https://evil.test/new' }, user.token)).status, 400);
    assert.equal((await api.patch(`/api/admin/links/${a.id}`, { status: 'ACTIVE' }, admin.token)).status, 400);
  });
  it('ปลดบล็อก: ลบรายการ + audit แต่ไม่เปิดลิงก์เก่าให้เอง', async () => {
    const a = await link(user.user.id, 'bd-1', 'evil.test');
    const d = (await block('evil.test')).body;
    assert.equal((await api.del(`/api/admin/blocked-domains/${d.id}`, mod.token)).status, 204);
    assert.equal(await prisma.blockedDomain.count(), 0);
    assert.equal((await prisma.link.findUniqueOrThrow({ where: { id: a.id } })).status, 'ADMIN_DISABLED');
    assert.equal(await prisma.auditLog.count({ where: { action: 'DOMAIN_UNBLOCK' } }), 1);
    assert.equal((await api.patch(`/api/admin/links/${a.id}`, { status: 'ACTIVE' }, mod.token)).status, 200);
  });
  for (const bad of ['', 'not a domain', 'localhost', 'a', '-.com', 'x'.repeat(300) + '.com']) {
    it(`โดเมนไม่ถูกต้อง ${JSON.stringify(bad.slice(0, 20))} → 400`, async () => assert.equal((await block(bad)).status, 400));
  }
  it('รับ URL เต็ม/ตัวพิมพ์ใหญ่ แล้วแปลงเป็นชื่อโดเมนล้วน (ตัด scheme/path, ตัวพิมพ์เล็ก)', async () => {
    assert.equal((await block('HTTPS://WWW.Norm.test/path?x=1')).body.domain, 'www.norm.test');
  });
  it('บล็อกซ้ำ → 409; ปลดที่ไม่มี → 404', async () => {
    await block('dup.test');
    assert.equal((await block('dup.test')).status, 409);
    assert.equal((await api.del('/api/admin/blocked-domains/999999', mod.token)).status, 404);
  });
  it('USER ธรรมดาบล็อกไม่ได้ (403)', async () => assert.equal((await block('x.test', undefined, user.token)).status, 403));
});

describe('audit log', () => {
  it('เฉพาะ ADMIN; กรองตามประเภท; ค้นหา; เรียงใหม่→เก่า', async () => {
    await api.patch(`/api/admin/users/${user.user.id}`, { isBanned: true }, admin.token);
    await api.post('/api/admin/blocked-domains', { domain: 'audit.test' }, admin.token);
    const all = await api.get('/api/admin/audit', admin.token);
    assert.equal(all.body.total, 2);
    assert.equal(all.body.items[0].action, 'DOMAIN_BLOCK');
    assert.equal((await api.get('/api/admin/audit?action=USER_BAN', admin.token)).body.total, 1);
    assert.equal((await api.get('/api/admin/audit?q=audit.test', admin.token)).body.total, 1);
    assert.equal((await api.get('/api/admin/audit?action=NOT_A_REAL_ACTION', admin.token)).status, 200);
  });
});
