import { config } from './config';

// หน้าข้อความภาษาไทยเมื่อไม่พบ/ปิด/หมดอายุ — ข้อความตายตัว ไม่ใส่ข้อมูลจากผู้ใช้เพื่อกัน XSS
export function notFoundPage(): string {
  const home = config.frontendOrigin;
  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>ไม่พบลิงก์นี้ · Link not found</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f7f9;color:#1c2330;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
  main{max-width:28rem;padding:2rem 1.5rem;text-align:center}
  h1{font-size:1.5rem;margin:0 0 .75rem}
  h2{font-size:1.1rem;margin:1.5rem 0 .5rem;color:#4a5568}
  p{margin:0 0 1.5rem;line-height:1.6;color:#4a5568}
  a{color:#1d4ed8}
  @media (prefers-color-scheme:dark){body{background:#12151c;color:#e6e9ef}p{color:#a0aec0}a{color:#7aa2ff}}
</style>
</head>
<body>
<main>
  <h1>ไม่พบลิงก์นี้</h1>
  <p>ลิงก์อาจพิมพ์ผิด ถูกปิดใช้งาน หรือหมดอายุแล้ว</p>
  <h2>Link not found</h2>
  <p>The link may have been mistyped, switched off, or expired.</p>
  <a href="${home}">สร้างลิงก์ย่อของคุณเอง · Make your own short link</a>
</main>
</body>
</html>`;
}
