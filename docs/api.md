# API (core-api)

ทุก router ประกาศ prefix `/api/...` เอง · error เป็นภาษาไทย รูปแบบ `{statusCode, message}` · อัปเดตไฟล์นี้ทุกครั้งที่แก้ API

## Auth — `/api/auth` (P2)

| Method | Path | Auth | อธิบาย |
|---|---|---|---|
| GET | `/api/health` | — | `{status:"ok"}` |
| GET | `/api/auth/sso/providers` | — | `[{id,label}]` เฉพาะ provider ที่ตั้ง env แล้ว |
| GET | `/api/auth/sso/:provider/start` | — (rate limit 20/นาที/IP) | 302 → หน้าล็อกอิน provider (code flow + PKCE + state + nonce); provider ไม่รู้จัก → 404 |
| GET | `/api/auth/sso/:provider/callback` | — (rate limit 20/นาที/IP) | แลก code, ตรวจ id_token, สร้าง/ผูกผู้ใช้, ตั้ง cookie `rt` แล้ว 302 → `FRONTEND_ORIGIN/dashboard`; พลาด → `FRONTEND_ORIGIN/login?sso_error=<ข้อความไทย>` |
| POST | `/api/auth/login` | — (rate limit 10/นาที/IP + 10/15 นาที/อีเมล) | body `{email,password}` → `{accessToken, expiresIn, user}` + cookie `rt`; **เฉพาะบัญชีเดโมใน env (`DEMO_ADMIN_EMAIL/PASSWORD`) — ไม่เก็บรหัสใน DB; ปิดเมื่อเว้น env ว่าง**; 400 body ไม่ถูกต้อง, 401 อีเมล/รหัสผิด (ข้อความเดียวกันทุกกรณี), 403 บัญชีถูกระงับ (หลังรหัสถูก), 429 ถี่เกินไป |
| POST | `/api/auth/refresh` | cookie `rt` (rate limit 30/นาที/IP) | หมุน refresh token → `{accessToken, expiresIn, user}` + cookie `rt` ใหม่; 401 เมื่อไม่ถูกต้อง/ใช้ซ้ำ (ใช้ซ้ำ = เพิกถอนทุก session) |
| POST | `/api/auth/logout` | cookie `rt` + (ถ้ามี) `Authorization: Bearer` | ลบ refresh + blacklist access token → `{ok:true}` |
| GET | `/api/auth/me` | Bearer | `{id,email,name,role}`; 401 ไม่ได้ล็อกอิน, 403 ถูกระงับ |

**Token:** access = JWT 15 นาที (ส่งเป็น `Authorization: Bearer`, เก็บใน memory ฝั่ง client) · refresh = JWT 7 วัน, cookie `rt` (httpOnly, SameSite=Lax, path `/api/auth`) หมุนทุกครั้ง · ทั้งสองมี claim `iatMs` (ms) ใช้เทียบกับ `rtnbf:{userId}`

**ข้อควรระวัง (frontend):** ห้ามเรียก `/api/auth/refresh` ซ้อนกันด้วย cookie เดียว (เช่น 2 แท็บ/2 request พร้อมกัน) — ตัวที่สองถูกมองว่าใช้ซ้ำและเตะทุก session; ให้ทำ single-flight

**Middleware:** `requireAuth` (ตรวจ Bearer + blacklist + ban จาก DB) → `requireRole(...roles)` (ระบุบทบาทที่อนุญาตให้ครบ; ปฏิเสธ API key)
