import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { prisma } from '../../src/prisma/client';
import { redis } from '../../src/redis/client';
import { client, makeUser, resetState, shutdown, startServer, type TestServer } from '../helpers';

let srv: TestServer;
let api: ReturnType<typeof client>;
let me: Awaited<ReturnType<typeof makeUser>>;
let other: Awaited<ReturnType<typeof makeUser>>;

before(async () => {
  srv = await startServer();
  api = client(srv.base);
});
after(() => shutdown(srv));
beforeEach(async () => {
  await resetState();
  me = await makeUser();
  other = await makeUser();
});

const create = (body: Record<string, unknown>, token = me.token) => api.post('/api/links', body, token);
const seed = (userId: string, n: number, prefix = 'seed') =>
  prisma.link.createMany({ data: Array.from({ length: n }, (_, i) => ({ userId, shortCode: `${prefix}${String(i).padStart(3, '0')}`, originalUrl: `https://example.com/${prefix}/${i}`, originalHost: 'example.com' })) });

describe('สร้างลิงก์', () => {
  it('รหัสสุ่ม 5 ตัว, shortUrl ใช้ PUBLIC_BASE_URL, สถานะ ACTIVE, เก็บเป็นของผู้สร้าง', async () => {
    const r = await create({ url: 'https://Example.com/a?x=1' });
    assert.equal(r.status, 201);
    assert.match(r.body.shortCode, /^[0-9A-Za-z]{5}$/);
    assert.equal(r.body.shortUrl, `https://s.example.test/${r.body.shortCode}`);
    assert.deepEqual({ status: r.body.status, host: r.body.originalHost, clicks: r.body.clickCount, expired: r.body.expired, url: r.body.originalUrl }, { status: 'ACTIVE', host: 'example.com', clicks: 0, expired: false, url: 'https://example.com/a?x=1' });
    assert.equal((await prisma.link.findUniqueOrThrow({ where: { id: r.body.id } })).userId, me.user.id);
  });

  it('เขียน cache link:{code} ให้ redirect-service ตามสัญญา {i,u,e}', async () => {
    const r = await create({ url: 'https://example.com/cache' });
    const cached = JSON.parse((await redis.get(`link:${r.body.shortCode}`))!);
    assert.deepEqual(cached, { i: r.body.id, u: 'https://example.com/cache', e: null });
    assert.ok((await redis.ttl(`link:${r.body.shortCode}`)) > 3000);
  });

  it('alias เอง: ใช้ได้ และจำตัวพิมพ์', async () => {
    const r = await create({ url: 'https://example.com/a', alias: 'My-Promo' });
    assert.equal(r.status, 201);
    assert.equal(r.body.shortCode, 'My-Promo');
  });
  it('alias ซ้ำ → 409 (แม้ต่างผู้ใช้)', async () => {
    await create({ url: 'https://example.com/a', alias: 'taken-one' });
    assert.equal((await create({ url: 'https://example.com/b', alias: 'taken-one' }, other.token)).status, 409);
  });
  for (const alias of ['ab', '-bad', 'a b', 'admin', 'API', 'x'.repeat(31)]) {
    it(`alias ไม่ผ่าน → 400: ${JSON.stringify(alias)}`, async () => assert.equal((await create({ url: 'https://example.com/a', alias })).status, 400));
  }
  it('alias เป็น null/ว่าง = สุ่มให้', async () => {
    assert.equal((await create({ url: 'https://example.com/a', alias: null })).status, 201);
    assert.equal((await create({ url: 'https://example.com/b', alias: '' })).status, 201);
  });

  for (const [name, body] of Object.entries({
    'ไม่ส่ง url': {}, 'url ไม่ใช่ string': { url: 123 }, 'ไม่มี scheme': { url: 'example.com' }, 'ftp': { url: 'ftp://example.com' },
    'IP ภายใน': { url: 'http://192.168.1.1/admin' }, 'localhost': { url: 'http://localhost:3000' }, 'metadata IP': { url: 'http://169.254.169.254/' },
    'ชี้ลิงก์สั้นของระบบเอง': { url: 'https://s.example.test/abc12' }, 'ชี้ API ของระบบเอง': { url: 'https://api.example.test/api/health' },
    'alias ไม่ใช่ string': { url: 'https://example.com', alias: 5 }, 'expiresAt ไม่ใช่ string': { url: 'https://example.com', expiresAt: 5 },
  })) it(`ปฏิเสธ 400: ${name}`, async () => assert.equal((await create(body)).status, 400));

  it('หน้าเว็บหลัก (FRONTEND_ORIGIN) ย่อได้', async () => assert.equal((await create({ url: 'https://app.example.test/features/' })).status, 201));

  it('โดเมนต้องห้าม: บล็อกทั้งโดเมนและ subdomain', async () => {
    await prisma.blockedDomain.create({ data: { domain: 'evil.test', reason: 'phishing' } });
    for (const u of ['https://evil.test/x', 'https://www.evil.test/x', 'https://a.b.evil.test/x']) assert.equal((await create({ url: u })).status, 400, u);
    assert.equal((await create({ url: 'https://notevil.test/x' })).status, 201, 'โดเมนที่ชื่อลงท้ายคล้ายกันต้องไม่ถูกบล็อก');
  });

  it('วันหมดอายุ: อนาคตผ่าน (cache e = เวลา, TTL ไม่เกินเวลาหมดอายุ); อดีต/เกิน 10 ปี/รูปแบบผิด → 400', async () => {
    const at = new Date(Date.now() + 120_000).toISOString();
    const ok = await create({ url: 'https://example.com/e', expiresAt: at });
    assert.equal(ok.status, 201);
    assert.equal(new Date(ok.body.expiresAt).toISOString(), at);
    assert.equal(JSON.parse((await redis.get(`link:${ok.body.shortCode}`))!).e, Date.parse(at));
    assert.ok((await redis.ttl(`link:${ok.body.shortCode}`)) <= 120);
    for (const bad of [new Date(Date.now() - 1000).toISOString(), new Date(Date.now() + 11 * 365 * 864e5).toISOString(), 'tomorrow', '2026-13-45']) {
      assert.equal((await create({ url: 'https://example.com/e', expiresAt: bad })).status, 400, bad);
    }
  });

  it('ต้องล็อกอิน (401) และ body JSON พังไม่ทำให้ระบบล้ม (400)', async () => {
    assert.equal((await api.post('/api/links', { url: 'https://example.com' })).status, 401);
    const res = await fetch(`${srv.base}/api/links`, { method: 'POST', headers: { authorization: `Bearer ${me.token}`, 'content-type': 'application/json' }, body: '{broken' });
    assert.equal(res.status, 400);
  });
});

describe('รายการ / ค้นหา / ดูรายตัว', () => {
  it('คืนเฉพาะของตัวเอง เรียงใหม่→เก่า พร้อม total/page/pageSize', async () => {
    await seed(me.user.id, 3, 'mine');
    await seed(other.user.id, 2, 'theirs');
    const r = await api.get('/api/links', me.token);
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 3);
    assert.equal(r.body.items.length, 3);
    assert.ok(r.body.items.every((l: { shortCode: string }) => l.shortCode.startsWith('mine')));
    const ids = r.body.items.map((l: { id: number }) => l.id);
    assert.deepEqual(ids, [...ids].sort((a, b) => b - a));
    assert.equal(r.body.page, 1);
  });

  it('แบ่งหน้า: pageSize/page ถูกต้อง, เกินช่วง → ว่าง, pageSize ถูกจำกัดที่ 100, ค่าเพี้ยนใช้ค่าเริ่มต้น', async () => {
    await seed(me.user.id, 25);
    const p1 = await api.get('/api/links?page=1&pageSize=10', me.token);
    const p3 = await api.get('/api/links?page=3&pageSize=10', me.token);
    const p4 = await api.get('/api/links?page=4&pageSize=10', me.token);
    assert.deepEqual([p1.body.items.length, p3.body.items.length, p4.body.items.length, p1.body.total], [10, 5, 0, 25]);
    const ids1 = new Set(p1.body.items.map((l: { id: number }) => l.id));
    assert.ok(p3.body.items.every((l: { id: number }) => !ids1.has(l.id)), 'หน้าต่างกันห้ามซ้ำกัน');
    assert.equal((await api.get('/api/links?pageSize=9999', me.token)).body.pageSize, 100);
    const weird = await api.get('/api/links?page=-5&pageSize=abc', me.token);
    assert.equal(weird.status, 200);
    assert.equal(weird.body.page, 1);
  });

  it('ค้นหา q: ตรงกับ short code หรือ URL ปลายทาง ไม่แยกตัวพิมพ์ และไม่เจอของคนอื่น', async () => {
    await create({ url: 'https://example.com/Invoice-2026', alias: 'finance-q1' });
    await create({ url: 'https://example.org/other' });
    await create({ url: 'https://example.com/zzz' }, other.token);
    assert.equal((await api.get('/api/links?q=FINANCE', me.token)).body.total, 1);
    assert.equal((await api.get('/api/links?q=invoice-2026', me.token)).body.total, 1);
    assert.equal((await api.get('/api/links?q=example', me.token)).body.total, 2);
    assert.equal((await api.get('/api/links?q=nothing-here', me.token)).body.total, 0);
  });

  it('ค้นหาด้วยอักขระพิเศษ (%, _, \') ไม่ทำให้ query พัง', async () => {
    for (const q of ['%', '_', "' OR 1=1 --", '\\', '\u0000x']) assert.equal((await api.get(`/api/links?q=${encodeURIComponent(q)}`, me.token)).status, 200, q);
  });

  it('ดูรายตัว: ของตัวเอง 200; ของคนอื่น/ไม่มี/id เพี้ยน → 404 (ไม่บอกว่ามีอยู่)', async () => {
    const mine = await create({ url: 'https://example.com/m' });
    const theirs = await create({ url: 'https://example.com/t' }, other.token);
    assert.equal((await api.get(`/api/links/${mine.body.id}`, me.token)).status, 200);
    for (const id of [theirs.body.id, 999999, 'abc', '-1', '0', '99999999999']) assert.equal((await api.get(`/api/links/${id}`, me.token)).status, 404, String(id));
  });

  it('ทุก endpoint ต้องล็อกอิน (401)', async () => {
    for (const [m, p] of [['get', '/api/links'], ['get', '/api/links/1'], ['get', '/api/links/summary'], ['get', '/api/links/1/qr'], ['get', '/api/links/1/stats']] as const) assert.equal((await api[m](p)).status, 401, p);
  });
});

describe('แก้ไข / เปิด-ปิด / ลบ', () => {
  it('แก้ URL: อัปเดต originalHost และ cache; alias เปลี่ยนไม่ได้ (400)', async () => {
    const l = (await create({ url: 'https://example.com/a', alias: 'edit-me' })).body;
    const r = await api.patch(`/api/links/${l.id}`, { url: 'https://other.example.org/b' }, me.token);
    assert.equal(r.status, 200);
    assert.equal(r.body.originalHost, 'other.example.org');
    assert.equal(JSON.parse((await redis.get('link:edit-me'))!).u, 'https://other.example.org/b');
    assert.equal((await api.patch(`/api/links/${l.id}`, { alias: 'new-name' }, me.token)).status, 400);
  });
  it('แก้เป็น URL ต้องห้าม/ภายใน → 400 และของเดิมไม่เปลี่ยน', async () => {
    const l = (await create({ url: 'https://example.com/a' })).body;
    await prisma.blockedDomain.create({ data: { domain: 'bad.test' } });
    for (const u of ['http://10.0.0.1', 'https://bad.test/x']) assert.equal((await api.patch(`/api/links/${l.id}`, { url: u }, me.token)).status, 400);
    assert.equal((await prisma.link.findUniqueOrThrow({ where: { id: l.id } })).originalUrl, 'https://example.com/a');
  });
  it('ปิดลิงก์ → ล้าง cache; เปิดอีกครั้ง → เขียน cache กลับ', async () => {
    const l = (await create({ url: 'https://example.com/a' })).body;
    assert.equal((await api.patch(`/api/links/${l.id}`, { status: 'DISABLED' }, me.token)).body.status, 'DISABLED');
    assert.equal(await redis.get(`link:${l.shortCode}`), null);
    await api.patch(`/api/links/${l.id}`, { status: 'ACTIVE' }, me.token);
    assert.ok(await redis.get(`link:${l.shortCode}`));
  });
  it('status ต้องเป็น ACTIVE/DISABLED เท่านั้น (เจ้าของตั้ง ADMIN_DISABLED ไม่ได้)', async () => {
    const l = (await create({ url: 'https://example.com/a' })).body;
    for (const s of ['ADMIN_DISABLED', 'active', 1, null]) assert.equal((await api.patch(`/api/links/${l.id}`, { status: s }, me.token)).status, 400, String(s));
  });
  it('ลิงก์ที่ผู้ดูแลปิด (ADMIN_DISABLED) เจ้าของเปิดเองไม่ได้ → 403', async () => {
    const l = (await create({ url: 'https://example.com/a' })).body;
    await prisma.link.update({ where: { id: l.id }, data: { status: 'ADMIN_DISABLED' } });
    assert.equal((await api.patch(`/api/links/${l.id}`, { status: 'ACTIVE' }, me.token)).status, 403);
  });
  it('ล้างวันหมดอายุด้วย null', async () => {
    const l = (await create({ url: 'https://example.com/a', expiresAt: new Date(Date.now() + 3.6e6).toISOString() })).body;
    assert.equal((await api.patch(`/api/links/${l.id}`, { expiresAt: null }, me.token)).body.expiresAt, null);
    assert.equal(JSON.parse((await redis.get(`link:${l.shortCode}`))!).e, null);
  });
  it('แก้ของคนอื่น/ที่ไม่มี → 404', async () => {
    const t = (await create({ url: 'https://example.com/t' }, other.token)).body;
    assert.equal((await api.patch(`/api/links/${t.id}`, { status: 'DISABLED' }, me.token)).status, 404);
    assert.equal((await api.patch('/api/links/999999', { status: 'DISABLED' }, me.token)).status, 404);
  });
  it('ลบ: 204, หายจาก DB + cache, ลบซ้ำ/ลบของคนอื่น → 404, คลิกที่เก็บไว้ถูกลบตาม', async () => {
    const l = (await create({ url: 'https://example.com/a' })).body;
    await prisma.click.create({ data: { linkId: l.id, ipHash: 'h', device: 'desktop' } });
    assert.equal((await api.del(`/api/links/${l.id}`, other.token)).status, 404);
    assert.equal((await api.del(`/api/links/${l.id}`, me.token)).status, 204);
    assert.equal(await prisma.link.count({ where: { id: l.id } }), 0);
    assert.equal(await prisma.click.count({ where: { linkId: l.id } }), 0);
    assert.equal(await redis.get(`link:${l.shortCode}`), null);
    assert.equal((await api.del(`/api/links/${l.id}`, me.token)).status, 404);
  });
});

describe('สรุปตัวเลข /api/links/summary', () => {
  it('นับรวมทุกหน้าของเจ้าของ: total / active (ไม่นับปิด-หมดอายุ) / clicks', async () => {
    const past = new Date(Date.now() - 1000);
    const mk = (code: string, extra: object) => prisma.link.create({ data: { userId: me.user.id, shortCode: code, originalUrl: 'https://example.com', originalHost: 'example.com', ...extra } });
    await mk('sum-a', { clickCount: 5 });
    await mk('sum-b', { clickCount: 7, expiresAt: new Date(Date.now() + 1e6) });
    await mk('sum-c', { clickCount: 2, status: 'DISABLED' });
    await mk('sum-d', { clickCount: 1, expiresAt: past });
    await prisma.link.create({ data: { userId: other.user.id, shortCode: 'sum-x', originalUrl: 'https://example.com', originalHost: 'example.com', clickCount: 100 } });
    const r = await api.get('/api/links/summary', me.token);
    assert.deepEqual(r.body, { total: 4, active: 2, clicks: 15 });
  });
  it('ไม่มีลิงก์เลย → 0 ทั้งหมด', async () => assert.deepEqual((await api.get('/api/links/summary', me.token)).body, { total: 0, active: 0, clicks: 0 }));
});
