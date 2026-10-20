// แยก User-Agent แบบเบาๆ ไม่พึ่ง library: device / OS / เบราว์เซอร์ (ไม่รู้ = null / unknown)
export type Device = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';

export interface UaInfo {
  device: Device;
  os: string | null;
  browser: string | null;
}

const BOT_RE =
  /bot\b|bot\/|crawl|spider|slurp|bingpreview|facebookexternalhit|facebot|whatsapp|telegram|discord|slack|embedly|preview|headless|lighthouse|pingdom|uptime|curl\/|wget\/|python-requests|python-urllib|go-http-client|java\/|okhttp|axios|node-fetch|libwww|httpclient|postman|insomnia/i;

function detectOs(ua: string): string | null {
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows NT|Windows Phone/.test(ua)) return 'Windows';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/Linux|X11/.test(ua)) return 'Linux';
  return null;
}

function detectBrowser(ua: string): string | null {
  if (/Edg(e|A|iOS)?\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
  if (/Firefox\/|FxiOS/.test(ua)) return 'Firefox';
  if (/Chrome\/|CriOS/.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  if (/MSIE|Trident/.test(ua)) return 'IE';
  return null;
}

export function parseUa(raw: string | undefined): UaInfo {
  const ua = (raw ?? '').slice(0, 512);
  if (!ua) return { device: 'unknown', os: null, browser: null };

  const os = detectOs(ua);
  const browser = detectBrowser(ua);
  if (BOT_RE.test(ua)) return { device: 'bot', os, browser };

  let device: Device = 'unknown';
  if (/iPad|Tablet|PlayBook|Silk/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) device = 'tablet';
  else if (/iPhone|iPod|Mobile|Android|Windows Phone/.test(ua)) device = 'mobile';
  else if (os === 'Windows' || os === 'macOS' || os === 'Linux' || os === 'ChromeOS') device = 'desktop';
  return { device, os, browser };
}
