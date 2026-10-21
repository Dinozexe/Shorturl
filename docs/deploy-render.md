# Deploy ฟรี: Neon + Upstash + Render + Cloudflare Pages

ขั้นที่ต้องใช้บัญชีของเจ้าของโปรเจกต์ (สมัคร/กดยืนยัน/ใส่ค่าลับ) ต้องทำเองทั้งหมด — ไฟล์ที่เตรียมไว้ให้แล้ว: `render.yaml`, `services/*/Dockerfile`, `frontend/public/_headers`

| Hostname | ไปที่ | หน้าที่ |
|---|---|---|
| `shorturl.kittametdev.com` | Cloudflare Pages (static) | หน้าเว็บ |
| `api.kittametdev.com` | Render `shorturl-core-api` | `/api/*` |
| `s.kittametdev.com` | Render `shorturl-redirect` | ลิงก์สั้น `/:code` |
| (ภายใน) `shorturl-analytics.onrender.com` | Render `shorturl-analytics` | รับ flush คลิก/สถิติ — ไม่ต้องผูกโดเมน |

## 0) เตรียมค่าลับ (สุ่มในเครื่อง รันแยกทีละค่า)

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```
ต้องใช้ 5 ค่าที่ **ไม่ซ้ำกัน**: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `INTERNAL_API_KEY`, `IP_HASH_SALT`, และ `DEMO_ADMIN_PASSWORD` (ตั้งเองอย่างน้อย 8 ตัว) — เก็บไว้ในที่ปลอดภัย ห้ามใส่ใน README/ไฟล์ที่ commit

## 1) ฐานข้อมูล — Neon (Postgres)
1. สมัคร <https://neon.tech> → สร้างโปรเจกต์ (region ใกล้ไทย: Singapore) → คัดลอก connection string **แบบ direct** (ไม่ใช่ `-pooler`) ต้องมี `?sslmode=require`
2. นี่คือ `DATABASE_URL` (ใช้ค่าเดียวกันทั้ง 3 service) — migration รันเองตอน core-api สตาร์ท

## 2) Redis — Upstash
1. สมัคร <https://upstash.com> → สร้าง Redis (region Singapore) → คัดลอก URL แบบ `rediss://default:…@…upstash.io:6379` (TLS)
2. นี่คือ `REDIS_URL` (ค่าเดียวกันทั้ง 3 service) · โควต้าฟรีมีจำกัด (คำสั่ง/เดือน) แต่ละคลิกใช้ราว 3–6 คำสั่ง พอสำหรับเดโม

## 3) Google OAuth (ล็อกอินด้วย Google)
1. Google Cloud Console → APIs & Services → Credentials → OAuth client (Web)
2. Authorized redirect URI = `https://api.kittametdev.com/api/auth/sso/google/callback`
3. ได้ `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` · OAuth consent screen ตั้งเป็น Testing แล้วเพิ่มอีเมลผู้ทดสอบ หรือ Publish

## 4) Render (3 service)
1. <https://render.com> → New → **Blueprint** → เลือก repo `Dinozexe/Shorturl` (อ่าน `render.yaml` ที่ root)
2. กรอกค่าที่ Render ถาม (`sync: false`) — ค่าที่ต้อง **เหมือนกันทุก service**: `DATABASE_URL`, `REDIS_URL`, `INTERNAL_API_KEY` (redirect ใช้ `IP_HASH_SALT` ด้วย)
   - `ANALYTICS_URL` = URL ของ `shorturl-analytics` (เช่น `https://shorturl-analytics.onrender.com` ดูได้หลังสร้างเสร็จ; ถ้ายังไม่รู้ใส่ชั่วคราวแล้วแก้ทีหลัง)
   - `ADMIN_EMAIL` = อีเมล Google ของคุณ (จะได้บทบาท ADMIN ตอนล็อกอินครั้งแรก)
   - `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD` = บัญชีเดโมให้กรรมการ (ไม่ใส่ = ปิดการล็อกอินด้วยรหัสผ่าน)
3. รอ build เสร็จ (3 service) → เปิด `https://<core-api>.onrender.com/api/health` ต้องได้ `{"status":"ok"}`
4. เมื่อ core-api ขึ้นแล้วและ seed ทำงานรอบแรก (ดู log: "seed" เสร็จ) → แก้ `SEED_ON_START` เป็น `false` (Environment) · seed รันซ้ำได้ปลอดภัย จึงปล่อยไว้ก็ไม่พัง

### ผูกโดเมนของ Render
Render → แต่ละ service → Settings → Custom Domains: `shorturl-core-api` = `api.kittametdev.com`, `shorturl-redirect` = `s.kittametdev.com` แล้วเพิ่ม CNAME ที่ Render บอกไปที่ Cloudflare DNS

- **DNS-only (เมฆเทา)** — ค่าเริ่มต้นที่ง่ายสุด: Render ออกใบรับรองให้เอง · แต่ Cloudflare ไม่ได้อยู่หน้าเซิร์ฟเวอร์ → **ไม่มี header ประเทศ** สถิติประเทศจะขึ้น "ไม่ทราบ" (`BEHIND_CLOUDFLARE=false`)
- **Proxied (เมฆส้ม)** — ได้ประเทศของผู้เปิดลิงก์: ตั้ง SSL/TLS = **Full (strict)** ที่ Cloudflare, ตั้ง `BEHIND_CLOUDFLARE=true` ทั้ง core-api และ redirect (เพื่อให้เชื่อ `CF-Connecting-IP` / `CF-IPCountry`) — เปิดหลังเว็บใช้งานได้ปกติแล้วค่อยทำ

> Render free หลับหลังว่าง ~15 นาที ปลุก 30–50 วินาที — **ก่อนเดโมให้เปิด 3 URL (`/api/health`, `s.…/health`, analytics `/health`) ไว้ล่วงหน้า 1–2 นาที**

## 5) Cloudflare Pages (หน้าเว็บ)
1. Cloudflare → Workers & Pages → Create → Pages → Connect to Git → repo เดิม
2. Framework: Next.js (Static HTML Export) · **Root directory** `frontend` · Build command `npm run build` · Output directory `out`
3. Environment variable (ตอน build): `NEXT_PUBLIC_API_URL` = `https://api.kittametdev.com` (ฝังตอน build — เปลี่ยนแล้วต้อง deploy ใหม่) และตั้ง Node 20 (`NODE_VERSION=20`)
4. Custom domain: `shorturl.kittametdev.com`

## 6) ตรวจหลัง deploy (ทำตามลำดับ)
```bash
curl -s https://api.kittametdev.com/api/health            # {"status":"ok"}
curl -s https://api.kittametdev.com/api/auth/sso/providers # มี google
curl -sI https://s.kittametdev.com/zzzzz | head -1         # HTTP/2 404 (ไม่พบลิงก์)
```
แล้วในเบราว์เซอร์ (หน้าต่างไม่ระบุตัวตน):
- [ ] เปิด `https://shorturl.kittametdev.com` → ล็อกอินด้วยบัญชีเดโม (ไปหน้าแอดมิน) และ Google (ไป dashboard)
- [ ] ย่อลิงก์ → เปิด `https://s.kittametdev.com/<code>` เด้งไปปลายทาง
- [ ] ผ่าน ~1–2 นาที ดูสถิติของลิงก์: ยอดเปิดเพิ่ม
- [ ] refresh หน้า dashboard แล้วยังล็อกอินอยู่ (ถ้าหลุด: ตรวจ `COOKIE_DOMAIN=.kittametdev.com`, `COOKIE_SECURE=true`, และ `FRONTEND_ORIGIN` ตรงกับ URL หน้าเว็บเป๊ะ ไม่มี `/` ท้าย)
- [ ] `surl login --token … --api https://api.kittametdev.com` แล้ว `surl shorten …` ได้
- [ ] ลบข้อมูลตัวอย่าง (ถ้าเคยใส่): `npx tsx prisma/demo-clicks.ts <อีเมล> --remove`

## ปัญหาที่พบบ่อย
| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| core-api ล้มตอนสตาร์ท "ต้องตั้งค่า env …" | ขาดค่า env — ดู log ว่าตัวไหน; `JWT_*` ต้องยาว ≥ 32 ตัว |
| migrate error / connect ไม่ได้ | ใช้ connection string ของ Neon ที่เป็น direct + `sslmode=require` |
| ล็อกอิน Google ได้ error redirect_uri_mismatch | redirect URI ใน Google Console ไม่ตรง `API_BASE_URL` + `/api/auth/sso/google/callback` |
| CORS error ในหน้าเว็บ | `FRONTEND_ORIGIN` ของ core-api ต้องตรงกับ origin หน้าเว็บเป๊ะ |
| สถิติไม่ขึ้น | `ANALYTICS_URL` ของ redirect-service ผิด หรือ analytics ยังหลับ (รอ 1 นาที) · `INTERNAL_API_KEY` ไม่ตรงกัน |
| refresh แล้วหลุดล็อกอิน | cookie ไม่ถูกส่ง: ดู `COOKIE_DOMAIN`/`COOKIE_SECURE` ด้านบน |
