import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseUa } from '../../src/ua';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const ANDROID_TAB = 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const WIN_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const WIN_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const LINUX_FF = 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0';
const SAMSUNG = 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36';

describe('parseUa', () => {
  const cases: Array<[string, string | undefined, { device: string; os: string | null; browser: string | null }]> = [
    ['iPhone Safari', IPHONE, { device: 'mobile', os: 'iOS', browser: 'Safari' }],
    ['iPad = tablet', IPAD, { device: 'tablet', os: 'iOS', browser: 'Safari' }],
    ['Android มือถือ Chrome', ANDROID, { device: 'mobile', os: 'Android', browser: 'Chrome' }],
    ['Android ไม่มี Mobile = tablet', ANDROID_TAB, { device: 'tablet', os: 'Android', browser: 'Chrome' }],
    ['Windows Chrome', WIN_CHROME, { device: 'desktop', os: 'Windows', browser: 'Chrome' }],
    ['Windows Edge (ไม่ถูกนับเป็น Chrome)', WIN_EDGE, { device: 'desktop', os: 'Windows', browser: 'Edge' }],
    ['macOS Safari', MAC_SAFARI, { device: 'desktop', os: 'macOS', browser: 'Safari' }],
    ['Linux Firefox', LINUX_FF, { device: 'desktop', os: 'Linux', browser: 'Firefox' }],
    ['Samsung Internet', SAMSUNG, { device: 'mobile', os: 'Android', browser: 'Samsung Internet' }],
    ['ไม่มี UA', undefined, { device: 'unknown', os: null, browser: null }],
    ['UA ว่าง', '', { device: 'unknown', os: null, browser: null }],
    ['UA แปลก ไม่รู้จัก', 'Foo/1.0', { device: 'unknown', os: null, browser: null }],
  ];
  for (const [name, ua, want] of cases) it(name, () => assert.deepEqual(parseUa(ua), want));

  const bots = ['Googlebot/2.1 (+http://www.google.com/bot.html)', 'facebookexternalhit/1.1', 'curl/8.4.0', 'python-requests/2.31', 'WhatsApp/2.23', 'Slackbot-LinkExpanding 1.0', 'Mozilla/5.0 HeadlessChrome/120', 'Go-http-client/2.0', 'Lighthouse'];
  for (const ua of bots) it(`บอต/ตัวพรีวิว: ${ua.slice(0, 28)}`, () => assert.equal(parseUa(ua).device, 'bot'));

  it('ตัด UA ยาวผิดปกติที่ 512 ตัว ไม่ช้า/ไม่พัง', () => {
    const t = Date.now();
    assert.equal(parseUa(`${WIN_CHROME} ${'x'.repeat(100_000)}`).device, 'desktop');
    assert.ok(Date.now() - t < 200);
  });
});
