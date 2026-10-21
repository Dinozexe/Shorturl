import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { api, ApiError, refreshSession, refreshSessionDetailed, refreshWithWake, setAccessToken, waitForServer, warmShortLink, warmUp } from '../lib/api';

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const user = { id: 'u1', email: 'a@b.test', name: 'A', role: 'USER' as const };
const ok = { accessToken: 'tok-1', user };

let calls: string[] = [];
function stub(handler: Handler) {
  calls = [];
  mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? 'GET'} ${url.replace('http://localhost:4000', '')}`);
    return handler(url, init);
  });
}
const networkError = () => {
  throw new TypeError('Failed to fetch'); // เบราว์เซอร์โยนแบบนี้ตอน CORS/เครือข่ายล้ม (เช่น Render ยังหลับ)
};

beforeEach(() => setAccessToken(null));
afterEach(() => mock.restoreAll());

describe('refreshSessionDetailed: แยก "ไม่ได้ล็อกอิน" ออกจาก "ติดต่อไม่ได้"', () => {
  it('200 → ok พร้อมผู้ใช้', async () => {
    stub(() => json(ok));
    assert.deepEqual(await refreshSessionDetailed(), { kind: 'ok', user });
  });
  it('401 → anon (ไม่ได้ล็อกอินจริง)', async () => {
    stub(() => json({ message: 'x' }, 401));
    assert.deepEqual(await refreshSessionDetailed(), { kind: 'anon' });
  });
  it('เครือข่ายล้ม (TypeError) → unreachable ไม่ใช่ anon', async () => {
    stub(networkError);
    assert.deepEqual(await refreshSessionDetailed(), { kind: 'unreachable' });
  });
  for (const status of [500, 502, 503, 504]) {
    it(`${status} (เกตเวย์/เซิร์ฟเวอร์ยังไม่พร้อม) → unreachable`, async () => {
      stub(() => json({}, status));
      assert.deepEqual(await refreshSessionDetailed(), { kind: 'unreachable' });
    });
  }
  it('unreachable ไม่ล้าง access token เดิม; anon ล้าง', async () => {
    stub(() => json(ok));
    await refreshSessionDetailed(); // ตั้ง token = tok-1
    stub(networkError);
    await refreshSessionDetailed();
    stub((url, init) => {
      assert.equal((init?.headers as Record<string, string> | undefined)?.authorization, 'Bearer tok-1', 'token เดิมยังอยู่หลังเครือข่ายล้ม');
      return json({ id: 1 });
    });
    await api('/api/links');
    stub(() => json({}, 401));
    await refreshSessionDetailed();
    stub((url, init) => {
      assert.equal((init?.headers as Record<string, string> | undefined)?.authorization, undefined, 'หลัง 401 ต้องไม่มี token');
      return json({ id: 1 });
    });
    await api('/api/links');
  });
  it('เรียกซ้อนกัน = ยิงจริงครั้งเดียว (single-flight กัน refresh token ถูกใช้ซ้ำ)', async () => {
    stub(async () => {
      await new Promise((r) => setTimeout(r, 30));
      return json(ok);
    });
    const [a, b, c] = await Promise.all([refreshSessionDetailed(), refreshSessionDetailed(), refreshSession()]);
    assert.equal(a.kind, 'ok');
    assert.equal(b.kind, 'ok');
    assert.equal(c?.id, 'u1');
    assert.equal(calls.filter((c) => c.includes('/api/auth/refresh')).length, 1);
  });
});

describe('waitForServer: รอเซิร์ฟเวอร์ตื่น', () => {
  it('health ตอบ ok ครั้งแรก → true ทันที', async () => {
    stub(() => json({ status: 'ok' }));
    assert.equal(await waitForServer({ maxMs: 500, intervalMs: 5 }), true);
    assert.equal(calls.length, 1);
  });
  it('ล้ม 3 ครั้ง (เครือข่าย/503) แล้วตื่น → true หลังลองซ้ำ', async () => {
    let n = 0;
    stub(() => {
      n++;
      if (n === 1) return networkError();
      if (n <= 3) return json({}, 503);
      return json({ status: 'ok' });
    });
    assert.equal(await waitForServer({ maxMs: 2000, intervalMs: 5 }), true);
    assert.equal(calls.length, 4);
  });
  it('ไม่ตื่นจนหมดเวลา → false (ไม่วนไม่รู้จบ)', async () => {
    stub(networkError);
    const t = Date.now();
    assert.equal(await waitForServer({ maxMs: 150, intervalMs: 20 }), false);
    assert.ok(Date.now() - t < 1500);
  });
  it('probe ที่ค้างนานเกิน probeMs ถูกยกเลิก ไม่ค้างทั้งระบบ', async () => {
    stub((url, init) => new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
    const t = Date.now();
    assert.equal(await waitForServer({ maxMs: 300, intervalMs: 10, probeMs: 50 }), false);
    assert.ok(Date.now() - t < 1500);
    assert.ok(calls.length >= 2, 'ต้องลองหลายรอบ ไม่ใช่ค้างที่รอบแรก');
  });
});

describe('refreshWithWake: ตอนเปิดหน้าขณะเซิร์ฟเวอร์หลับ', () => {
  it('ปกติ: ยิง refresh ครั้งเดียว ไม่แตะ health', async () => {
    stub(() => json(ok));
    assert.equal((await refreshWithWake({ maxMs: 500, intervalMs: 5 })).kind, 'ok');
    assert.deepEqual(calls, ['POST /api/auth/refresh']);
  });
  it('หลับ: refresh ล้ม → รอ health ตื่น → refresh ซ้ำสำเร็จ (ผู้ใช้ไม่ถูกมองว่าออกจากระบบ)', async () => {
    let awake = false;
    let healthTries = 0;
    stub((url) => {
      if (url.endsWith('/api/health')) {
        if (++healthTries >= 3) awake = true;
        return awake ? json({ status: 'ok' }) : networkError();
      }
      return awake ? json(ok) : networkError();
    });
    const r = await refreshWithWake({ maxMs: 3000, intervalMs: 5 });
    assert.equal(r.kind, 'ok');
    assert.equal(calls.filter((c) => c.includes('/api/auth/refresh')).length, 2, 'refresh แค่ 2 ครั้ง (ก่อนหลับ-หลังตื่น) ไม่ยิงถี่ๆ เสี่ยงใช้ token ซ้ำ');
    assert.equal(healthTries, 3);
  });
  it('ตื่นแล้วแต่ไม่ได้ล็อกอิน → anon', async () => {
    let awake = false;
    stub((url) => {
      if (url.endsWith('/api/health')) {
        awake = true;
        return json({ status: 'ok' });
      }
      return awake ? json({}, 401) : networkError();
    });
    assert.equal((await refreshWithWake({ maxMs: 1000, intervalMs: 5 })).kind, 'anon');
  });
  it('ไม่ตื่นเลยจนหมดเวลา → unreachable (ให้หน้าจอขึ้นปุ่มลองใหม่ ไม่เด้งไปหน้าล็อกอิน)', async () => {
    stub(networkError);
    assert.equal((await refreshWithWake({ maxMs: 120, intervalMs: 20 })).kind, 'unreachable');
  });
});

describe('request(): 401 แล้ว refresh ติดต่อไม่ได้ ≠ session หมด', () => {
  it('โยน ApiError(0) ข้อความเรื่องเซิร์ฟเวอร์ และไม่ประกาศ session-lost', async () => {
    let lost = 0;
    (globalThis as { window?: unknown }).window = { dispatchEvent: () => ((lost += 1), true) };
    try {
      stub((url) => (url.includes('/api/auth/refresh') ? networkError() : json({ message: 'no' }, 401)));
      await assert.rejects(api('/api/links'), (e: unknown) => e instanceof ApiError && e.status === 0 && /เซิร์ฟเวอร์/.test(e.message));
      assert.equal(lost, 0, 'ไม่ควรเตะผู้ใช้ออกเพราะเซิร์ฟเวอร์แค่ไม่ตอบ');
      // เทียบ: 401 แล้ว refresh ก็ 401 = session หมดจริง → ประกาศ
      stub((url) => json({ message: 'no' }, 401));
      await assert.rejects(api('/api/links'), (e: unknown) => e instanceof ApiError && e.status === 401);
      assert.equal(lost, 1);
    } finally {
      delete (globalThis as { window?: unknown }).window;
    }
  });
  it('ข้อความ error เครือข่ายไม่โทษแต่อินเทอร์เน็ตผู้ใช้', async () => {
    stub(networkError);
    await assert.rejects(api('/api/guest/links', { method: 'POST', body: {}, auth: false }), (e: unknown) => e instanceof ApiError && /เริ่มทำงาน/.test(e.message));
  });
});

describe('warmUp: ปลุกล่วงหน้า', () => {
  it('ยิง no-cors ไม่รอผล ไม่โยน error แม้ล้ม และไม่ยิงซ้ำภายใน 4 นาที', async () => {
    stub(networkError);
    warmUp('https://warm-a.example.test/health');
    warmUp('https://warm-a.example.test/health');
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(calls.filter((c) => c.includes('warm-a.example.test')).length, 1);
  });
  it('คนละ URL ปลุกแยกกัน; warmShortLink ปลุก origin ของลิงก์สั้นที่ /health', async () => {
    stub(() => json({}));
    warmShortLink('https://s.warm-b.example.test/aB3xZ');
    warmShortLink('ไม่ใช่ url');
    await new Promise((r) => setTimeout(r, 10));
    assert.deepEqual(calls, ['GET https://s.warm-b.example.test/health']);
  });
});
