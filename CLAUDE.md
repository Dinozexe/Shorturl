# CLAUDE.md

บริบทของโปรเจกต์นี้สำหรับ Claude Code — อ่านก่อนแก้โค้ดหรือ deploy

## โปรเจกต์คืออะไร

ระบบย่อลิงก์ (short URL) สำหรับทุกคน — ย่อได้ทุกลิงก์ (http/https ที่เข้าถึงได้จากภายนอก) ไม่จำกัดกลุ่มผู้ใช้หรือองค์กร ฟีเจอร์: ล็อกอินด้วย SSO เท่านั้น (ไม่มีรหัสผ่าน; JWT + refresh), API key สำหรับ CLI (`cli/`), สร้างลิงก์พร้อม alias และวันหมดอายุ, redirect ผ่าน Redis cache, QR Code, สถิติการคลิก, หน้า Admin (ผู้ใช้ / ลิงก์ / โดเมนต้องห้าม / audit log) งานส่งคือ ER Diagram + DFD (อยู่ใน `docs/`) และต้อง deploy ขึ้นเซิร์ฟเวอร์จริงทั้ง frontend / backend / DB

**บริบทงาน:** โปรเจกต์นี้คือข้อสอบ Developer ของ Synnerry (Node.js/React/Vue/PHP; DB: MySQL/MSSQL/PostgreSQL/MongoDB; ส่ง repo + README ติดตั้ง + URL ทดสอบ + user/password ภายใน 3 วัน แล้ว Video Call ≤ 30 นาที) เกณฑ์: DFD Level 0, ER, สร้าง Short URL แล้วคลิกได้จริง, QR Code, ประวัติ + สถิติคลิก, ไอเดียเพิ่มเติม; ทำเป็น **Micro Service + Architecture Diagram** จะพิจารณาเป็นพิเศษ → เจ้าของเลือกแยก 3 service และ **ต้องล็อกอินก่อนสร้างลิงก์ (ไม่ทำ guest)** โดยใช้ SSO เป็นทางหลัก

## Stack

- **Micro service (Node 20):** `services/core-api` (Express 5 + Prisma 5 + TypeScript), `services/redirect-service` และ `services/analytics-service` (Express + pg + ioredis); PostgreSQL 16 ตัวเดียวร่วมกัน + Redis
- **Frontend:** Next.js 14 (App Router), React 18, Tailwind 3 (`frontend/`) — build เป็น static export (`output: 'export'`) เพราะเป็น client-side ล้วน; ห้ามใช้ dynamic route `[id]` ให้ใช้ query string แทน
- **Infra:** Docker (dev ด้วย docker compose), Render + Neon + Upstash + Cloudflare Pages (prod ฟรี)
- **เป้าหมาย deploy:** Render (3 service, free) + Neon (Postgres) + Upstash (Redis) + Cloudflare Pages (frontend), โดเมน `kittametdev.com` ผ่าน Cloudflare DNS → `docs/deploy-render.md`, `render.yaml`
- **SSO:** OIDC Google + Microsoft (`auth/sso.service.ts`) — เปิดด้วย env `GOOGLE_*` / `MICROSOFT_*`

## โครงสร้าง

```
services/core-api/src/{auth,audit,links,qr,admin,redis,prisma,common}  (app.ts = สร้าง express app, main.ts = listen)   (+ prisma/{schema,migrations,seed})
services/redirect-service/src/index.ts     GET /:code → 302, เข้าคิวคลิก
services/analytics-service/src/index.ts    flush คิว → clicks, สถิติ (internal)
frontend/app/{page,login,dashboard,keys,admin}  cli/surl.mjs (CLI)  frontend/lib/{api.ts,auth.tsx}
docs/{prd,er-diagram,dfd,architecture,api,deploy-render}.md   docs/diagrams.html (ดู/แก้ไดอะแกรมทั้งหมด)
render.yaml               Render Blueprint (3 service)
docker-compose.yml        dev ทั้งชุด (hot reload)
```

## คำสั่งที่ใช้บ่อย

```bash
cp .env.example .env                     # ครั้งแรก แล้วแก้ secret
docker compose up --build                # dev ทั้งชุด (frontend :3000, core-api :4000, redirect :4001, analytics :4002)

cd services/core-api
npm run build                            # tsc (dev: npm run start:dev)
npx prisma migrate dev --name <ชื่อ>     # แก้ schema แล้วสร้าง migration
npx prisma migrate deploy                # apply migration (prod)
npx prisma db seed                       # จองอีเมลแอดมินคนแรกจาก ADMIN_EMAIL (ไม่มีรหัสผ่าน; ล็อกอิน Google ครั้งแรกแล้วผูกบัญชี)
cd ../../frontend && npm run build          # next build (ตรวจ type ด้วย)
```

## กฎสถาปัตยกรรม (อย่าทำลาย)

1. **Redirect ต้องเร็วและไม่แตะ DB ถ้ามี cache:** `GET /:code` → Redis `link:{code}` ก่อน, miss ค่อย query แล้ว cache; ใช้ **302** + `Cache-Control: no-store` (ห้าม 301 เพราะ browser cache ทำให้นับคลิกไม่ครบ)
2. **ห้ามเขียน `clicks` ใน request path:** `redirect-service` push event เข้า Redis list `clicks:queue` แล้วแจ้ง `analytics-service` (`POST /internal/flush`, ≤ 1 ครั้งต่อ `CLICK_FLUSH_SECONDS`=60 และเฉพาะเมื่อมีคลิก) ให้ batch เขียน DB + เพิ่ม `click_count` (lock `clicks:flush:lock`) — ไม่มี polling/cron เพื่อประหยัดโควตา Upstash 500k คำสั่ง/เดือน และ redirect ต้องไม่เรียก service อื่นแบบรอผลใน request path
3. **Route:** `core-api` router ทุกตัวประกาศ prefix `/api/...` เอง (mount ใน `app.ts`); `/:code` อยู่ที่ `redirect-service` เท่านั้น — cache `link:{code}` (รูปแบบ `{i,u,e}`) เป็นสัญญาระหว่าง core-api (เขียน/ล้าง) กับ redirect-service (อ่าน) ห้ามเปลี่ยนฝั่งเดียว; analytics-service รับเฉพาะ header `x-internal-key`
4. **Alias:** ตรวจ regex + `RESERVED_ALIASES` ใน `common/url-validator.ts` — ถ้าเพิ่ม route ระดับ root ใหม่ ต้องเพิ่มคำนั้นใน reserved ด้วย
5. **Auth:** access token = JWT 15 นาที (client เก็บใน memory); refresh token = JWT อีกตัว (secret แยก `JWT_REFRESH_SECRET`, อายุ 7 วัน, httpOnly cookie path `/api/auth`) **ไม่เก็บใน DB** — สถานะ rotation อยู่ใน Redis: `rt:{jti}` (ใช้ได้ครั้งเดียว, GETDEL ตอนหมุน) และ `rtnbf:{userId}` (epoch ms เทียบกับ claim `iatMs` ของ token — เพิกถอนทุก session); ใช้ token เก่าซ้ำ = เพิกถอนทั้งหมด; logout ลบ `rt:{jti}` + blacklist `bl:{jti}` ของ access token; middleware `requireAuth` เช็ค ban จาก DB ทุก request
6. **SSO อย่างเดียว ห้ามเพิ่มรหัสผ่านกลับ:** ระบุตัวตนด้วย `sso_identities(provider, sub)` ไม่ใช่อีเมล; ผูกข้าม provider/ผูกแอดมินที่ seed ไว้ได้เฉพาะเมื่อ `emailVerified` (Google ใช่, Microsoft ไม่ใช่เว้นแต่ `xms_edov`) และถ้าบัญชีมี identity ที่ยังไม่ยืนยัน ต้องลบ + `revokeAllSessions` (กัน nOAuth); Google ต้อง `email_verified=true`
6.1 **API key (`surl_…`):** เก็บเฉพาะ sha256; `requireAuth` รับทั้ง JWT และ key, ตั้ง `req.user.viaKey=true` → `requireRole`/`sessionOnly` ปฏิเสธ `/api/admin/*` และ `/api/keys` (key สร้าง key ไม่ได้)
7. **ความเป็นส่วนตัว:** เก็บ IP เป็น `sha256(ip + IP_HASH_SALT)` เท่านั้น
8. **สถานะลิงก์:** `ACTIVE` / `DISABLED` (เจ้าของปิด) / `ADMIN_DISABLED` (ผู้ดูแลหรือบล็อกโดเมน — เจ้าของเปิดเองไม่ได้); `links.original_host` ต้องตั้งทุกครั้งที่สร้าง/แก้ URL (ใช้บล็อกโดเมน)
8.1 **ข้อมูลคลิก:** `clicks` ดิบถูกลบเมื่อเกิน `CLICK_RETENTION_DAYS`; กราฟรายวันอ่านจาก `link_daily_stats` (เขียนใน transaction เดียวกับ clicks)
8.2 **audit:** `AuditAction`/`AuditTarget` เป็น enum — เพิ่มชนิดใหม่ต้องแก้ schema + migration + label ใน `frontend/app/admin/page.tsx`
9. **ห้าม** คืนค่า `BigInt` (`clicks.id`) ออก JSON โดยตรง (serialize ไม่ได้)
10. ข้อความ error/UI เป็นภาษาไทย

## โดเมน


โดเมนของเจ้าของโปรเจกต์คือ `kittametdev.com` (อยู่ใน Cloudflare) — **ไม่ซื้อโดเมนเพิ่ม**

| Hostname | ไปที่ | ใช้ทำ |
|---|---|---|
| `s.kittametdev.com` | redirect-service (Render) | ลิงก์สั้น `/:code` (= `PUBLIC_BASE_URL`) — สั้นที่สุดเท่าที่ทำได้ |
| `api.kittametdev.com` | core-api (Render) | `/api/*` (= `API_BASE_URL`, ใช้เป็น SSO redirect URI) |
| `shorturl.kittametdev.com` | frontend (Cloudflare Pages) | dashboard + admin (= `FRONTEND_ORIGIN`) — ถ้าจะเปลี่ยนชื่อ host แก้แค่ `FRONTEND_ORIGIN` + custom domain บน Cloudflare Pages |

`COOKIE_DOMAIN=.kittametdev.com` — ทั้งสอง host อยู่ site เดียวกันเพื่อให้ refresh cookie (SameSite=Lax) ถูกส่งตอนเรียก `/api/auth/refresh`  
ลดความยาวลิงก์ด้วย `SHORT_CODE_LENGTH` (ค่าเริ่มต้น 5; ชนบ่อยจะขยายเองทีละ 1 ตัว) — ถ้าจะย้ายลิงก์ไปรากโดเมน (`kittametdev.com/abc`) ต้องไม่มีหน้าอื่นที่ root และเพิ่มชื่อ path นั้นใน `RESERVED_ALIASES`  
ถ้าวันหน้ามีโดเมนสั้นคนละ site กับ API: cookie refresh (SameSite=Lax) จะไม่ถูกส่ง ต้องให้ API อยู่ site เดียวกับ frontend

## Environment variables

ดูครบใน `.env.example` ที่สำคัญ: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET` (>= 32 ตัวใน production — แอปไม่ยอมสตาร์ทถ้าไม่ผ่าน), `PUBLIC_BASE_URL`, `FRONTEND_ORIGIN`, `BEHIND_CLOUDFLARE`, `COOKIE_SECURE`, `COOKIE_DOMAIN`, `IP_HASH_SALT`, `ADMIN_EMAIL`, `CLICK_RETENTION_DAYS`, `CLICK_FLUSH_SECONDS`, `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET/TENANT`, `SEED_ON_START` (Render), `API_BASE_URL`, `INTERNAL_API_KEY`, `ANALYTICS_URL`  
`NEXT_PUBLIC_API_URL` ถูก **ฝังตอน build** ของ frontend — เปลี่ยนแล้วต้อง build image ใหม่

## สถานะ

เอกสารนี้ + `docs/er-diagram.md` + `docs/dfd.md` (+ `docs/diagrams.html`) คือ **สเปกของระบบ** — เจ้าของโปรเจกต์เป็นคนเขียนโค้ดและ commit เองทีละส่วน ไม่ต้องเขียนโค้ดทั้งระบบให้ ช่วยเฉพาะเมื่อถูกขอ และทำให้ตรงกับสเปกนี้ (โดยเฉพาะ schema ใน `docs/er-diagram.md` และกฎด้านบน)

**ความต้องการและแผนงานแบ่ง Phase (P1–P10) อยู่ที่ `docs/prd.md`** — ทำตามลำดับ phase และ commit เมื่อจบแต่ละ phase; แกนที่ต้องเสร็จคือ P1–P7 + P9 + P10 (P8 CLI/API key ทำถ้ามีเวลา)

## ข้อควรระวัง

- **Render free:** ทั้ง 3 service หลับแยกกันหลังว่าง ~15 นาที (ปลุก 30–50 วิ), 750 ชม./เดือนรวมทั้งบัญชี; ไม่มี shell → migrate/seed รันตอนสตาร์ทผ่าน `dockerCommand`; ใช้ Neon แบบ direct URL (ไม่ใช่ pooler) + `sslmode=require`; `REDIS_URL` ต้องเป็น `rediss://`
- **SSO:** Microsoft tenant ขององค์กร (เช่นมหาวิทยาลัย) อาจบล็อก consent ของแอปภายนอก; Microsoft ไม่รับรองอีเมล (ไม่ผูกบัญชีเดิมอัตโนมัติ) → แอดมินคนแรกต้องล็อกอินด้วย Google
- **บัญชีทดสอบให้กรรมการ:** ไม่มีรหัสผ่าน ต้องใช้บัญชี Google ทดสอบ (Google อาจขอยืนยันตัวตนเพิ่มจากเครื่องใหม่)
- **Prisma:** `schema.prisma` เขียนไม่ได้ CHECK constraint → ต้องใส่ใน migration SQL เอง (ดูหมายเหตุ CHECK ใน `docs/er-diagram.md`)
- ข้อมูลเงื่อนไข free tier ที่ใช้ตัดสินใจ ตรวจครั้งล่าสุด ต.ค. 2026 — เปลี่ยนได้ ให้ยืนยันกับหน้าทางการก่อนสร้างทรัพยากร

## TODO ไอเดียต่อยอด

1. test: `url-validator`, `AuthService.refresh` (reuse detection), e2e สร้างลิงก์ → redirect → นับคลิก
2. CI: lint + build + test
3. ตรวจ URL กับ Safe Browsing + หน้าเตือนก่อน redirect
4. 2FA/ยืนยันตัวตนเพิ่มสำหรับแอดมิน

## วิธีทำงานกับโปรเจกต์นี้

- เปลี่ยน `schema.prisma` ต้องมี migration ใหม่เสมอ (`prisma migrate dev`) อย่าแก้ migration เก่าที่ apply แล้ว
- ห้าม commit `.env` / secret; ตัวอย่างค่าอยู่ใน `.env.example` เท่านั้น
- แก้ API แล้วอัปเดต `docs/api.md`; แก้ตาราง/ความสัมพันธ์แล้วอัปเดต `docs/er-diagram.md`; แก้ flow ข้อมูลแล้วอัปเดต `docs/dfd.md` / `docs/architecture.md` และแก้ `docs/diagrams.html` ให้ตรงด้วย (งานส่งอาจารย์อ้างอิงเอกสารเหล่านี้)
- ก่อนบอกว่าเสร็จ: `npm run build` ของแต่ละส่วน (frontend, core-api, redirect-service, analytics-service) ต้องผ่าน
