import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { prisma } from '../../src/prisma/client';
import { redis } from '../../src/redis/client';
import { client, cookieOf, makeUser, resetState, shutdown, startServer, type TestServer } from '../helpers';

let srv: TestServer;
let api: ReturnType<typeof client>;
const DEMO = { email: 'demo@example.test', password: 'demo-password-123' };

before(async () => {
  srv = await startServer();
  api = client(srv.base);
});
after(() => shutdown(srv));
beforeEach(async () => {
  await resetState();
  await prisma.user.create({ data: { email: DEMO.email, name: 'Demo Admin', role: 'ADMIN' } });
});

describe('ล็อกอินด้วยบัญชีเดโม', () => {
  it('สำเร็จ: ได้ access token + user และตั้ง refresh cookie แบบ HttpOnly', async () => {
    const r = await api.post('/api/auth/login', DEMO);
    assert.equal(r.status, 200);
    assert.ok(r.body.accessToken && r.body.expiresIn === 900);
    assert.deepEqual({ email: r.body.user.email, role: r.body.user.role }, { email: DEMO.email, role: 'ADMIN' });
    const raw = r.headers.getSetCookie().find((c) => c.startsWith('rt='))!;
    assert.match(raw, /HttpOnly/i);
    assert.match(raw, /SameSite=Lax/i);
    assert.match(raw, /Path=\/api\/auth/);
    assert.ok(!JSON.stringify(r.body).includes('refreshToken'), 'refresh token ต้องไม่อยู่ใน body');
  });

  it('อีเมลไม่ต้องสนตัวพิมพ์/ช่องว่าง', async () => {
    assert.equal((await api.post('/api/auth/login', { email: `  ${DEMO.email.toUpperCase()} `, password: DEMO.password })).status, 200);
  });

  for (const [name, body, status] of [
    ['รหัสผิด', { email: DEMO.email, password: 'wrong-password' }, 401],
    ['อีเมลอื่น (แม้มีใน DB)', { email: 'someone@example.test', password: DEMO.password }, 401],
    ['ไม่ส่งรหัส', { email: DEMO.email }, 400],
    ['body ว่าง', {}, 400],
    ['ชนิดข้อมูลผิด', { email: 123, password: ['x'] }, 400],
    ['รหัสยาวผิดปกติ', { email: DEMO.email, password: 'x'.repeat(300) }, 400],
  ] as const) {
    it(`ปฏิเสธ: ${name} → ${status}`, async () => assert.equal((await api.post('/api/auth/login', body)).status, status));
  }

  it('ข้อความ error ของอีเมลผิดกับรหัสผิดต้องเหมือนกัน (ไม่บอกใบ้ว่าอีเมลมีจริง)', async () => {
    const a = await api.post('/api/auth/login', { email: DEMO.email, password: 'nope-nope' });
    const b = await api.post('/api/auth/login', { email: 'nobody@example.test', password: 'nope-nope' });
    assert.equal(a.body.message, b.body.message);
  });

  it('บัญชีที่ถูกระงับ: รหัสถูกก็เข้าไม่ได้ (403) และไม่ได้ cookie', async () => {
    await prisma.user.update({ where: { email: DEMO.email }, data: { isBanned: true } });
    const r = await api.post('/api/auth/login', DEMO);
    assert.equal(r.status, 403);
    assert.equal(cookieOf(r, 'rt'), undefined);
  });

  it('บันทึก audit USER_LOGIN และอัปเดต lastLoginAt', async () => {
    await api.post('/api/auth/login', DEMO);
    const u = await prisma.user.findUniqueOrThrow({ where: { email: DEMO.email } });
    assert.ok(u.lastLoginAt);
    assert.equal(await prisma.auditLog.count({ where: { action: 'USER_LOGIN', actorId: u.id } }), 1);
  });

  it('เดารหัสรัว: ถูกจำกัดอัตรา (429) ก่อนครบ 12 ครั้ง และต่อให้รหัสถูกก็ยังโดน', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await api.post('/api/auth/login', { email: DEMO.email, password: `bad-${i}` })).status);
    assert.equal(codes[0], 401);
    assert.ok(codes.includes(429), codes.join(','));
    assert.equal((await api.post('/api/auth/login', DEMO)).status, 429);
  });
});

describe('/me และ access token', () => {
  it('token ถูกต้อง → ข้อมูลผู้ใช้', async () => {
    const { user, token } = await makeUser('MODERATOR');
    const r = await api.get('/api/auth/me', token);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { id: user.id, email: user.email, name: user.name, role: 'MODERATOR' });
  });
  for (const [name, token] of [['ไม่มี token', undefined], ['token มั่ว', 'abc.def.ghi'], ['ลงชื่อด้วย secret อื่น', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4In0.invalid']] as const) {
    it(`401: ${name}`, async () => assert.equal((await api.get('/api/auth/me', token)).status, 401));
  }
  it('บทบาทมีผลทันทีโดยไม่ต้องออก token ใหม่ (อ่านจาก DB ทุกคำขอ)', async () => {
    const { user, token } = await makeUser('USER');
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    assert.equal((await api.get('/api/auth/me', token)).body.role, 'ADMIN');
  });
  it('ผู้ใช้ที่ถูกระงับ: token เดิม → 403 ทันที', async () => {
    const { user, token } = await makeUser();
    await prisma.user.update({ where: { id: user.id }, data: { isBanned: true } });
    assert.equal((await api.get('/api/auth/me', token)).status, 403);
  });
  it('ผู้ใช้ถูกลบ → 401', async () => {
    const { user, token } = await makeUser();
    await prisma.user.delete({ where: { id: user.id } });
    assert.equal((await api.get('/api/auth/me', token)).status, 401);
  });
});

describe('refresh token (หมุนทุกครั้ง + ตรวจจับการใช้ซ้ำ)', () => {
  const refreshWith = (rt: string) => api.post('/api/auth/refresh', {}, undefined, { cookie: `rt=${rt}` });

  it('ไม่มี cookie → 401', async () => assert.equal((await api.post('/api/auth/refresh')).status, 401));
  it('cookie มั่ว → 401 และสั่งล้าง cookie', async () => {
    const r = await refreshWith('garbage');
    assert.equal(r.status, 401);
    assert.ok(r.headers.getSetCookie().some((c) => c.startsWith('rt=;') || /rt=;|Expires=Thu, 01 Jan 1970/.test(c)));
  });

  it('หมุน: ได้ token ใหม่ + cookie ใหม่ที่ต่างจากเดิม และ access ใหม่ใช้ได้', async () => {
    const login = await api.post('/api/auth/login', DEMO);
    const rt1 = cookieOf(login, 'rt')!;
    const r = await refreshWith(rt1);
    assert.equal(r.status, 200);
    const rt2 = cookieOf(r, 'rt')!;
    assert.ok(rt2 && rt2 !== rt1);
    assert.equal((await api.get('/api/auth/me', r.body.accessToken)).status, 200);
  });

  it('ใช้ refresh token เดิมซ้ำ = ถูกขโมย → 401 และทุก session ของผู้ใช้ถูกเพิกถอน', async () => {
    const login = await api.post('/api/auth/login', DEMO);
    const rt1 = cookieOf(login, 'rt')!;
    const ok = await refreshWith(rt1);
    assert.equal(ok.status, 200);
    const reuse = await refreshWith(rt1);
    assert.equal(reuse.status, 401);
    assert.match(reuse.body.message, /ซ้ำ/);
    assert.equal((await api.get('/api/auth/me', ok.body.accessToken)).status, 401, 'access token ที่ออกก่อนเพิกถอนต้องใช้ไม่ได้');
    assert.equal((await refreshWith(cookieOf(ok, 'rt')!)).status, 401, 'refresh ล่าสุดก็ต้องใช้ไม่ได้');
  });

  it('ผู้ใช้ถูกระงับระหว่างทาง → refresh ไม่ได้', async () => {
    const login = await api.post('/api/auth/login', DEMO);
    await prisma.user.update({ where: { email: DEMO.email }, data: { isBanned: true } });
    assert.equal((await refreshWith(cookieOf(login, 'rt')!)).status, 401);
  });

  it('refresh token ใช้เป็น Bearer ของ API ไม่ได้ (คนละ secret)', async () => {
    const login = await api.post('/api/auth/login', DEMO);
    assert.equal((await api.get('/api/auth/me', cookieOf(login, 'rt'))).status, 401);
  });
});

describe('logout', () => {
  it('access token ถูก blacklist ทันที และ refresh token ใช้ไม่ได้', async () => {
    const login = await api.post('/api/auth/login', DEMO);
    const rt = cookieOf(login, 'rt')!;
    assert.equal((await api.get('/api/auth/me', login.body.accessToken)).status, 200);
    const out = await api.post('/api/auth/logout', {}, login.body.accessToken, { cookie: `rt=${rt}` });
    assert.equal(out.status, 200);
    assert.equal((await api.get('/api/auth/me', login.body.accessToken)).status, 401);
    assert.equal((await api.post('/api/auth/refresh', {}, undefined, { cookie: `rt=${rt}` })).status, 401);
    assert.ok((await redis.keys('bl:*')).length >= 1);
  });
  it('logout โดยไม่มี token ก็ไม่ error (idempotent)', async () => assert.equal((await api.post('/api/auth/logout')).status, 200));
});

describe('SSO', () => {
  it('providers: มี google (ตั้ง client id แล้ว) และไม่มี microsoft (ไม่ได้ตั้ง)', async () => {
    const r = await api.get('/api/auth/sso/providers');
    assert.deepEqual(r.body.map((p: { id: string }) => p.id), ['google']);
  });
  it('start: redirect ไป Google พร้อม redirect_uri = API_BASE_URL + callback และ state', async () => {
    const r = await api.get('/api/auth/sso/google/start');
    assert.equal(r.status, 302);
    const loc = new URL(r.headers.get('location')!);
    assert.equal(loc.origin, 'https://accounts.google.com');
    assert.equal(loc.searchParams.get('redirect_uri'), 'https://api.example.test/api/auth/sso/google/callback');
    assert.equal(loc.searchParams.get('client_id'), 'test.apps.googleusercontent.com');
    assert.ok((loc.searchParams.get('state') ?? '').length >= 16);
    assert.match(loc.searchParams.get('scope') ?? '', /openid/);
  });
  it('provider ที่ไม่ได้เปิด/ไม่มี → ไม่ redirect ไปผู้ให้บริการ', async () => {
    for (const p of ['microsoft', 'github', '..%2Fx']) {
      const r = await api.get(`/api/auth/sso/${p}/start`);
      assert.ok(r.status !== 302 || !String(r.headers.get('location')).includes('accounts.google'), `${p} -> ${r.status}`);
    }
  });
  it('callback ที่ state ไม่ถูกต้อง → กลับหน้า login พร้อม sso_error (ไม่ล็อกอิน)', async () => {
    const r = await api.get('/api/auth/sso/google/callback?code=abc&state=forged');
    assert.equal(r.status, 302);
    const loc = r.headers.get('location')!;
    assert.ok(loc.startsWith('https://app.example.test/login'), loc);
    assert.match(loc, /sso_error=/);
    assert.equal(cookieOf(r, 'rt'), undefined);
  });
});
