# PRD — ShortURL (Synnerry Developer Test)

> สเปกผลิตภัณฑ์ + แผนงานแบ่งเป็น Phase สำหรับทำเองและ commit ทีละส่วน  
> เอกสารอ้างอิง: `README.md`, `docs/er-diagram.md`, `docs/dfd.md`, `docs/diagrams.html`

## 1. ภาพรวม

| หัวข้อ | รายละเอียด |
|---|---|
| ปัญหา | ลิงก์ยาว แชร์/พิมพ์/ใส่ QR ไม่สะดวก และเจ้าของลิงก์ไม่รู้ว่าใครคลิกจากไหน |
| ทางแก้ | ระบบย่อลิงก์ที่ต้องล็อกอิน (SSO) สร้างลิงก์สั้น + QR ดูสถิติการคลิก (อุปกรณ์/ประเทศ/referer) มีหน้าแอดมินคุมการใช้งาน |
| บริบท | ข้อสอบ Developer (Synnerry): Node.js + React, ส่ง GitHub + README + URL ทดสอบ ภายใน 3 วัน, Video Call ≤ 30 นาที |
| จุดเด่นที่เลือกทำ | **Micro Service** (core-api / redirect-service / analytics-service) + Architecture Diagram, SSO เป็นหลัก + บัญชีเดโมล็อกอินรหัสผ่านให้กรรมการ, RBAC 3 บทบาท, audit log, บล็อกโดเมน, CLI |
| ข้อจำกัด | deploy ฟรี ไม่ผูกบัตร (Render + Neon + Upstash + Cloudflare Pages), ใช้โดเมน `kittametdev.com` เดิม |

### เป้าหมาย
1. ผ่านเกณฑ์ข้อสอบครบทุกข้อ (ตารางข้อ 6)
2. สร้างลิงก์สั้นแล้ว **คลิกได้จริงบนเซิร์ฟเวอร์จริง**
3. อธิบายสถาปัตยกรรมและเหตุผลการออกแบบได้ใน Video Call ≤ 30 นาที

### ไม่ใช่เป้าหมาย (Non-goals)
- สร้างลิงก์แบบ guest (ไม่ล็อกอิน) · สมัครสมาชิก/ลืมรหัสผ่าน/เปลี่ยนรหัสผ่าน (รหัสผ่านมีเฉพาะบัญชีเดโมใน env ไม่เก็บใน DB) · custom domain ต่อผู้ใช้ · เก็บเงิน/แพ็กเกจ · A/B หรือ deep link · รองรับ traffic ระดับ production จริง

## 2. ผู้ใช้

| บทบาท | ทำอะไรได้ |
|---|---|
| **USER** | ล็อกอินด้วย Google/Microsoft, สร้าง/แก้/ปิด/ลบลิงก์ของตัวเอง, ดู QR และสถิติ |
| **MODERATOR** | + ดูภาพรวมระบบ, ปิด/เปิดลิงก์ทุกคน, จัดการโดเมนต้องห้าม |
| **ADMIN** | + จัดการผู้ใช้ (ระงับ/เปลี่ยนบทบาท), ดู audit log |
| **ผู้เยี่ยมชมลิงก์สั้น** | เปิด `/:code` แล้วถูกพาไปปลายทาง (ไม่ต้องล็อกอิน) |
| **กรรมการ** | เปิดเว็บ ล็อกอินด้วยบัญชีทดสอบ ทดลองสร้างลิงก์ ดูไดอะแกรม |

## 3. Functional Requirements

ลำดับความสำคัญ: **M** = ต้องมี (เกณฑ์ข้อสอบ/แกนระบบ) · **S** = ควรมี · **C** = ถ้ามีเวลา

### 3.1 บัญชีและสิทธิ์
| ID | ความต้องการ | P |
|---|---|---|
| AUTH-1 | ล็อกอิน/สมัครอัตโนมัติด้วย Google (OIDC code + PKCE) | M |
| AUTH-2 | ล็อกอินด้วย Microsoft | S |
| AUTH-3 | access token 15 นาที (เก็บในหน่วยความจำ) + refresh token 7 วัน (httpOnly cookie) หมุนทุกครั้ง; สถานะใน Redis ไม่เก็บ DB; ใช้ token เก่าซ้ำ = เพิกถอนทุก session | M |
| AUTH-4 | logout (ลบ refresh + blacklist access) | M |
| AUTH-5 | ระบุตัวตนด้วย `sub` ของ provider ผูกบัญชีข้าม provider เฉพาะอีเมลที่ provider รับรอง | S |
| AUTH-6 | แอดมินคนแรกจาก `ADMIN_EMAIL` (seed) | M |
| AUTH-7 | บัญชีเดโมสำหรับกรรมการ: `POST /api/auth/login` อีเมล+รหัสผ่าน เทียบกับ env `DEMO_ADMIN_EMAIL/PASSWORD` โดยตรง ไม่เก็บรหัส/hash ใน DB (ไม่มีสมัคร/ลืม/เปลี่ยนรหัส) | M |
| RBAC-1 | 3 บทบาท USER/MODERATOR/ADMIN ตรวจทั้ง API และ UI; ban/เปลี่ยนบทบาทมีผลทันที | M |
| USR-1 | แอดมินดูรายชื่อ ระงับ/ยกเลิก เปลี่ยนบทบาท (ห้ามทำกับตัวเอง/แอดมินด้วยกัน) | M |

### 3.2 ลิงก์และ QR
| ID | ความต้องการ | P |
|---|---|---|
| LNK-1 | สร้างลิงก์สั้นจาก URL ยาว (short code สุ่ม ชนแล้วขยายความยาวเอง) | M |
| LNK-2 | alias กำหนดเอง (regex + คำสงวน) และวันหมดอายุ | M |
| LNK-3 | ตรวจ URL: http/https เท่านั้น, ไม่มี credentials, ไม่ชี้ host ภายใน/ตัวเอง, ไม่อยู่ในโดเมนต้องห้าม | M |
| LNK-4 | รายการลิงก์ของฉัน ค้นหา แบ่งหน้า | M |
| LNK-5 | แก้ URL/วันหมดอายุ, เปิด-ปิด, ลบ | M |
| LNK-6 | สถานะ ACTIVE / DISABLED (เจ้าของ) / ADMIN_DISABLED (ผู้ดูแล เจ้าของเปิดเองไม่ได้) | M |
| QR-1 | QR ต่อลิงก์ ดาวน์โหลด PNG/SVG — ECC ระดับ H, quiet zone 4 โมดูล, ดำบนขาว, PNG สเกลเป็นจำนวนเต็มพิกเซล | M |
| QR-2 | **QR ปรับแต่งได้** (ฟีเจอร์เสริม ✅ ทำแล้ว): ลายจุด/ตา/สี/ไล่เฉด/โลโก้/ข้อความใต้ QR, ตัวอย่างสด, บันทึกสไตล์ต่อลิงก์ (`links.qr_style`), เตือนคอนทราสต์ต่ำ, ทุกลายสแกนติดตามการทดสอบ jsQR | S |
| LNK-G | **ย่อลิงก์โดยไม่ล็อกอิน** ✅ ทำแล้ว: ได้ลิงก์สั้นอย่างเดียว หมดอายุ 7 วัน ไม่มี QR/สถิติ/ประวัติ (rate limit 10/นาที/IP) | S |
| LNK-P | **ป้องกันลิงก์** (รหัสผ่าน / จำกัดจำนวนคลิก / วันเริ่ม) — ฟีเจอร์เสริมที่เลือกไว้ ✅ เสร็จ (รหัสผ่านแบบ scrypt + กันเดา 5 ครั้ง/10 นาที, จำกัดคลิกด้วยตัวนับ Redis แบบ atomic, วันเริ่มใช้งาน) | S |

### 3.3 Redirect และสถิติ
| ID | ความต้องการ | P |
|---|---|---|
| RDR-1 | `GET /:code` → 302 + `no-store`; ผ่าน Redis cache (มี negative cache) | M |
| RDR-2 | ลิงก์ปิด/หมดอายุ/ไม่พบ → หน้าข้อความภาษาไทย (404) | M |
| RDR-3 | ไม่เขียน DB ใน request path: ส่งคลิกเข้าคิว Redis | M |
| ANL-1 | batch เขียน `clicks` + เพิ่ม `click_count` + สะสม `link_daily_stats` ใน transaction เดียว | M |
| ANL-2 | เก็บ device/OS/browser (parse UA), ประเทศ (`CF-IPCountry` หรือ geoip offline), referer, IP แบบ hash | M |
| ANL-3 | หน้าสถิติต่อลิงก์: กราฟรายวัน 30 วัน + อุปกรณ์/OS/เบราว์เซอร์/ประเทศ/referer | M |
| ANL-4 | ลบคลิกดิบเกิน `CLICK_RETENTION_DAYS` (90) ยอดรายวันเก็บถาวร | S |

### 3.4 แอดมิน
| ID | ความต้องการ | P |
|---|---|---|
| ADM-1 | ภาพรวม: จำนวนผู้ใช้/ลิงก์/คลิก/ใหม่ 24 ชม. | S |
| ADM-2 | ลิงก์ทั้งระบบ ค้นหา ปิด/เปิด | M |
| ADM-3 | โดเมนต้องห้าม: เพิ่ม/ลบ (รวม subdomain) และ **ปิดลิงก์เดิมที่ชี้โดเมนนั้นอัตโนมัติ** | M |
| ADM-4 | audit log: login, สมัคร, ban/unban, เปลี่ยนบทบาท, ปิด/เปิดลิงก์, บล็อกโดเมน; กรองตามชนิด | M |

### 3.5 CLI
| ID | ความต้องการ | P |
|---|---|---|
| CLI-1 | `surl dev/status/migrate` (รันโปรเจกต์ตอนพัฒนา) | C |

## 4. Non-functional Requirements

| หมวด | เกณฑ์ |
|---|---|
| ประสิทธิภาพ | redirect ที่ cache hit ไม่แตะ DB; p95 < 150 ms (ตอน service ตื่น) |
| ความปลอดภัย | ไม่เก็บรหัสผ่านใน DB (รหัสบัญชีเดโมอยู่ใน env เท่านั้น, rate limit ต่อ IP + ต่ออีเมล); secret ผ่าน env เท่านั้น; ตรวจ URL กัน SSRF/loop; rate limit ที่ SSO endpoint; internal API ใช้ `x-internal-key`; IP เก็บแบบ hash; cookie httpOnly + SameSite=Lax |
| ความพร้อมใช้ | ยอมรับ cold start ของ Render free (30–50 วิ); analytics ล่มต้องไม่ทำให้ redirect ล้ม (คิวค้างใน Redis แล้ว flush ทีหลัง) |
| ต้นทุน | 0 บาท ไม่ผูกบัตร; Upstash ≤ 500k คำสั่ง/เดือน (ไม่มี polling/cron) |
| บำรุงรักษา | migration ทุกครั้งที่แก้ schema; error/UI ภาษาไทย; เอกสารตรงกับโค้ด |

## 5. สถาปัตยกรรมโดยย่อ

`frontend (Cloudflare Pages)` → `core-api (Render)` · `redirect-service (Render)` · `analytics-service (Render)` ใช้ PostgreSQL (Neon) ร่วมกัน + Redis (Upstash)  
สัญญาระหว่าง service: cache `link:{code}` = `{i,u,e}`, คิว `clicks:queue`, `POST /internal/flush`, `GET /internal/links/:id/stats` ดูรายละเอียดที่ `docs/diagrams.html`

## 6. ตรวจกับเกณฑ์ข้อสอบ

| เกณฑ์ | ส่งมอบ | Phase |
|---|---|---|
| DFD Level 0 (+1, 2) | `docs/dfd.md`, `docs/diagrams.html` | P0 (เสร็จแล้ว) |
| ER Diagram | `docs/er-diagram.md` | P0 (เสร็จแล้ว) |
| สร้าง Short URL แล้วคลิกได้จริง | LNK-1..6, RDR-1..3 | P3, P4 |
| QR Code | QR-1 | P3 |
| ประวัติ + สถิติการคลิก | ANL-1..3, LNK-4 | P5, P6 |
| ไอเดียเพิ่มเติม | RBAC, audit, บล็อกโดเมน, device/ประเทศ, CLI | P7, P8 |
| Micro Service + Architecture Diagram (พิเศษ) | 3 service + `docs/diagrams.html` | P2–P5 |
| GitHub + README ละเอียด | README | P9 |
| URL ออนไลน์ + user/password | Render/Cloudflare Pages + บัญชีเดโม (อีเมล/รหัสผ่าน) + บัญชี Google สำรอง | P9 |

---

## 7. แผนงานแบ่งเป็น Phase

รวมประมาณ **3 วัน (~24 ชม. ทำงานจริง)** — แต่ละ Phase จบด้วยของที่ **รัน/ทดสอบได้** และ commit ได้เลย  
สถานะ Phase 0 เสร็จแล้ว (เอกสาร ER/DFD/สถาปัตยกรรม)

```
วัน 1  P1 ฐานข้อมูล → P2 Auth/RBAC → P3 ลิงก์ + QR
วัน 2  P4 redirect → P5 analytics → P6 frontend
วัน 3  P7 แอดมิน → P9 deploy → P10 README + ซ้อมเดโม   (P8 CLI = ทำถ้ามีเวลา)
```

### P0 — วางแผนและเอกสาร ✅
ER, DFD L0–2, Architecture, PRD นี้

### P1 — โครงโปรเจกต์และฐานข้อมูล (~2 ชม.)
- [ ] สร้าง repo + โครง `services/{core-api,redirect-service,analytics-service}`, `frontend/`, `docs/`
- [ ] `docker-compose.yml`: postgres 16 + redis (service ค่อยเพิ่มทีละ phase)
- [ ] `schema.prisma` + migration `init` ตาม `docs/er-diagram.md` (ใส่ CHECK constraint ใน SQL เอง)
- [ ] seed: จองอีเมลแอดมินจาก `ADMIN_EMAIL`
- [ ] `.env` ที่ root (ไม่ commit; รายการตัวแปรอยู่ใน `README.md`)

**เสร็จเมื่อ:** `prisma migrate dev` ผ่านบน DB เปล่า, ตารางครบ (ปัจจุบัน 7 ตาราง) (ตาม ER), seed ทำงาน  
**Commit:** `chore: scaffold + db schema`

### P2 — core-api: SSO, JWT, RBAC (~4 ชม.)
- [ ] Express bootstrap: JSON body limit, CORS (`FRONTEND_ORIGIN`), cookie-parser, health, rate limit (Redis)
- [ ] SSO Google (OIDC code + PKCE, state/nonce ใน Redis) → `sso_identities`; Microsoft (ถ้ามีเวลา)
- [ ] ออก access 15 นาที + refresh 7 วัน (rotation: `rt:{jti}` GETDEL, `rtnbf:{uid}`, reuse = revoke ทั้งหมด), `/auth/refresh`, `/auth/logout` (blacklist `bl:{jti}`), `/auth/me`
- [ ] `requireAuth` อ่าน role/ban จาก DB ทุก request; `requireRole(...roles)`
- [ ] audit service + บันทึก USER_REGISTER / USER_LOGIN / USER_LOGIN_BLOCKED

**เสร็จเมื่อ:** ล็อกอิน Google ได้จริง, refresh หมุนได้, ใช้ refresh เก่าซ้ำแล้วโดนเตะออก, ban แล้ว request ถัดไปถูกปฏิเสธ  
**Commit:** `feat(core-api): sso + jwt rotation + rbac`

### P3 — core-api: ลิงก์และ QR (~3 ชม.)
- [ ] `POST/GET/PATCH/DELETE /api/links` (เจ้าของเท่านั้น), ค้นหา + แบ่งหน้า
- [ ] ตัวสร้าง short code + alias validator (+ reserved words) + validator URL (SSRF/loop/credentials)
- [ ] เก็บ `original_host`; เช็คโดเมนต้องห้ามตอนสร้าง/แก้
- [ ] เขียน/ล้าง cache `link:{code}` (สัญญากับ redirect-service)
- [ ] `GET /api/links/:id/qr?format=png|svg` (ECC H, margin 4)

**เสร็จเมื่อ:** สร้างลิงก์ผ่าน curl + token ได้, ซ้ำ alias ได้ 409, QR สแกนด้วยมือถือติด  
**Commit:** `feat(core-api): links + qr`

### P4 — redirect-service (~2 ชม.)
- [ ] Express: `GET /:code` → Redis → (miss) SELECT → cache + negative cache → 302 `no-store`
- [ ] สถานะ ACTIVE/หมดอายุ → 404 ข้อความไทย
- [ ] สร้าง click event (`{l,h,ua,r,c,d,o,b,t}`: hash IP, parse UA เป็น device/os/browser, ประเทศ) → `RPUSH clicks:queue` → ping `analytics /internal/flush` แบบ throttle (60 วิ)
- [ ] Dockerfile + เพิ่มใน compose

**เสร็จเมื่อ:** เปิดลิงก์สั้นแล้วเด้งไปปลายทาง, คิว Redis มี event, ปิด analytics แล้ว redirect ยังทำงาน  
**Commit:** `feat(redirect): cached 302 + click queue`

### P5 — analytics-service (~3 ชม.)
- [ ] `POST /internal/flush`: lock `clicks:flush:lock`, LPOP เป็น batch, INSERT `clicks` (unnest) + UPSERT `link_daily_stats` + UPDATE `click_count` ใน transaction เดียว; พังแล้วคืนคิว
- [ ] `GET /internal/links/:id/stats`: flush ก่อน แล้วตอบ daily / referer / country / device / os / browser
- [ ] ลบคลิกเกิน retention (ทีละก้อน ≤ ชั่วโมงละครั้ง)
- [ ] `x-internal-key` (timingSafeEqual)
- [ ] core-api: `GET /api/links/:id/stats` เรียก analytics (timeout ยาวรองรับ cold start, ล่มแล้วตอบ `unavailable: true`)

**เสร็จเมื่อ:** คลิก 3 ครั้งจากอุปกรณ์ต่างกันแล้วหน้าสถิติเห็นยอดและสัดส่วนถูกต้อง, `click_count` ตรง  
**Commit:** `feat(analytics): batch flush + stats`

### P6 — Frontend (~4 ชม.)
- [ ] Next.js 14 + Tailwind; `lib/api.ts` (access token ใน memory, refresh อัตโนมัติเมื่อ 401), `AuthProvider`
- [ ] หน้า login: ปุ่ม SSO ตาม `/auth/sso/providers` + แสดง `sso_error`
- [ ] หน้า dashboard: ฟอร์มย่อลิงก์ (alias, วันหมดอายุ), ตารางลิงก์, คัดลอก, เปิด/ปิด/ลบ, modal QR (PNG/SVG), modal สถิติ (กราฟแท่ง + ตารางสัดส่วน)
- [ ] Header + guard เปลี่ยนหน้าเมื่อไม่ล็อกอิน

**เสร็จเมื่อ:** ใช้งานครบวงจรบนเครื่อง: ล็อกอิน → ย่อลิงก์ → คลิก → เห็นสถิติ  
**Commit:** `feat(frontend): login + dashboard`

### P7 — แอดมิน, RBAC, audit, บล็อกโดเมน (~3 ชม.)
- [x] API `/api/admin/*`: stats, users (list/ban/role), links (list/status), blocked-domains (CRUD + **ปิดลิงก์เดิมอัตโนมัติ** ผ่าน `original_host`), audit-logs (กรอง action)
- [x] เมทริกซ์สิทธิ์: MODERATOR ทำ overview/links/domains; ADMIN ทำเพิ่ม users/audit (API 403 + ซ่อนแท็บ)
- [x] หน้า `/admin`: แท็บ ภาพรวม / ผู้ใช้ (เลือกบทบาท) / ลิงก์ / โดเมนที่บล็อก (แจ้งจำนวนลิงก์ที่ถูกปิด) / บันทึกกิจกรรม; ซ่อนแท็บตามบทบาท
- [x] audit ครบทุก action ใน PRD ข้อ ADM-4

**เสร็จเมื่อ:** บล็อก `example.org` แล้วลิงก์เก่าของโดเมนนั้นเปิดไม่ได้ทันที + มี log; MODERATOR เข้าแท็บผู้ใช้ไม่ได้ (UI และ API 403)  
**Commit:** `feat(admin): users, rbac, audit, blocked domains`

### P8 — ยกเลิก
ตัดฟีเจอร์ API key ออก (ตาราง `api_keys`, `/api/keys`, การล็อกอินด้วย `surl_…`, คำสั่ง CLI ที่ใช้ key) — เหลือ CLI เฉพาะ `surl dev/status/migrate` สำหรับรันโปรเจกต์ (migration `remove_api_keys`)

### P9 — Deploy ฟรี (~3 ชม.)
- [ ] สร้างบัญชี Neon / Upstash / Render (Cloudflare ใช้บัญชีเดิม); DNS `s.` `api.` บน Cloudflare (DNS-only ชี้ Render), `shorturl.` ผูกเป็น custom domain ของ Cloudflare Pages
- [ ] OAuth redirect URI = `https://api.kittametdev.com/api/auth/sso/google/callback`
- [x] `render.yaml` 3 service + Dockerfile ของ core-api (migrate ตอนสตาร์ท; `SEED_ON_START=true` ครั้งแรก แล้วปิด) + `frontend/public/_headers`
- [ ] ตั้ง env ให้ตรงกัน: `INTERNAL_API_KEY`, `DATABASE_URL`, `REDIS_URL` ทั้ง 3 service; `COOKIE_DOMAIN=.kittametdev.com`, `COOKIE_SECURE=true`
- [ ] Cloudflare Pages: เชื่อม GitHub, build `npm run build` (static export, output `out/`), ตั้ง `NEXT_PUBLIC_API_URL` (ฝังตอน build)
- [x] เช็คลิสต์ใน `docs/deploy-render.md` (เขียนแล้ว; ขั้นที่ต้องใช้บัญชีของเจ้าของโปรเจกต์ยังไม่ได้ลงมือ)

**เสร็จเมื่อ:** บนโดเมนจริง ล็อกอิน Google → ย่อลิงก์ → เปิด `s.…/code` เด้งได้ → ดูสถิติได้ → refresh หน้าแล้วยังล็อกอินอยู่  
**Commit:** `chore: deploy config`

### P10 — README, บัญชีทดสอบ, ซ้อมเดโม (~2 ชม.)
- [ ] README: ภาพรวม, สถาปัตยกรรม, ติดตั้ง/รัน (docker compose), env, URL ออนไลน์, **บัญชีเดโม** (อีเมล/รหัสผ่านจาก `DEMO_ADMIN_*`, role ADMIN) + บัญชี Google สำรอง, ลิงก์ ER/DFD, ข้อจำกัดที่รู้ (cold start, free tier)
- [ ] ตรวจ `docs/*` ให้ตรงกับโค้ดจริง (ER/API/DFD)
- [ ] ปลุกทุก service ก่อนเดโม (เปิด `/health` ของ 3 service)
- [ ] ซ้อมสคริปต์เดโม (ข้อ 8)

**Commit:** `docs: readme + final`

---

## 8. สคริปต์เดโม Video Call (≤ 30 นาที)

| นาที | เรื่อง |
|---|---|
| 0–3 | ปัญหา/เป้าหมาย และสิ่งที่เลือกทำพิเศษ (micro service, SSO, RBAC) |
| 3–8 | Architecture Diagram + เหตุผลแยก 3 service + ทำไม redirect ไม่เขียน DB ใน request path |
| 8–12 | DFD L0 → L1 และ ER (อธิบาย `sso_identities`, `link_daily_stats`, `original_host`) |
| 12–20 | เดโมสด: ล็อกอิน → ย่อลิงก์ → QR → เปิดลิงก์ → สถิติ (อุปกรณ์/ประเทศ) |
| 20–25 | แอดมิน: บล็อกโดเมน (ปิดลิงก์เดิมทันที), เปลี่ยนบทบาท, audit log; CLI (ถ้ามี) |
| 25–30 | ข้อจำกัด/สิ่งที่จะทำต่อ (Safe Browsing, 2FA แอดมิน, test/CI) + ถาม–ตอบ |

คำถามที่ควรเตรียมคำตอบ: ทำไมใช้ 302 ไม่ใช่ 301 · refresh token rotation กันการขโมยยังไง · ทำไมไม่เก็บ refresh token ใน DB · ทำไมแยก `sso_identities` · ถ้า traffic โตจะปรับอะไร (partition `clicks`, read replica, ย้าย Redis queue เป็น Kafka/SQS)

## 9. ความเสี่ยงและทางลด

| ความเสี่ยง | ผลกระทบ | ทางลด |
|---|---|---|
| ตั้งค่า OAuth/โดเมน ใช้เวลานาน | บล็อกการทดสอบ SSO | ทำ Google Cloud Console + redirect URI ตั้งแต่ P1 (ใช้ `localhost` ก่อน) |
| Render free หลับ → เดโมช้า | ผู้ชมเห็นหน้าค้าง | ปลุก 3 service ก่อนเริ่ม; บอกกรรมการใน README |
| Microsoft ถูกบล็อก consent | ใช้ไม่ได้ | ทำ Google ก่อน Microsoft เป็นของแถม (AUTH-2 = S) |
| เวลาไม่พอ | ส่งไม่ครบ | ตัด P8 ก่อน, แล้ว Microsoft, แล้วหน้าภาพรวมแอดมิน — **P1–P7 + P9 + P10 คือแกนที่ต้องเสร็จ** |
| Upstash เกินโควตา | redirect/คิวล้ม | ไม่มี polling/cron; flush เฉพาะเมื่อมีคลิก; ตรวจ dashboard Upstash |
| บัญชี Google ทดสอบโดนขอยืนยันตัวตน | กรรมการเข้าไม่ได้ | ทดสอบล็อกอินจากเครื่อง/เบราว์เซอร์ใหม่ก่อนส่ง; แนบวิดีโอสาธิตสำรอง |
| Prisma migrate เจอ drift | deploy พัง | รัน `migrate dev` บนเครื่องก่อน push ทุกครั้ง; อย่าแก้ migration ที่ apply แล้ว |

## 10. Definition of Done (ทั้งโปรเจกต์)

- [ ] ทุก service รันด้วย `docker compose up --build` จาก clone ใหม่
- [ ] บนโดเมนจริง: ล็อกอิน → ย่อลิงก์ → คลิก → สถิติ → QR ทำงานครบ
- [ ] RBAC ทดสอบแล้วทั้ง 3 บทบาท (UI + API)
- [ ] ER/DFD/Architecture ตรงกับโค้ดจริง
- [ ] README มี URL, บัญชีทดสอบ, วิธีติดตั้ง, ข้อจำกัด
- [ ] ไม่มี secret ใน git (`.env` อยู่ใน `.gitignore`)
