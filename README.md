# Short URL By Kittamet

ระบบย่อลิงก์ ย่อได้ทุกลิงก์ สร้าง QR Code ดูประวัติและสถิติการคลิก พร้อมหน้าจัดการสำหรับแอดมิน

แยกเป็น **Micro Service 3 ตัว** (core-api / redirect-service / analytics-service) ใช้ Next.js (static export) เป็น Frontend, Express + TypeScript เป็น Backend, PostgreSQL 16 เป็นฐานข้อมูล และ Redis เป็น cache/คิว

## สถานะการพัฒนา

| Phase | งาน | สถานะ |
|---|---|---|
| P0 | ER, DFD, Architecture Diagram, PRD | เสร็จ |
| P1 | โครงโปรเจกต์ + ฐานข้อมูล (Prisma schema, migration, seed) | เสร็จ |
| P2 | core-api: SSO, JWT + refresh rotation, RBAC, audit, บัญชีเดโม | เสร็จ (ยังไม่ได้ทดสอบกับ Google จริง) |
| P3 | ลิงก์ + QR (core-api: สร้าง/ค้นหา/แก้/ลบ, alias, ตรวจ URL, โดเมนต้องห้าม, QR PNG/SVG) | เสร็จ |
| P4 | redirect-service (`GET /:code` → 302, cache Redis, เข้าคิวคลิก) | เสร็จ |
| P5 | analytics-service (flush คิวคลิกลง DB เป็นชุด, สถิติ) + `GET /api/links/:id/stats` | เสร็จ |
| P6 | Frontend (Next.js): เข้าสู่ระบบ (หน้าต่างเด้ง), ย่อลิงก์ (ไม่ล็อกอินได้แบบลิงก์สั้น 7 วัน), รายการ/ค้นหา, QR ปรับแต่งได้, สถิติ, แก้ไข/ปิด/ลบ, หน้าฟีเจอร์/รูปแบบบัญชี | เสร็จ |
| P7 | แอดมิน `/admin` (ภาพรวม / ผู้ใช้ / ลิงก์ทั้งหมด / โดเมนที่บล็อก / audit log) — MODERATOR ใช้ภาพรวม/ลิงก์/โดเมน, ADMIN ใช้ได้ทั้งหมด | เสร็จ |
| P8 | API key + CLI สำหรับจัดการลิงก์ (`surl login/shorten/ls/...`) | โค้ดฝั่ง API/CLI มีอยู่ แต่ **ปิดหน้าเว็บสร้างรหัสไว้** (ถอนหน้า `/keys` และเมนูออกตามที่เลือก) |
| P9 | Deploy: `render.yaml` + Dockerfile ครบ 3 service + คู่มือ (`docs/deploy-render.md`) | เตรียมไฟล์เสร็จ — ขั้นสมัครบัญชี/ใส่ค่าลับ/ผูกโดเมนต้องทำเอง |
| P10 | README ฉบับสมบูรณ์ + ซ้อมเดโม | ยังไม่ทำ |

แผนละเอียดและเกณฑ์ตรวจรับอยู่ที่ [`docs/prd.md`](docs/prd.md)

## ฟังก์ชัน

- เข้าสู่ระบบด้วย **Google (OIDC, PKCE)** ในหน้าต่างเด้ง (modal) ไม่ต้องเปลี่ยนหน้า — ฝั่ง backend รองรับ Microsoft ด้วย แต่ยังไม่เปิดปุ่มบนหน้าเว็บ ไม่มีสมัครด้วยรหัสผ่าน
- Access token (JWT 15 นาที) เก็บในหน่วยความจำฝั่ง client + Refresh token (7 วัน, httpOnly cookie) หมุนทุกครั้ง ใช้ token เก่าซ้ำจะถูกเตะออกทุกอุปกรณ์
- **ย่อลิงก์ได้โดยไม่ล็อกอิน** (`POST /api/guest/links`): ได้แค่ลิงก์สั้น ใช้ได้ 7 วัน ไม่มี QR/สถิติ/ประวัติ — ล็อกอินแล้วได้ครบ
- สร้างลิงก์สั้นแบบสุ่ม หรือกำหนด alias เอง พร้อมวันหมดอายุ
- ตรวจ URL กัน SSRF / redirect loop / ลิงก์ชี้ host ภายใน
- Redirect แบบ 302 ผ่าน Redis cache (ไม่แตะฐานข้อมูลเมื่อมี cache) และเก็บคลิกผ่านคิว ไม่เขียน DB ใน request path
- **QR Code ปรับแต่งได้** ต่อลิงก์: ลายจุด 5 แบบ, ตา 3 แบบ, สี/ไล่เฉด/พื้นโปร่งใส, โลโก้กลาง (สำเร็จรูปหรืออัปโหลดในเบราว์เซอร์), ข้อความใต้ QR (ป้าย/แถบ/ตัวอักษร), ตัวอย่างสด, สไตล์สำเร็จรูป, เตือนเมื่อสีสแกนยาก, บันทึกสไตล์ไว้กับลิงก์, ดาวน์โหลด PNG (512/1024/2048) และ SVG — ทุกลายทดสอบสแกนด้วย jsQR ผ่าน
- **ป้องกันลิงก์** (ตั้งต่อลิงก์ ไม่บังคับ): รหัสผ่าน (หน้ากรอกรหัส, เก็บเป็น scrypt hash, ลองผิดเกิน 5 ครั้ง/10 นาทีถูกล็อก) · จำกัดจำนวนครั้งที่เปิดได้ (นับแบบ atomic ใน Redis เปิดพร้อมกันก็ไม่เกิน) · วันเริ่มใช้งาน — ดูกติกาใน `docs/api.md`
- สถิติการคลิก: กราฟรายวัน 30 วัน, อุปกรณ์ (มือถือ/คอมพิวเตอร์/แท็บเล็ต/บอท) / ระบบปฏิบัติการ / เบราว์เซอร์ / ประเทศ (เก็บ IP แบบ hash เท่านั้น; ระบบยังเก็บ referer ไว้ แต่ไม่แสดงในหน้าสถิติ) — **ประเทศแสดงได้เมื่อรันหลัง Cloudflare** (`BEHIND_CLOUDFLARE=true`, อ่านจาก `CF-IPCountry`) ตอนรันในเครื่องจะเป็น "ไม่ทราบ"
- แอดมิน `/admin` (sidebar พับได้, ตารางข้อมูลพร้อม **ตัวกรอง/เรียง/ช่วงเวลา** และ **แบ่งหน้า** (เลขหน้า, ต่อหน้า 10–100), กดแถวดูรายละเอียดเต็ม (ลิงก์มีแท็บสถิติ), action เป็นไอคอน + modal ยืนยัน): ภาพรวม, ผู้ใช้และบทบาท (USER / MODERATOR / ADMIN), ลิงก์ทั้งหมด (+ ดูสถิติของลิงก์ใดก็ได้), **โดเมนที่บล็อก** (แสดงผลกระทบก่อนบล็อก และปิดลิงก์เดิมที่ชี้โดเมนนั้นอัตโนมัติ), audit log — MODERATOR ใช้ได้เฉพาะภาพรวม/ลิงก์/โดเมน
- ล็อกอินแล้วผู้ดูแลถูกพาเข้า `/admin` ส่วนผู้ใช้ทั่วไปเข้า `/dashboard`; หน้าเว็บรองรับไทย/อังกฤษ และธีมสว่าง/มืด
- CLI และ API key (ถ้ามีเวลา)

## สถาปัตยกรรม

| Service | หน้าที่ | Stack | Port (dev) |
|---|---|---|---|
| `frontend` | หน้าเว็บ dashboard / admin | Next.js 14, React 18, Tailwind 3 | 3000 |
| `services/core-api` | SSO, JWT, ลิงก์, QR, แอดมิน | Express 5 + Prisma 5 | 4000 |
| `services/redirect-service` | `GET /:code` → 302, ส่งคลิกเข้าคิว | Express + ioredis + pg | 4001 |
| `services/analytics-service` | เขียนคลิกลง DB เป็นชุด, สถิติ (internal) | Express + ioredis + pg | 4002 |
| PostgreSQL 16 | ข้อมูลหลัก ใช้ร่วมกันทุก service | — | 5442 (docker) |
| Redis 7 | cache ลิงก์, คิวคลิก, สถานะ refresh token, rate limit | — | 6380 (docker) |

ไดอะแกรม (เปิดดูและแก้ไขได้ที่ [`docs/diagrams.html`](docs/diagrams.html)):

- Architecture · DFD Level 0 / 1 / 2 → [`docs/dfd.md`](docs/dfd.md), [`docs/img/`](docs/img)
- ER Diagram → [`docs/er-diagram.md`](docs/er-diagram.md)
- API → [`docs/api.md`](docs/api.md)

## สิ่งที่ต้องเตรียม

- Node.js 20 ขึ้นไป พร้อม npm
- Docker (สำหรับ PostgreSQL และ Redis ตอนพัฒนา)
- Google OAuth client (ถ้าจะทดสอบล็อกอินด้วย Google) — สร้างที่ Google Cloud Console แล้วตั้ง Authorized redirect URI เป็น `http://localhost:4000/api/auth/sso/google/callback`

## ติดตั้งและรันในเครื่อง

ตอนนี้รันได้ทั้งระบบ (P1–P7): เปิด http://localhost:3000 → ย่อลิงก์ (ไม่ล็อกอินก็ได้) → เข้าสู่ระบบ → กดลิงก์สั้น → ปรับแต่ง QR และดูสถิติ → (บัญชีแอดมิน) หน้า `/admin`

```bash
git clone <repo-url> && cd Shorturl

# 1) ฐานข้อมูลและ Redis
docker compose up -d

# 2) สร้างไฟล์ .env ที่ root ตามตารางด้านล่าง (ไฟล์นี้ไม่ถูก commit)

# 3) core-api
cd services/core-api
npm install
npx prisma migrate deploy     # สร้างตาราง
npx prisma db seed            # จองแอดมินคนแรก + สร้างบัญชีเดโม
npm run start:dev             # http://localhost:4000/api/health
```

### รันด้วย `surl dev` (CLI)

มี CLI สำหรับรันทั้งโปรเจกต์ (ไม่มี dependency ใช้ Node 18+) — เปิดเมนูให้เลือก service หรือรันทั้งหมด:

```bash
npm link                      # ครั้งเดียว ที่ root เพื่อให้เรียก `surl` ได้ทุกที่ (หรือใช้ `npm run dev` / `node cli/surl.mjs dev` แทนก็ได้)

surl dev                      # เมนู: ↑↓ เลื่อน, เว้นวรรค เลือก/ยกเลิก, a ทั้งหมด, Enter เริ่ม, q ออก
surl dev all                  # รันทุก service ที่มีโค้ดแล้ว ไม่ถามเมนู
surl dev core-api frontend    # รันเฉพาะที่ระบุ (ชื่อย่อ: db, core, redirect, analytics, web)
surl status                   # ดูว่า port ไหนเปิดอยู่
surl migrate                  # prisma migrate deploy ด้วยค่าจาก .env
```

`surl dev` จะ: เปิด PostgreSQL + Redis ผ่าน docker compose และรอจนพร้อม → `npm install` ให้ถ้ายังไม่มี `node_modules` → `prisma migrate deploy` (ข้ามด้วยคำท้าย `nomigrate`) → เริ่ม service ที่เลือกพร้อมกัน โดยแสดง log แยกสีตามชื่อ service ส่งค่าจาก `.env` ให้ทุกตัว ข้าม service ที่ port ถูกใช้อยู่แล้ว กด **Ctrl+C** เพื่อปิดทั้งหมด (ใส่คำท้าย `down` ถ้าต้องการให้หยุด docker ด้วย เช่น `surl dev all down`; ค่าเริ่มต้นปล่อยรันต่อ)

เมนูจะแสดงเฉพาะ service ที่มีโค้ดแล้ว ตอนนี้คือ infra, core-api, redirect-service, analytics-service และ frontend

สร้างค่า secret (รันแยกกันทีละค่า ให้ได้คนละค่า):

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

### CLI จัดการลิงก์ (`surl`)

> ตอนนี้ **ไม่มีหน้าเว็บสร้างรหัส API** (ถอนออกแล้ว; กู้หน้า `/keys` ได้จาก git) CLI ด้านล่างจึงใช้ได้เมื่อมีรหัสที่สร้างผ่าน `POST /api/keys` (ต้องใช้ session ล็อกอิน) เท่านั้น

รหัส API ใช้กับ CLI ดังนี้:

```bash
npm link                                  # ครั้งเดียวที่ root ของโปรเจกต์ → ได้คำสั่ง surl (หรือใช้ node cli/surl.mjs แทน)
surl login --token surl_… [--api https://api.<โดเมน>]   # ไม่ใส่ --api = http://localhost:4000
surl shorten https://example.com/long --alias promo --expires 7d --max 100 --password รหัส
surl ls [-q คำค้น]      surl stats <code>      surl qr <code> -o qr.png
surl off|on <code>      surl rm <code> -y      surl whoami / logout / config
```

key เก็บในไฟล์ config ของเครื่อง (สิทธิ์ 600) ใช้ตัวแปร `SURL_TOKEN` / `SURL_API` แทนได้ ทุกคำสั่งใส่ `--json` ได้ · key ใช้ได้กับลิงก์ของเจ้าของเท่านั้น ใช้ `/api/admin/*` และจัดการ key เองไม่ได้ · เพิกถอนที่หน้า `/keys` แล้วใช้ไม่ได้ทันที

### Frontend

```bash
cd frontend && npm install && npm run dev      # http://localhost:3000 (หรือ `surl dev frontend`)
npm run build                                  # static export → frontend/dist/ (dev ใช้ .next แยกกัน รันพร้อมกันได้ไม่ชน)
```

ตัวแปรของ frontend (ฝังตอน build; ห้ามใส่ค่าลับ): `NEXT_PUBLIC_API_URL` (ค่าเริ่มต้น `http://localhost:4000`) และ `NEXT_PUBLIC_SHORT_HOST` (โดเมนที่โชว์ในหน้าแรก) — เปลี่ยนแล้วต้อง build ใหม่ ห้ามใช้ dynamic route `[id]` / API route ของ Next เพราะเป็น static export
Access token เก็บใน memory เท่านั้น เมื่อรีเฟรชหน้าจะขอใหม่จาก refresh cookie อัตโนมัติ (รวมคำขอ refresh เป็นครั้งเดียวทั้งในแท็บและข้ามแท็บ เพราะ refresh token ใช้ได้ครั้งเดียว)

หน้าแรก (`/`) มีช่องวางลิงก์ทันที: ถ้ายังไม่ล็อกอิน ระบบจำลิงก์ไว้ใน `sessionStorage` ของเบราว์เซอร์นั้น พาไป `/login` แล้วย่อให้อัตโนมัติหลังเข้าสู่ระบบ (ไม่ส่งข้อมูลไปเซิร์ฟเวอร์จนกว่าจะล็อกอิน)

## ตัวแปรสภาพแวดล้อม (`.env` ที่ root)

ค่าจริงอยู่ใน `.env` เท่านั้น ห้าม commit และห้ามเอาค่าลับใส่ `NEXT_PUBLIC_*`

| ตัวแปร | ใช้ทำอะไร | ค่าตอนพัฒนา |
|---|---|---|
| `DATABASE_URL` | PostgreSQL | `postgresql://shorturl:shorturl@localhost:5442/shorturl` |
| `REDIS_URL` | Redis (production ใช้ `rediss://`) | `redis://localhost:6380` |
| `JWT_ACCESS_SECRET` | เซ็น access token | สุ่ม ≥ 32 ตัวอักษร |
| `JWT_REFRESH_SECRET` | เซ็น refresh token | สุ่ม ≥ 32 ตัวอักษร คนละค่ากับ access |
| `ADMIN_EMAIL` | อีเมล Google ของแอดมินคนแรก (seed จองไว้ ผูกบัญชีตอนล็อกอินครั้งแรก) | อีเมลของคุณ |
| `DEMO_ADMIN_EMAIL` | อีเมลบัญชีเดโมสำหรับกรรมการ | เช่น `admin@demo.local` |
| `DEMO_ADMIN_PASSWORD` | รหัสผ่านบัญชีเดโม ≥ 8 ตัว — เว้นว่าง = ปิดการล็อกอินด้วยรหัสผ่าน | ตั้งเอง |
| `PUBLIC_BASE_URL` | origin ของลิงก์สั้น / QR (redirect-service) | `http://localhost:4001` |
| `API_BASE_URL` | origin ของ core-api (ใช้เป็น SSO redirect URI) | `http://localhost:4000` |
| `FRONTEND_ORIGIN` | origin ของหน้าเว็บ (CORS + หน้าปลายทางหลังล็อกอิน) | `http://localhost:3000` |
| `COOKIE_SECURE` | ตั้ง `true` บน HTTPS | `false` |
| `COOKIE_DOMAIN` | โดเมนของ refresh cookie | ว่าง (production: `.kittametdev.com`) |
| `BEHIND_CLOUDFLARE` | อ่าน IP จาก `CF-Connecting-IP` | `false` |
| `SHORT_CODE_LENGTH` | ความยาว short code เริ่มต้น | `5` |
| `IP_HASH_SALT` | salt ของ hash IP | สุ่ม |
| `CLICK_RETENTION_DAYS` | เก็บคลิกดิบกี่วัน | `90` |
| `CLICK_FLUSH_SECONDS` | ช่วงห่างขั้นต่ำของการ flush คิวคลิก | `60` |
| `INTERNAL_API_KEY` | key ที่ service ใช้เรียกกัน (header `x-internal-key`) | สุ่ม |
| `ANALYTICS_URL` | URL ของ analytics-service | `http://localhost:4002` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | เปิดล็อกอิน Google (ว่าง = ปิด) | จาก Google Cloud Console |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT` | เปิดล็อกอิน Microsoft (ว่าง = ปิด) | tenant ปกติ `common` |
| `SEED_ON_START` | Render: `true` ครั้งแรกเพื่อ seed แล้วปิด | `false` |

## บัญชีสำหรับทดสอบ

ผู้ใช้ทั่วไปเข้าด้วย Google / Microsoft เท่านั้น ระบบไม่เก็บรหัสผ่านของผู้ใช้ในฐานข้อมูล

สำหรับกรรมการมี **บัญชีเดโม (บทบาท ADMIN)** ที่ล็อกอินด้วยอีเมล + รหัสผ่านได้ ค่านี้ตั้งใน `.env` (`DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD`) และเทียบกับ env โดยตรงตอนล็อกอิน ไม่มีรหัสผ่านหรือ hash อยู่ในฐานข้อมูล

```http
POST /api/auth/login
{ "email": "<DEMO_ADMIN_EMAIL>", "password": "<DEMO_ADMIN_PASSWORD>" }
```

อีเมลและรหัสผ่านของระบบออนไลน์ส่งให้ผู้ตรวจแยกต่างหาก ไม่ได้เขียนไว้ใน repo นี้ ถ้าไม่ต้องการให้มีบัญชีนี้ ให้เว้น `DEMO_ADMIN_PASSWORD` ว่าง

## ฐานข้อมูล

Prisma เป็นตัวจัดการ schema (`services/core-api/prisma/`)

- แก้ `schema.prisma` ต้องสร้าง migration ใหม่ทุกครั้ง: `npx prisma migrate dev --name <ชื่อ>` และห้ามแก้ migration ที่ apply แล้ว
- Prisma เขียน CHECK constraint ไม่ได้ จึงเขียนไว้ใน `migration.sql` เอง (อีเมล/โดเมนต้องเป็นตัวพิมพ์เล็ก ฯลฯ) ดูรายการใน [`docs/er-diagram.md`](docs/er-diagram.md)
- Production ใช้ `npx prisma migrate deploy`
- ตอนนี้มี 8 ตาราง: `users`, `sso_identities`, `api_keys`, `links`, `clicks`, `link_daily_stats`, `blocked_domains`, `audit_logs`

## Deploy (ฟรี ไม่ผูกบัตร)

| Hostname | ไปที่ | ใช้ทำ |
|---|---|---|
| `shorturl.kittametdev.com` | Cloudflare Pages | หน้าเว็บ |
| `api.kittametdev.com` | Render (core-api) | `/api/*` |
| `s.kittametdev.com` | Render (redirect-service) | ลิงก์สั้น `/:code` |

ขั้นตอน deploy ทีละขั้นและเช็กลิสต์หลัง deploy อยู่ที่ [`docs/deploy-render.md`](docs/deploy-render.md) (มี `render.yaml` + Dockerfile ของทั้ง 3 service ให้แล้ว)

ฐานข้อมูลใช้ Neon (Postgres) และ Redis ใช้ Upstash; DNS อยู่ที่ Cloudflare ตั้ง `COOKIE_DOMAIN=.kittametdev.com` เพื่อให้หน้าเว็บกับ API อยู่ site เดียวกัน refresh cookie (SameSite=Lax) จึงถูกส่ง

ข้อสังเกต: Render free แต่ละ service หลับแยกกันหลังว่างราว 15 นาที ปลุกใช้เวลา 30–50 วินาที Frontend ถูก build เป็น static export จึงไม่มี server ฝั่ง Next.js และ `NEXT_PUBLIC_API_URL` ถูกฝังตอน build (เปลี่ยนแล้วต้อง build ใหม่)

## ทดสอบและ CI

ทุก push/PR รัน GitHub Actions (typecheck · build · **unit + integration test ≈ 426 ข้อ** บน Postgres/Redis จริง · build Docker · ตรวจช่องโหว่/ค่าลับหลุด · CodeQL) — รายละเอียด วิธีรันในเครื่อง และการตั้ง branch protection อยู่ที่ [`docs/ci.md`](docs/ci.md)

```bash
cd services/core-api && npm test      # เช่นเดียวกับ redirect-service, analytics-service, frontend
./scripts/check-repo.sh               # ตรวจค่าลับหลุด/config ก่อน commit
```

## โครงสร้างโฟลเดอร์

```
services/
  core-api/               Express + Prisma
    prisma/               schema, migrations, seed
    src/
      auth/               SSO, JWT, middleware (requireAuth / requireRole), routes
      audit/              บันทึก audit log
      links/              CRUD ลิงก์ + cache `link:{code}`
      qr/                 สร้าง QR (PNG/SVG)
      common/             config, error handler, rate limit
      prisma/ redis/      client
      app.ts main.ts      สร้าง express app / เปิดพอร์ต
    scripts/start-prod.sh migrate → (seed) → เปิดเซิร์ฟเวอร์ ใช้ใน Docker/Render
    Dockerfile
  redirect-service/       Express: GET /:code → 302 (Redis cache → DB), ส่งคลิกเข้าคิว
    src/                  app.ts clicks.ts ua.ts db.ts redis.ts pages.ts config.ts index.ts
    Dockerfile
  analytics-service/      Express: flush คิวคลิกลง DB (transaction เดียว), สถิติ, ลบคลิกเก่า (internal เท่านั้น)
    src/                  flush.ts stats.ts events.ts auth.ts app.ts db.ts redis.ts config.ts index.ts
    Dockerfile
frontend/                 Next.js 14 (static export) + Tailwind
  app/                    หน้า: / (ย่อลิงก์), /features, /plans, /login (เปิดหน้าต่างล็อกอิน), /dashboard, /admin
  components/             ฟอร์มย่อลิงก์, แถบผลลัพธ์, แถวลิงก์, dialog (QR / สถิติ / แก้ไข / ลบ), กราฟ
  lib/                    api.ts (access token ใน memory + refresh แบบ single-flight), auth.tsx, format.ts
cli/surl.mjs             CLI (`surl dev/status/migrate` สำหรับพัฒนา · `surl login/shorten/ls/stats/qr/on/off/rm` ใช้กับ API key)
render.yaml              Render Blueprint (3 service) — ดู docs/deploy-render.md
package.json              (root) ลงทะเบียนคำสั่ง `surl` + `npm run dev`
docs/                     prd, er-diagram, dfd, api, deploy-render, ci, diagrams.html, img/
.github/                 workflows (ci, codeql), dependabot, CODEOWNERS
scripts/check-repo.sh     ตรวจค่าลับหลุด/config (ใช้ใน CI)
docker-compose.yml        PostgreSQL + Redis สำหรับพัฒนา (เพิ่ม service แอปด้วย `docker compose --profile full up --build`)
```

## ข้อจำกัดที่ต้องรู้

- Render free หลับเมื่อว่าง ครั้งแรกที่เปิดอาจช้า 30–50 วินาที
- Google อาจขอยืนยันตัวตนเพิ่มเมื่อล็อกอินจากเครื่องใหม่ จึงมีบัญชีเดโมเป็นทางสำรอง
- Microsoft tenant ขององค์กรบางแห่งบล็อกการยินยอมของแอปภายนอก และ Microsoft ไม่รับรองอีเมล จึงไม่ผูกกับบัญชีเดิมอัตโนมัติ
- ยอดคลิกอัปเดตเป็นชุดตามรอบ flush (ปกติไม่เกิน 60 วินาที) ไม่ใช่ทันทีทุกคลิก
- เอกสารยังไม่ใช่หลักฐานว่า production ผ่านทุกกรณี ต้องทดสอบบนระบบออนไลน์จริงก่อนส่งงาน

## ก่อนนำขึ้น Git

- `.env`, `node_modules`, `dist`, `.next` ถูกยกเว้นด้วย `.gitignore` ตรวจ `git status --short` ก่อน push ทุกครั้ง
- ถ้าไฟล์ลับเคยถูก track มาก่อน การเพิ่มใน `.gitignore` ไม่ได้ลบออกจากประวัติ
