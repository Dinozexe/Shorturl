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

## Links — `/api/links` (P3)

ทุก endpoint ต้องมี `Authorization: Bearer` และทำได้เฉพาะลิงก์ของตัวเอง (ลิงก์คนอื่น = **404** ไม่ใช่ 403 เพื่อไม่เปิดเผยว่ามีอยู่)

| Method | Path | อธิบาย |
|---|---|---|
| POST | `/api/links` | body `{url, alias?, expiresAt?}` → 201 ลิงก์ที่สร้าง; rate limit 30/นาที/IP |
| GET | `/api/links?q=&page=&pageSize=` | `{items, total, page, pageSize}` ใหม่สุดก่อน; `q` ค้น short code / URL (ไม่สนตัวพิมพ์), `pageSize` ปกติ 20 สูงสุด 100 |
| GET | `/api/links/:id` | ลิงก์เดียว |
| PATCH | `/api/links/:id` | แก้ `{url?, expiresAt? (null = ไม่หมดอายุ), status? ACTIVE\|DISABLED}`; **เปลี่ยน alias ไม่ได้ (400)**; ลิงก์ `ADMIN_DISABLED` เจ้าของเปิดเองไม่ได้ (403) |
| DELETE | `/api/links/:id` | 204 (ลบคลิกที่เกี่ยวข้องด้วย) |
| GET | `/api/links/:id/qr?format=png\|svg&scale=1..20&download=1` | รูป QR ของ short URL — ดำบนขาว, ECC ระดับ H, quiet zone 4 โมดูล; PNG ขนาด = (โมดูล+8)×`scale` พิกเซล (จำนวนเต็ม, ค่าเริ่มต้น 10); `download=1` ส่งเป็นไฟล์แนบ |

**ลิงก์ (response):** `{id, shortCode, shortUrl, originalUrl, originalHost, status, expiresAt, expired, clickCount, createdAt}`
**กติกา**
- URL: http/https เท่านั้น ยาวไม่เกิน 2048, ห้ามมี user:pass, ห้ามชี้ localhost/IP ภายในหรือที่สงวน (ตรวจหลังแปลง IP รูปแบบแปลก เช่น `2130706433`, `0x7f.1`), ห้ามโฮสต์ไม่มีจุด/ลงท้าย `.local .internal .lan ...`, ห้ามชี้ IPv6 ตรงๆ, ห้ามชี้โฮสต์ของระบบนี้เอง (กัน loop), ห้ามอยู่ใน **โดเมนต้องห้าม** (รวม subdomain; `notevil.example` ไม่ถูกบล็อกเมื่อบล็อก `evil.example`)
- alias: 3–30 ตัว `A–Z a–z 0–9 _ -` ขึ้น/ลงท้ายด้วยตัวอักษรหรือตัวเลข แยกตัวพิมพ์เล็กใหญ่ ไม่ใช่คำสงวน (`api admin login dashboard ...`) ซ้ำ = 409
- ไม่ใส่ alias = สุ่ม base62 ยาว `SHORT_CODE_LENGTH` (ปกติ 5) ชนแล้วลองใหม่ ชนบ่อยขยายทีละ 1 ตัว
- `expiresAt`: ISO 8601 ต้องเป็นอนาคตและไม่เกิน 10 ปี
- ทุกครั้งที่สร้าง/แก้ URL ระบบตั้ง `originalHost` (lowercase) ให้อัตโนมัติ

**สัญญา cache กับ redirect-service:** key `link:{code}` = JSON `{i: id, u: url, e: หมดอายุ epoch ms | null}` TTL ≤ 1 ชม. (ไม่เกินเวลาหมดอายุ) เขียนเฉพาะลิงก์ที่ ACTIVE และยังไม่หมดอายุ; ปิด/ลบ/แก้ให้ไม่ ACTIVE = ล้าง key; `0` = negative cache ที่ redirect-service เขียนเอง (ถูกเขียนทับเมื่อสร้าง/เปิดลิงก์)

**Middleware:** `requireAuth` (ตรวจ Bearer + blacklist + ban จาก DB) → `requireRole(...roles)` (ระบุบทบาทที่อนุญาตให้ครบ; ปฏิเสธ API key)
