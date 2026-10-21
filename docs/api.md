# API (core-api)

ทุก router ประกาศ prefix `/api/...` เอง · error เป็นภาษาไทย รูปแบบ `{statusCode, message}` · อัปเดตไฟล์นี้ทุกครั้งที่แก้ API

## Auth — `/api/auth` (P2)

| Method | Path | Auth | อธิบาย |
|---|---|---|---|
| GET | `/api/health` | — | `{status:"ok"}` |
| GET | `/api/auth/sso/providers` | — | `[{id,label}]` เฉพาะ provider ที่ตั้ง env แล้ว |
| GET | `/api/auth/sso/:provider/start` | — (rate limit 20/นาที/IP) | 302 → หน้าล็อกอิน provider (code flow + PKCE + state + nonce); provider ไม่รู้จัก → 404 |
| GET | `/api/auth/sso/:provider/callback` | — (rate limit 20/นาที/IP) | แลก code, ตรวจ id_token, สร้าง/ผูกผู้ใช้, ตั้ง cookie `rt` แล้ว 302 → `FRONTEND_ORIGIN/dashboard`; พลาด → `FRONTEND_ORIGIN/login?sso_error=<ข้อความไทย>` (หน้า `/login` ไม่ใช่หน้าแยกแล้ว: เปิดหน้าต่างเข้าสู่ระบบทับหน้าแรกพร้อมข้อความ) |
| POST | `/api/auth/login` | — (rate limit 10/นาที/IP + 10/15 นาที/อีเมล) | body `{email,password}` → `{accessToken, expiresIn, user}` + cookie `rt`; **เฉพาะบัญชีเดโมใน env (`DEMO_ADMIN_EMAIL/PASSWORD`) — ไม่เก็บรหัสใน DB; ปิดเมื่อเว้น env ว่าง**; 400 body ไม่ถูกต้อง, 401 อีเมล/รหัสผิด (ข้อความเดียวกันทุกกรณี), 403 บัญชีถูกระงับ (หลังรหัสถูก), 429 ถี่เกินไป |
| POST | `/api/auth/refresh` | cookie `rt` (rate limit 30/นาที/IP) | หมุน refresh token → `{accessToken, expiresIn, user}` + cookie `rt` ใหม่; 401 เมื่อไม่ถูกต้อง/ใช้ซ้ำ (ใช้ซ้ำ = เพิกถอนทุก session) |
| POST | `/api/auth/logout` | cookie `rt` + (ถ้ามี) `Authorization: Bearer` | ลบ refresh + blacklist access token → `{ok:true}` |
| GET | `/api/auth/me` | Bearer | `{id,email,name,role}`; 401 ไม่ได้ล็อกอิน, 403 ถูกระงับ |

**Token:** access = JWT 15 นาที (ส่งเป็น `Authorization: Bearer`, เก็บใน memory ฝั่ง client) · refresh = JWT 7 วัน, cookie `rt` (httpOnly, SameSite=Lax, path `/api/auth`) หมุนทุกครั้ง · ทั้งสองมี claim `iatMs` (ms) ใช้เทียบกับ `rtnbf:{userId}`

**ข้อควรระวัง (frontend):** ห้ามเรียก `/api/auth/refresh` ซ้อนกันด้วย cookie เดียว (เช่น 2 แท็บ/2 request พร้อมกัน) — ตัวที่สองถูกมองว่าใช้ซ้ำและเตะทุก session; ให้ทำ single-flight

## Guest — `/api/guest` (ย่อลิงก์โดยไม่ล็อกอิน)

| Method | Path | อธิบาย |
|---|---|---|
| POST | `/api/guest/links` | body `{url}` → 201 `{shortUrl, originalUrl, expiresAt}`; ไม่ต้องมี token; รหัสสุ่มเท่านั้น (ไม่มี alias), **หมดอายุใน 7 วัน**, `user_id = null` จึงไม่มี QR/สถิติ/ประวัติ; กฎตรวจ URL + โดเมนบล็อกเหมือนผู้ใช้ปกติ; rate limit 10/นาที/IP |

## Admin — `/api/admin` (P7)

**ตัวกรองรายการ (ทุก GET ที่เป็นรายการรับ `page`, `pageSize` 1–100):** `q` ค้นหา · `days=1|7|30|90` กรองตามวันที่สร้าง · users: `role`, `banned=0|1`, `sort=login|links` · links: `status`, `owner=guest|member`, `sort=clicks` · audit: `action`, `q` (ค้นในรายละเอียด/อีเมลผู้ทำ)

ต้อง `Authorization: Bearer` ของบัญชี `MODERATOR` หรือ `ADMIN`; rate limit 120/นาที/IP · ทุกการเปลี่ยนแปลงบันทึกใน `audit_logs`

| Method | Path | สิทธิ์ | อธิบาย |
|---|---|---|---|
| GET | `/api/admin/overview` | MOD, ADMIN | `{users, bannedUsers, links, adminDisabledLinks, blockedDomains, clicks}` |
| GET | `/api/admin/users?q=&page=&pageSize=` | ADMIN | ผู้ใช้ + `linkCount`; `q` ค้นอีเมล/ชื่อ |
| PATCH | `/api/admin/users/:id` | ADMIN | `{isBanned?, role?}`; แก้ตัวเองไม่ได้ (400); ระงับ/เปลี่ยนบทบาท = เพิกถอนทุก session ของผู้นั้นทันที |
| GET | `/api/admin/links?q=&status=&page=` | MOD, ADMIN | ลิงก์ทุกคน + `ownerEmail` (null = ผู้เยี่ยมชม); `q` ค้นรหัส/ปลายทาง/อีเมลเจ้าของ |
| PATCH | `/api/admin/links/:id` | MOD, ADMIN | `{status: "ADMIN_DISABLED" \| "ACTIVE"}`; เปิดคืนได้เฉพาะลิงก์ที่ถูกผู้ดูแลปิด และโดเมนต้องไม่ถูกบล็อก (400) |
| GET | `/api/admin/links/:id/stats?days=1..365` | MOD, ADMIN | สถิติของลิงก์ใดก็ได้ รูปแบบเดียวกับ `GET /api/links/:id/stats` (อุปกรณ์/OS/เบราว์เซอร์/ประเทศ/referer/รายวัน); analytics ล่ม → `{unavailable:true}` |
| GET | `/api/admin/blocked-domains?q=` | MOD, ADMIN | รายการโดเมนที่บล็อก + `linkCount` (ลิงก์ที่ชี้โดเมนนี้รวมโดเมนย่อย) และ `disabledCount` (ที่ถูกผู้ดูแลปิด) |
| GET | `/api/admin/blocked-domains/preview?domain=` | MOD, ADMIN | ดูผลกระทบก่อนบล็อก (ไม่เขียนข้อมูล): `{domain, alreadyBlocked, willDisable, totalLinks}`; โดเมนไม่ถูกต้อง = 400 |
| POST | `/api/admin/blocked-domains` | MOD, ADMIN | `{domain, reason?}` (รับ URL ได้ จะตัดเหลือโดเมน) → 201 `{…, disabledLinks}`; **ปิดลิงก์เดิมที่ชี้โดเมนนี้ (รวม subdomain) เป็น `ADMIN_DISABLED` และล้าง cache**; ซ้ำ = 409 |
| DELETE | `/api/admin/blocked-domains/:id` | MOD, ADMIN | 204; **ไม่เปิดลิงก์ที่เคยถูกปิดคืนอัตโนมัติ** (ผู้ดูแลเปิดเองทีละลิงก์) |
| GET | `/api/admin/audit?action=&page=` | ADMIN | บันทึกกิจกรรมใหม่สุดก่อน + `actorEmail` |

## Links — `/api/links` (P3)

ทุก endpoint ต้องมี `Authorization: Bearer` และทำได้เฉพาะลิงก์ของตัวเอง (ลิงก์คนอื่น = **404** ไม่ใช่ 403 เพื่อไม่เปิดเผยว่ามีอยู่)

| Method | Path | อธิบาย |
|---|---|---|
| POST | `/api/links` | body `{url, alias?, expiresAt?, startsAt?, maxClicks?, password?}` → 201 ลิงก์ที่สร้าง; rate limit 30/นาที/IP |
| GET | `/api/links?q=&page=&pageSize=` | `{items, total, page, pageSize}` ใหม่สุดก่อน; `q` ค้น short code / URL (ไม่สนตัวพิมพ์), `pageSize` ปกติ 20 สูงสุด 100 |
| GET | `/api/links/:id` | ลิงก์เดียว |
| PATCH | `/api/links/:id` | แก้ `{url?, expiresAt? (null = ไม่หมดอายุ), status? ACTIVE\|DISABLED, startsAt?, maxClicks?, password?}` (ฟิลด์ป้องกัน: ไม่ส่ง = ไม่เปลี่ยน, `null` = ยกเลิก); **เปลี่ยน alias ไม่ได้ (400)**; ลิงก์ `ADMIN_DISABLED` เจ้าของเปิดเองไม่ได้ (403) |
| DELETE | `/api/links/:id` | 204 (ลบคลิกที่เกี่ยวข้องด้วย) |
| PUT | `/api/links/:id/qr-style` | body `{style}` บันทึกสไตล์ QR ของลิงก์ (`{style:null}` = ล้าง); ฟิลด์: `dots` square/rounded/dots/diamond/classy, `eyes` square/rounded/circle, `fg`/`fg2`/`bg`/`eyeColor` เป็น `#rrggbb` (`fg2`=ไล่เฉด, `bg:null`=โปร่งใส), `angle` 0/45/90/135, `logo` none/link/star/heart/bolt, `logoSize` 10–22, `caption` ≤24 ตัว, `captionStyle` pill/bar/text (ป้าย/แถบ/ตัวอักษร), `margin` 2–8; ฟิลด์ที่ไม่รู้จักถูกทิ้ง ค่าผิด = 400; **ไม่เก็บรูปโลโก้ที่อัปโหลด** (ใช้เฉพาะในเบราว์เซอร์) |
| GET | `/api/links/:id/qr?format=png\|svg\|matrix&scale=1..20&download=1` | รูป QR ของ short URL (แบบมาตรฐานไม่ใส่สไตล์ — สำหรับสคริปต์; หน้าเว็บใช้ `format=matrix` แล้ววาดเองตามสไตล์) — ดำบนขาว, ECC ระดับ H, quiet zone 4 โมดูล; PNG ขนาด = (โมดูล+8)×`scale` พิกเซล (จำนวนเต็ม, ค่าเริ่มต้น 10); `download=1` ส่งเป็นไฟล์แนบ |

**ลิงก์ (response):** `{id, shortCode, shortUrl, originalUrl, originalHost, status, expiresAt, expired, clickCount, startsAt, notStarted, maxClicks, limitReached, hasPassword, qrStyle, createdAt}`
**กติกา**
- URL: http/https เท่านั้น ยาวไม่เกิน 2048, ห้ามมี user:pass, ห้ามชี้ localhost/IP ภายในหรือที่สงวน (ตรวจหลังแปลง IP รูปแบบแปลก เช่น `2130706433`, `0x7f.1`), ห้ามโฮสต์ไม่มีจุด/ลงท้าย `.local .internal .lan ...`, ห้ามชี้ IPv6 ตรงๆ, ห้ามชี้โฮสต์ของระบบนี้เอง (กัน loop), ห้ามอยู่ใน **โดเมนต้องห้าม** (รวม subdomain; `notevil.example` ไม่ถูกบล็อกเมื่อบล็อก `evil.example`)
- alias: 3–30 ตัว `A–Z a–z 0–9 _ -` ขึ้น/ลงท้ายด้วยตัวอักษรหรือตัวเลข แยกตัวพิมพ์เล็กใหญ่ ไม่ใช่คำสงวน (`api admin login dashboard ...`) ซ้ำ = 409
- ไม่ใส่ alias = สุ่ม base62 ยาว `SHORT_CODE_LENGTH` (ปกติ 5) ชนแล้วลองใหม่ ชนบ่อยขยายทีละ 1 ตัว
- `expiresAt`: ISO 8601 ต้องเป็นอนาคตและไม่เกิน 10 ปี
- `startsAt`: ISO 8601 ไม่เกิน 10 ปีข้างหน้า และต้องมาก่อน `expiresAt`; `maxClicks`: จำนวนเต็ม 1–1,000,000; `password`: 4–64 ตัวอักษร (เก็บเป็น scrypt hash)
- `GET /api/links/summary` → `{total, active, clicks}` รวมทุกหน้าของเจ้าของบัญชี (การ์ดสรุปบน dashboard)
- **ผู้เปิดลิงก์:** ยังไม่ถึง `startsAt` → 403 หน้าข้อความ; เปิดครบ `maxClicks` → 410; มีรหัสผ่าน → หน้ากรอกรหัส แล้ว `POST /{code}` (form `password`) ถูก → 303 ไปปลายทาง, ผิด → 401, ลองผิดเกิน 5 ครั้ง/10 นาที/IP/ลิงก์ (หรือ 100 ครั้งรวมทุก IP) → 429; ลำดับตรวจ: ไม่พบ/ปิด/หมดอายุ → ยังไม่เริ่ม → ครบจำนวน → รหัสผ่าน; HEAD ไม่กินสิทธิ์
- ทุกครั้งที่สร้าง/แก้ URL ระบบตั้ง `originalHost` (lowercase) ให้อัตโนมัติ

**สัญญา cache กับ redirect-service:** key `link:{code}` = JSON `{i: id, u: url, e: หมดอายุ epoch ms | null, s?: วันเริ่ม epoch ms, m?: จำกัดคลิก, p?: 1 = มีรหัสผ่าน}; ตัวนับคลิกของลิงก์ที่จำกัด = `lim:{id}` (core-api ตั้งค่าเริ่มจาก `click_count`, redirect-service INCR)` TTL ≤ 1 ชม. (ไม่เกินเวลาหมดอายุ) เขียนเฉพาะลิงก์ที่ ACTIVE และยังไม่หมดอายุ; ปิด/ลบ/แก้ให้ไม่ ACTIVE = ล้าง key; `0` = negative cache ที่ redirect-service เขียนเอง (ถูกเขียนทับเมื่อสร้าง/เปิดลิงก์)

### สถิติ — `GET /api/links/:id/stats?days=30` (P5)

เจ้าของลิงก์เท่านั้น (คนอื่น = 404) `days` 1–365 (ค่าเริ่มต้น 30) ดึงจาก analytics-service ซึ่ง **flush คิวคลิกก่อนอ่าน** ตัวเลขจึงล่าสุดเสมอ
ถ้า analytics-service ล่ม/ไม่ได้ตั้งค่า ตอบ **200** `{unavailable: true, linkId, total}` แทน error (รอได้นานถึง 60 วิเพราะ Render free อาจหลับ)

```json
{ "linkId": 1, "days": 30, "total": 42, "windowClicks": 17, "uniqueVisitors": 9,
  "daily":     [{"day": "2026-10-20", "clicks": 5}, ...],   // วันตาม UTC เรียงเก่า→ใหม่ เติม 0 ครบ days วัน
  "referers":  [{"key": "https://facebook.com", "clicks": 8}, {"key": null, "clicks": 5}],   // key null = เข้าตรง/ไม่มี referer
  "countries": [{"key": "TH", "clicks": 10}],
  "devices":   [{"key": "mobile", "clicks": 12}, {"key": "bot", "clicks": 1}],
  "os": [...], "browsers": [...] }                           // แต่ละกลุ่ม top 10 เรียงมาก→น้อย
```
- `total` = ยอดสะสมทั้งหมด (`links.click_count`); `windowClicks`/breakdown นับเฉพาะ `days` วันล่าสุด และคลิกดิบเก็บ `CLICK_RETENTION_DAYS` (90) วัน — เกินนั้นเหลือแค่ยอดรายวัน
- `uniqueVisitors` = จำนวน IP hash ไม่ซ้ำ (ประมาณ ไม่ใช่ตัวตนคน); `devices` นับบอตด้วย (`bot`)
- วันแบ่งตามเวลา **UTC** (ไม่ใช่เวลาไทย) frontend ควรระบุให้ชัด

## redirect-service (P4) — ไม่มี prefix `/api`

| Method | Path | อธิบาย |
|---|---|---|
| GET | `/:code` | **302** ไป URL ปลายทาง + `Cache-Control: no-store` (ห้าม 301 เพราะ browser แคชแล้วนับคลิกไม่ครบ); ไม่พบ/ปิด/หมดอายุ → หน้าไทย **404**; `code` ต้องเป็น `[A-Za-z0-9_-]{3,30}` ไม่งั้น 404 ทันทีโดยไม่แตะ Redis/DB (แยกตัวพิมพ์เล็กใหญ่) |
| HEAD | `/:code` | redirect เหมือน GET แต่ **ไม่นับคลิก** (ตัวพรีวิวลิงก์) |
| GET | `/` | 302 → `FRONTEND_ORIGIN` |
| GET | `/health` | `{status:"ok"}` · `/favicon.ico` → 204 |

**ลำดับการทำงาน:** อ่าน Redis `link:{code}` → hit: redirect (ไม่แตะ DB) · miss: `SELECT` จาก `links` แล้วเขียน cache (positive TTL ≤ 1 ชม. หรือไม่เกินเวลาหมดอายุ; negative `0` TTL 60 วิ) · Redis ล่ม = ไปถาม DB แทน · DB ล่ม = 503
**สัญญาที่ห้ามเปลี่ยนฝั่งเดียว:** cache `link:{code}` (ดูหัวข้อ Links) และคิวคลิกด้านล่าง

**คิวคลิก** — Redis list `clicks:queue` (ต่อท้ายด้วย RPUSH หลังตอบ redirect ไปแล้ว ไม่หน่วงผู้ใช้) แต่ละรายการเป็น JSON:

| ฟิลด์ | ความหมาย |
|---|---|
| `l` | link id |
| `h` | `sha256(ip + IP_HASH_SALT)` — **ไม่เก็บ IP ดิบ** |
| `ua` | User-Agent (≤ 512 ตัว) หรือ null |
| `r` | **origin** ของ referer เท่านั้น (ตัด path/query) หรือ null |
| `c` | ประเทศ ISO2 จาก `CF-IPCountry` — **เชื่อเฉพาะเมื่อ `BEHIND_CLOUDFLARE=true`** ไม่งั้น null (กันปลอม header) |
| `d` | `desktop` / `mobile` / `tablet` / `bot` / `unknown` |
| `o`, `b` | ระบบปฏิบัติการ / เบราว์เซอร์ (null ถ้าไม่รู้) |
| `t` | เวลา epoch ms |

- คิวยาวเกิน `CLICK_QUEUE_MAX` (ค่าเริ่มต้น 50000) = ทิ้งคลิกเก่าสุด (กัน Redis เต็มตอน analytics ล่ม)
- **Ping flush:** หลังคลิก redirect-service เรียก `POST {ANALYTICS_URL}/internal/flush` พร้อม header `x-internal-key` แบบไม่รอผล ≤ 1 ครั้งต่อ `CLICK_FLUSH_SECONDS` (ข้าม instance ด้วย lock `clicks:flush:ping`) และถ้ามีคลิกในรอบที่ถูกกัน จะตั้ง timer ping ตอนครบรอบ — ไม่มี polling/cron; analytics ล่มไม่กระทบ redirect (คิวค้างใน Redis)
- **ข้อควรระวังสำหรับ analytics-service (P5):** คอลัมน์เวลาใน DB เป็น `timestamp` (UTC ไม่มี time zone) — ตอน INSERT/อ่านด้วย `pg` ต้องแปลงชัดเจน (`to_timestamp(t/1000.0) AT TIME ZONE 'UTC'`, `... AT TIME ZONE 'UTC'` ตอนอ่าน) ไม่งั้นเพี้ยนตาม timezone ของเครื่อง

## analytics-service (P5) — internal เท่านั้น

ทุก endpoint ใต้ `/internal` ต้องมี header `x-internal-key` = `INTERNAL_API_KEY` (เทียบแบบ constant-time; ไม่ตรง = 401) ไม่เปิดให้ผู้ใช้/เบราว์เซอร์เรียกตรง

| Method | Path | อธิบาย |
|---|---|---|
| GET | `/health` | `{status:"ok"}` |
| POST | `/internal/flush` | ดึง `clicks:queue` เขียนลง DB → `{skipped, inserted, discarded, deadLettered, cleaned}` (`skipped:true` = มี flush อื่นถือ lock อยู่) |
| GET | `/internal/links/:id/stats?days=` | flush ก่อน แล้วตอบสถิติรูปแบบเดียวกับด้านบน (404 ถ้าไม่มีลิงก์) |

**Flush ทำงานอย่างไร**
- lock `clicks:flush:lock` (30 วิ, ปล่อยด้วย token) กัน flush ซ้อน → `LPOP` ทีละ `FLUSH_BATCH_SIZE` (1000) สูงสุด 50 ชุด/20 วินาทีต่อครั้ง
- แต่ละชุดเขียนด้วยคำสั่งเดียว (CTE) = **transaction เดียว**: `INSERT clicks` + `UPSERT link_daily_stats` (+) + `UPDATE links.click_count` (+) — ไม่มีวันที่ยอดรายวัน/ยอดรวม/คลิกดิบไม่ตรงกัน
- เหตุการณ์ที่รูปแบบผิดหรือลิงก์ถูกลบไปแล้ว → ทิ้ง (นับใน `discarded`) ไม่ขวางรายการอื่น
- DB ล่ม/หลุด → **คืนคิวไปหัวคิวตามลำดับเดิม** แล้วตอบ 500 (ไม่หาย ไม่ซ้ำ) รอบหน้าลองใหม่
- DB ปฏิเสธข้อมูลของบางรายการ (class 22/23) → แบ่งครึ่งหาตัวที่พังแล้วย้ายไป Redis list `clicks:dead` (เก็บ ≤ 1000) ส่วนที่เหลือเขียนตามปกติ
- ลบคลิกดิบที่เก่ากว่า `CLICK_RETENTION_DAYS` ทีละ 5000 แถว **ไม่เกินชั่วโมงละครั้ง** (lock `clicks:cleanup:lock`) พ่วงกับ flush ไม่มี cron/polling; ยอดรายวันเก็บถาวร
- ข้อจำกัดที่รู้: ถ้า process ตายหลัง `LPOP` แต่ก่อน commit เหตุการณ์ชุดนั้นหาย (หน้าต่างสั้น) — ยอมรับได้สำหรับสถิติ ไม่ใช่ข้อมูลการเงิน

**Middleware:** `requireAuth` (ตรวจ Bearer + blacklist + ban จาก DB) → `requireRole(...roles)` (ระบุบทบาทที่อนุญาตให้ครบ)
