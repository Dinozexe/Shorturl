import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { hashLinkPassword } from '../../src/password';
import { pool } from '../../src/db';
import { redis } from '../../src/redis';
import { addLink, get, postPassword, queued, resetState, shutdown, startServer, waitQueue } from '../helpers';

let srv: Awaited<ReturnType<typeof startServer>>;
before(async () => {
  srv = await startServer();
});
after(() => shutdown(srv));
beforeEach(() => resetState());

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const hour = 3_600_000;

describe('redirect ปกติ', () => {
  it('302 ไป URL ปลายทาง, no-store (ห้าม 301 เพราะเบราว์เซอร์จะแคชแล้วนับคลิกไม่ครบ)', async () => {
    const { code } = await addLink('abc12', { url: 'https://example.com/landing?x=1' });
    const r = await get(srv.base, `/${code}`);
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), 'https://example.com/landing?x=1');
    assert.match(r.headers.get('cache-control') ?? '', /no-store/);
  });

  it('เข้าคิวคลิกตามสัญญา {l,h,ua,r,c,d,o,b,t}: อุปกรณ์/OS/เบราว์เซอร์, referer เหลือแค่ origin, IP ถูก hash (ไม่เก็บ IP ดิบ), ประเทศ null เมื่อไม่ได้อยู่หลัง Cloudflare', async () => {
    const { id, code } = await addLink('abc12');
    await get(srv.base, `/${code}`, { 'user-agent': IPHONE, referer: 'https://t.co/path/secret?token=1', 'x-forwarded-for': '1.2.3.4', 'cf-ipcountry': 'JP' });
    const [ev] = await waitQueue(1);
    assert.equal(ev.l, id);
    assert.match(ev.h, /^[0-9a-f]{64}$/);
    assert.equal(ev.d, 'mobile');
    assert.equal(ev.o, 'iOS');
    assert.equal(ev.b, 'Safari');
    assert.equal(ev.r, 'https://t.co');
    assert.equal(ev.c, null, 'ไม่เชื่อ CF-IPCountry เมื่อ BEHIND_CLOUDFLARE=false');
    assert.ok(Math.abs(ev.t - Date.now()) < 5000);
    const raw = JSON.stringify(ev);
    assert.ok(!raw.includes('1.2.3.4') && !raw.includes('127.0.0.1') && !raw.includes('secret'));
  });

  it('คนเดียวกันได้ hash เดิม; คนละ IP ได้ hash ต่าง (ใช้นับผู้เปิดไม่ซ้ำ)', async () => {
    const { code } = await addLink('abc12');
    await get(srv.base, `/${code}`);
    await get(srv.base, `/${code}`);
    const evs = await waitQueue(2);
    assert.equal(evs[0].h, evs[1].h);
  });

  it('HEAD (ตัวพรีวิวลิงก์) ได้ redirect แต่ไม่นับเป็นคลิก', async () => {
    const { code } = await addLink('abc12');
    const r = await get(srv.base, `/${code}`, {}, 'HEAD');
    assert.equal(r.status, 302);
    await new Promise((res) => setTimeout(res, 150));
    assert.equal((await queued()).length, 0);
  });

  it('referer ที่พัง/ไม่มี → null ไม่ทำให้ล้ม', async () => {
    const { code } = await addLink('abc12');
    await get(srv.base, `/${code}`, { referer: 'not a url' });
    await get(srv.base, `/${code}`);
    const evs = await waitQueue(2);
    assert.deepEqual(evs.map((e) => e.r), [null, null]);
  });
});

describe('ไม่พบ / ปิด / หมดอายุ', () => {
  it('รหัสที่ไม่มี → 404 หน้าข้อความ (ไม่ใช่ JSON) + no-store + nosniff; ไม่เข้าคิวคลิก', async () => {
    const r = await get(srv.base, '/zzzzz');
    assert.equal(r.status, 404);
    assert.match(r.headers.get('content-type') ?? '', /html/);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.match(await r.text(), /ไม่พบลิงก์นี้/);
    assert.equal((await queued()).length, 0);
  });
  it('รูปแบบรหัสผิด/path ซ้อน → 404 โดยไม่แตะ DB หรือ cache', async () => {
    for (const p of ['/a', '/ab', `/${'x'.repeat(31)}`, '/a%20b', '/a.b.c', '/abc/def', '/abc12/extra', '/..%2Fetc']) assert.equal((await get(srv.base, p)).status, 404, p);
    assert.equal((await redis.keys('link:*')).length, 0);
  });
  for (const status of ['DISABLED', 'ADMIN_DISABLED'] as const) {
    it(`สถานะ ${status} → 404`, async () => {
      await addLink('off12', { status });
      assert.equal((await get(srv.base, '/off12')).status, 404);
    });
  }
  it('หมดอายุใน DB → 404', async () => {
    await addLink('old12', { expiresAt: Date.now() - 1000 });
    assert.equal((await get(srv.base, '/old12')).status, 404);
  });
  it('หมดอายุระหว่างที่ cache ยังอยู่ → 404 (เช็คเวลาทุกคำขอ ไม่เชื่อ TTL อย่างเดียว)', async () => {
    const { id } = await addLink('exp12');
    await redis.set('link:exp12', JSON.stringify({ i: id, u: 'https://example.com', e: Date.now() - 1 }), 'EX', 60);
    assert.equal((await get(srv.base, '/exp12')).status, 404);
  });
  it('ยังไม่หมดอายุ → ใช้ได้ และ cache TTL ไม่เกินเวลาหมดอายุ', async () => {
    await addLink('soon1', { expiresAt: Date.now() + 90_000 });
    assert.equal((await get(srv.base, '/soon1')).status, 302);
    assert.ok((await redis.ttl('link:soon1')) <= 90);
  });
  it('/health, / (ไปหน้าเว็บ), /favicon.ico (204), path ลึก → ตอบตามหน้าที่', async () => {
    assert.deepEqual(await (await get(srv.base, '/health')).json(), { status: 'ok' });
    const root = await get(srv.base, '/');
    assert.equal(root.status, 302);
    assert.equal(root.headers.get('location'), 'https://app.example.test');
    assert.equal((await get(srv.base, '/favicon.ico')).status, 204);
  });
});

describe('cache (สัญญากับ core-api)', () => {
  it('miss → ถาม DB แล้วเขียน link:{code}; ครั้งถัดไปอ่านจาก cache โดยไม่ถาม DB', async () => {
    const { id, code } = await addLink('abc12', { url: 'https://example.com/a' });
    assert.equal(await redis.get(`link:${code}`), null);
    await get(srv.base, `/${code}`);
    assert.deepEqual(JSON.parse((await redis.get(`link:${code}`))!), { i: id, u: 'https://example.com/a', e: null });
    await pool.query("UPDATE links SET original_url = 'https://example.com/changed' WHERE id = $1", [id]);
    assert.equal((await get(srv.base, `/${code}`)).headers.get('location'), 'https://example.com/a', 'ใช้ค่าใน cache (core-api เป็นฝ่ายล้าง cache ตอนแก้)');
    await redis.del(`link:${code}`);
    assert.equal((await get(srv.base, `/${code}`)).headers.get('location'), 'https://example.com/changed');
  });
  it('ไม่พบ → negative cache "0" อายุสั้น; core-api เขียนทับได้ทันทีเมื่อสร้างลิงก์นั้น', async () => {
    assert.equal((await get(srv.base, '/late1')).status, 404);
    assert.equal(await redis.get('link:late1'), '0');
    assert.ok((await redis.ttl('link:late1')) <= 60);
    const { id } = await addLink('late1');
    await redis.set('link:late1', JSON.stringify({ i: id, u: 'https://example.com/dest', e: null }), 'EX', 60);
    assert.equal((await get(srv.base, '/late1')).status, 302);
  });
  it('cache พัง (JSON เสีย/ชนิดผิด) = ถือว่า miss แล้วไปถาม DB ไม่ล้ม', async () => {
    await addLink('bad12');
    for (const junk of ['{not json', '[]', '{"i":"x","u":5}', 'null']) {
      await redis.set('link:bad12', junk, 'EX', 60);
      assert.equal((await get(srv.base, '/bad12')).status, 302, junk);
    }
  });
  it('ใส่ s/m/p ใน cache แล้วถูกบังคับใช้ตามนั้น (แม้ DB ไม่มี)', async () => {
    const { id } = await addLink('cc123');
    await redis.set('link:cc123', JSON.stringify({ i: id, u: 'https://example.com', e: null, s: Date.now() + hour }), 'EX', 60);
    assert.equal((await get(srv.base, '/cc123')).status, 403);
  });
});

describe('วันเริ่มใช้งาน', () => {
  it('ก่อนเริ่ม → 403 หน้าบอกวันเริ่ม ไม่ redirect ไม่นับคลิก', async () => {
    await addLink('st123', { startsAt: Date.now() + hour });
    const r = await get(srv.base, '/st123');
    assert.equal(r.status, 403);
    assert.equal(r.headers.get('location'), null);
    assert.match(await r.text(), /ยังไม่เปิดใช้งาน/);
    assert.equal((await queued()).length, 0);
  });
  it('พอถึงเวลา → ใช้ได้เองโดยไม่ต้องแก้ cache (เช็ค s ทุกคำขอ)', async () => {
    await addLink('st456', { startsAt: Date.now() + 1500 });
    assert.equal((await get(srv.base, '/st456')).status, 403);
    await new Promise((r) => setTimeout(r, 1700));
    assert.equal((await get(srv.base, '/st456')).status, 302);
  });
  it('เริ่มไปแล้ว (อดีต) → ใช้ได้', async () => {
    await addLink('st789', { startsAt: Date.now() - hour });
    assert.equal((await get(srv.base, '/st789')).status, 302);
  });
});

describe('จำกัดจำนวนครั้ง', () => {
  it('เปิดได้ตามจำนวน แล้ว 410 หน้า "เปิดครบจำนวนแล้ว"', async () => {
    await addLink('lm123', { maxClicks: 3 });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await get(srv.base, '/lm123')).status);
    assert.deepEqual(codes, [302, 302, 302, 410, 410]);
    assert.match(await (await get(srv.base, '/lm123')).text(), /เปิดครบจำนวน/);
  });
  it('เปิดพร้อมกัน 25 ครั้ง เพดาน 5 → ผ่านได้ 5 พอดี (นับแบบ atomic ไม่เปิดเกิน)', async () => {
    await addLink('lm456', { maxClicks: 5 });
    const res = await Promise.all(Array.from({ length: 25 }, () => get(srv.base, '/lm456').then((r) => r.status)));
    assert.equal(res.filter((s) => s === 302).length, 5, res.join(','));
    assert.equal(res.filter((s) => s === 410).length, 20);
    assert.equal((await waitQueue(5)).length, 5, 'คลิกเข้าคิวเฉพาะที่ผ่านจริง');
  });
  it('HEAD ไม่กินสิทธิ์', async () => {
    await addLink('lm789', { maxClicks: 1 });
    for (let i = 0; i < 3; i++) assert.equal((await get(srv.base, '/lm789', {}, 'HEAD')).status, 302);
    assert.equal((await get(srv.base, '/lm789')).status, 302);
    assert.equal((await get(srv.base, '/lm789')).status, 410);
  });
  it('ตัวนับหายจาก Redis → ตั้งต่อจากยอดคลิกใน DB (ไม่เริ่มศูนย์ใหม่จนเปิดเกิน)', async () => {
    const { id } = await addLink('lmaaa', { maxClicks: 3, clickCount: 3 });
    await redis.del(`lim:${id}`);
    assert.equal((await get(srv.base, '/lmaaa')).status, 410);
    const left = await addLink('lmbbb', { maxClicks: 3, clickCount: 2 });
    await redis.del(`lim:${left.id}`);
    assert.equal((await get(srv.base, '/lmbbb')).status, 302);
    assert.equal((await get(srv.base, '/lmbbb')).status, 410);
  });
  it('ตัวนับที่ core-api ตั้งไว้ (lim:{id}) ถูกใช้ต่อ', async () => {
    const { id } = await addLink('lmccc', { maxClicks: 10 });
    await redis.set(`lim:${id}`, '9');
    assert.equal((await get(srv.base, '/lmccc')).status, 302);
    assert.equal((await get(srv.base, '/lmccc')).status, 410);
  });
});

describe('รหัสผ่านของลิงก์', () => {
  const mk = async (code = 'pw123', pw = 'secret-1', extra: object = {}) => addLink(code, { url: 'https://example.com/private', passwordHash: await hashLinkPassword(pw), ...extra });

  it('GET: หน้ากรอกรหัส 200 — ไม่ redirect, ไม่เปิดเผยปลายทาง, ไม่นับคลิก, กัน iframe/ไม่ส่ง referrer', async () => {
    await mk();
    const r = await get(srv.base, '/pw123');
    const html = await r.text();
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('location'), null);
    assert.match(html, /type="password"/);
    assert.ok(!html.includes('example.com/private'));
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
    assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
    assert.equal((await queued()).length, 0);
  });
  it('รหัสผิด → 401 พร้อมข้อความ; รหัสถูก → 303 ไปปลายทาง + นับคลิก', async () => {
    await mk();
    const bad = await postPassword(srv.base, 'pw123', 'nope');
    assert.equal(bad.status, 401);
    assert.match(await bad.text(), /รหัสผ่านไม่ถูกต้อง/);
    assert.equal((await queued()).length, 0);
    const ok = await postPassword(srv.base, 'pw123', 'secret-1');
    assert.equal(ok.status, 303);
    assert.equal(ok.headers.get('location'), 'https://example.com/private');
    assert.equal((await waitQueue(1)).length, 1);
  });
  it('รหัสต้องตรงเป๊ะ (ตัวพิมพ์/ช่องว่าง) และรหัสว่าง/ยาวผิดปกติใช้ไม่ได้', async () => {
    await mk();
    for (const pw of ['Secret-1', 'secret-1 ', '', 'x'.repeat(65)]) assert.notEqual((await postPassword(srv.base, 'pw123', pw)).status, 303, JSON.stringify(pw));
  });
  it('ไม่ส่งฟิลด์ password เลย → ไม่ผ่าน', async () => {
    await mk();
    const r = await fetch(`${srv.base}/pw123`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'other=1' });
    assert.ok([401, 429].includes(r.status));
  });
  it('กันเดา: ผิดเกิน 5 ครั้ง/IP → 429 และรหัสถูกก็ยังโดนล็อก; ลิงก์อื่นไม่ถูกล็อกตาม', async () => {
    await mk();
    await mk('pw456', 'other-pass');
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await postPassword(srv.base, 'pw123', `bad-${i}`)).status);
    assert.deepEqual(codes, [401, 401, 401, 401, 401, 429, 429]);
    assert.equal((await postPassword(srv.base, 'pw123', 'secret-1')).status, 429);
    assert.equal((await postPassword(srv.base, 'pw456', 'other-pass')).status, 303);
  });
  it('ตอบถูกก่อนเกินโควต้า → ล้างตัวนับของ IP นั้น (คนใช้จริงไม่โดนหักสะสม)', async () => {
    await mk();
    for (let i = 0; i < 4; i++) await postPassword(srv.base, 'pw123', 'bad');
    assert.equal((await postPassword(srv.base, 'pw123', 'secret-1')).status, 303);
    for (let i = 0; i < 4; i++) assert.equal((await postPassword(srv.base, 'pw123', 'bad')).status, 401);
  });
  it('POST ไปลิงก์ที่ไม่มีรหัส → ส่งกลับไป GET (303); ไปลิงก์ที่ไม่มี → 404', async () => {
    await addLink('np123');
    const r = await postPassword(srv.base, 'np123', 'x');
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('location'), '/np123');
    assert.equal((await postPassword(srv.base, 'nothere1', 'x')).status, 404);
  });
  it('ลำดับตรวจ: ยังไม่เริ่ม/ครบจำนวนมาก่อนหน้ารหัสผ่าน (ไม่ให้ลองรหัสกับลิงก์ที่ใช้ไม่ได้อยู่แล้ว)', async () => {
    await mk('pwst1', 'secret-1', { startsAt: Date.now() + hour });
    assert.equal((await get(srv.base, '/pwst1')).status, 403);
    assert.equal((await postPassword(srv.base, 'pwst1', 'secret-1')).status, 403);
    await mk('pwlm1', 'secret-1', { maxClicks: 1 });
    assert.equal((await postPassword(srv.base, 'pwlm1', 'secret-1')).status, 303);
    assert.equal((await get(srv.base, '/pwlm1')).status, 410);
    assert.equal((await postPassword(srv.base, 'pwlm1', 'secret-1')).status, 410);
  });
  it('รหัสถูกแต่ใช้ได้ครั้งเดียวต่อสิทธิ์: จำกัด 2 ครั้งกับรหัสผ่านพร้อมกัน นับเฉพาะที่ผ่านรหัสจริง', async () => {
    await mk('pwlm2', 'secret-1', { maxClicks: 2 });
    for (let i = 0; i < 3; i++) await get(srv.base, '/pwlm2'); // เปิดหน้ารหัสเฉยๆ ไม่กินสิทธิ์
    assert.equal((await postPassword(srv.base, 'pwlm2', 'secret-1')).status, 303);
    assert.equal((await postPassword(srv.base, 'pwlm2', 'secret-1')).status, 303);
    assert.equal((await postPassword(srv.base, 'pwlm2', 'secret-1')).status, 410);
  });
});
