import { config } from './config';

// หน้าข้อความภาษาไทย/อังกฤษ — ข้อความตายตัว ไม่ใส่ข้อมูลจากผู้ใช้เพื่อกัน XSS (code ที่ใส่ใน action ผ่าน CODE_RE แล้ว)
const STYLE = `
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f7f9;color:#1c2330;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
  main{max-width:28rem;width:100%;box-sizing:border-box;padding:2rem 1.5rem;text-align:center}
  h1{font-size:1.5rem;margin:0 0 .75rem}
  h2{font-size:1.1rem;margin:1.5rem 0 .5rem;color:#4a5568}
  p{margin:0 0 1.5rem;line-height:1.6;color:#4a5568}
  a{color:#1d4ed8}
  .icon{display:inline-grid;place-items:center;width:3.5rem;height:3.5rem;border-radius:1.1rem;background:#2563eb1f;color:#2563eb;margin-bottom:1rem}
  form{display:flex;flex-direction:column;gap:.75rem;text-align:left;margin:0 0 1.5rem}
  input{font:inherit;padding:.8rem 1rem;border-radius:.8rem;border:1px solid #cbd2dc;background:#fff;color:inherit}
  input:focus{outline:2px solid #2563eb;outline-offset:1px;border-color:transparent}
  button{font:inherit;font-weight:600;padding:.8rem 1rem;border:0;border-radius:.8rem;background:#2563eb;color:#fff;cursor:pointer}
  button:hover{opacity:.9}
  .err{color:#c53030;font-weight:600;margin:0}
  @media (prefers-color-scheme:dark){body{background:#12151c;color:#e6e9ef}p{color:#a0aec0}h2{color:#a0aec0}a{color:#7aa2ff}input{background:#1a1f2b;border-color:#2f3748}.icon{color:#7aa2ff}}`;

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>`;
}

const homeLink = () => `<a href="${config.frontendOrigin}">สร้างลิงก์ย่อของคุณเอง · Make your own short link</a>`;

const ICON = {
  lock: '<path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z"/>',
  clock: '<path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>',
  stop: '<path d="M12 8v5M12 16.5v.5M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
};
const icon = (name: keyof typeof ICON) =>
  `<span class="icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg></span>`;

export function notFoundPage(): string {
  return layout(
    'ไม่พบลิงก์นี้ · Link not found',
    `  <h1>ไม่พบลิงก์นี้</h1>
  <p>ลิงก์อาจพิมพ์ผิด ถูกปิดใช้งาน หรือหมดอายุแล้ว</p>
  <h2>Link not found</h2>
  <p>The link may have been mistyped, switched off, or expired.</p>
  ${homeLink()}`,
  );
}

export function limitReachedPage(): string {
  return layout(
    'ลิงก์นี้ใช้ครบแล้ว · Link limit reached',
    `  ${icon('stop')}
  <h1>ลิงก์นี้ถูกเปิดครบจำนวนแล้ว</h1>
  <p>เจ้าของลิงก์กำหนดจำนวนครั้งที่เปิดได้ไว้ และตอนนี้ครบแล้ว</p>
  <h2>This link has reached its limit</h2>
  <p>The owner set a maximum number of opens, and it has been used up.</p>
  ${homeLink()}`,
  );
}

export function notStartedPage(startsAt: number): string {
  const when = new Date(startsAt).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Bangkok' });
  const whenEn = new Date(startsAt).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Bangkok' });
  return layout(
    'ลิงก์นี้ยังไม่เปิดใช้งาน · Link not active yet',
    `  ${icon('clock')}
  <h1>ลิงก์นี้ยังไม่เปิดใช้งาน</h1>
  <p>จะเปิดให้ใช้ได้ตั้งแต่ ${when} (เวลาไทย)</p>
  <h2>This link isn't active yet</h2>
  <p>It becomes available on ${whenEn} (Thailand time).</p>
  ${homeLink()}`,
  );
}

export type PasswordProblem = 'wrong' | 'locked' | null;

export function passwordPage(code: string, problem: PasswordProblem = null): string {
  const msg =
    problem === 'wrong'
      ? '<p class="err" role="alert">รหัสผ่านไม่ถูกต้อง · Wrong password</p>'
      : problem === 'locked'
        ? '<p class="err" role="alert">ลองผิดหลายครั้งเกินไป รอสักครู่แล้วลองใหม่ · Too many attempts, try again later</p>'
        : '';
  return layout(
    'ลิงก์นี้มีรหัสผ่าน · Password required',
    `  ${icon('lock')}
  <h1>ลิงก์นี้มีรหัสผ่าน</h1>
  <p>กรอกรหัสผ่านที่เจ้าของลิงก์ให้ไว้ เพื่อไปต่อ<br>Enter the password from the link owner to continue.</p>
  <form method="post" action="/${code}">
    <input type="password" name="password" placeholder="รหัสผ่าน · Password" autocomplete="off" maxlength="64" required autofocus aria-label="รหัสผ่าน · Password">
    ${msg}
    <button type="submit">ไปต่อ · Continue</button>
  </form>`,
  );
}
