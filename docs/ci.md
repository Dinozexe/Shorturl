# CI / ชุดทดสอบ

ทุก push เข้า `main` และทุก Pull Request จะรัน [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — ผลรวมอยู่ที่ job **`CI ผ่านทั้งหมด` (`ci-ok`)**

## Pipeline

| Job | ทำอะไร | บล็อก merge? |
|---|---|---|
| **backend** | ติดตั้งตาม lockfile (`npm ci`) → `prisma migrate deploy` ฐานทดสอบ → typecheck (รวมไฟล์ทดสอบ) → build → **unit + integration test** ของ core-api / redirect-service / analytics-service บน Postgres 16 + Redis 7 จริง (service container พร้อม health check) | ✅ |
| **frontend** | typecheck → unit test → `next build` (static export) → ตรวจผล build (มีครบทุกหน้า, มี `_headers`, URL ของ API ถูกฝัง, ไม่มี `localhost:4000` หลุด) | ✅ |
| **docker** | build image ของทั้ง 3 service (ไม่ push) — รู้ก่อนว่า Render จะ build ผ่าน | ✅ |
| **audit** | `npm audit --omit=dev --audit-level=high` ต่อ service | backend ✅ / frontend ⚠️ รายงานอย่างเดียว (ดูด้านล่าง) |
| **hygiene** | `scripts/check-repo.sh`: ไม่มี `.env` ใน git, ไม่มีค่าลับหลุด (Google/Neon/AWS/GitHub token, private key, API key, URL ที่ฝังรหัสผ่าน), `render.yaml` ไม่มีค่าลับตรงๆ, CLI ไวยากรณ์ถูก | ✅ |
| **CodeQL** (`codeql.yml`) | สแกนโค้ด TypeScript หาช่องโหว่ทุก push/PR และทุกวันจันทร์ | ดูผลที่แท็บ Security |

## ชุดทดสอบ (≈ 426 ข้อ)

| ส่วน | Unit | Integration | ครอบคลุม |
|---|---|---|---|
| core-api | 90 | 192 | ตรวจ URL/alias (SSRF, IP ภายใน, โดเมนต้องห้าม), สไตล์ QR, รหัสผ่านลิงก์ (scrypt) · ล็อกอิน/refresh token หมุน+ตรวจจับใช้ซ้ำ/logout/ban, SSO redirect · CRUD ลิงก์ + ความเป็นเจ้าของ + แบ่งหน้า/ค้นหา · ป้องกันลิงก์ (รหัสผ่าน/จำกัดครั้ง/วันเริ่ม) + สัญญา cache · guest + rate limit · QR · RBAC แอดมิน, บล็อกโดเมน, audit · API key |
| redirect-service | 29 | 34 | แยก User-Agent, หน้าข้อความ, **hash รหัสผ่านเข้ากันได้ข้ามบริการ** · 302/404, สัญญา cache, คิวคลิก (IP ถูก hash), หมดอายุ/ปิด, วันเริ่ม, **จำกัดครั้งแบบ atomic (เปิดพร้อมกัน 25 ครั้ง ผ่านได้เท่าเพดานพอดี)**, รหัสผ่าน + กันเดา |
| analytics-service | 27 | 23 | ตรวจเหตุการณ์คลิก, ช่วงวันที่ · flush ลง DB แบบ transaction เดียว, ข้อมูลพิษ → dead letter, flush พร้อมกัน, ลบคลิกเก่า, สถิติ + สิทธิ์ internal key |
| frontend | 31 | — | i18n ไทย/อังกฤษครบตรงกัน + ตัวแปร `{n}` ตรงกัน, แปล error จาก backend, ตัววาด QR (ทุกลาย/สี/โลโก้/ข้อความ), format, pending URL |

**หลักการ:** integration test ยิง HTTP จริงเข้า Express + Postgres + Redis จริง (ไม่ mock ฐานข้อมูล) · ตัวรันเทสต์ในตัว Node (`node --test`) ไม่เพิ่ม dependency · ทุกไฟล์ทดสอบ **ปฏิเสธรัน** ถ้า `DATABASE_URL` ไม่ใช่ฐานที่ชื่อมี `test` หรือ Redis เป็น db 0 (กันล้างข้อมูลจริง)

## รันในเครื่อง

```bash
docker compose up -d                                   # postgres (5442) + redis (6380)
docker compose exec postgres psql -U shorturl -d postgres -c "CREATE DATABASE shorturl_test"
cd services/core-api && DATABASE_URL=postgresql://shorturl:shorturl@localhost:5442/shorturl_test npx prisma migrate deploy

# ต่อ service (ใช้ฐาน shorturl_test + Redis db 14 โดยอัตโนมัติ ไม่ยุ่งกับข้อมูลที่ใช้พัฒนา)
cd services/core-api         && npm test          # หรือ npm run test:unit / test:integration
cd services/redirect-service && npm test
cd services/analytics-service && npm test
cd frontend                  && npm test

./scripts/check-repo.sh                         # ตรวจค่าลับ/config
```
เปลี่ยนที่อยู่ฐานได้ด้วย `TEST_DATABASE_URL` / `TEST_REDIS_URL`

## ตั้งค่าที่ต้องกดเองบน GitHub / Render (ครั้งเดียว)

รองรับ **ทั้งสองวิธีทำงาน**: (A) commit/push เข้า `main` ตรงๆ และ (B) เปิด PR แล้ว merge เข้า `main` — workflow รันทั้งสองกรณี (`push` ที่ `main` + `pull_request`) CodeQL เช่นกัน

### ทำทันที (ไม่เกี่ยวกับวิธีทำงาน)
1. **Settings → Code security**: เปิด *Dependabot alerts*, *Dependabot security updates*, *Secret scanning*, *Push protection*
2. **Settings → Actions → General**: *Workflow permissions* = Read repository contents; ปิด *Allow GitHub Actions to create and approve pull requests*
3. **Render** (ทุก service) → Settings → *Auto-Deploy* = **After CI checks pass** — ใช้ได้กับทั้ง A และ B: push เข้า `main` แล้ว Render รอผล CI ของ commit นั้นก่อน ถ้าล้มก็ไม่ deploy (Cloudflare Pages/Workers ดึงจาก `main` ตรงๆ จึงยัง deploy แม้ CI ล้ม — ดูหมายเหตุท้ายตาราง)

### ตั้งกฎให้ `main` — เลือกทางใดทางหนึ่ง

| | ตั้งอย่างไร | push ตรงเข้า `main` | merge ผ่าน PR | เหมาะกับ |
|---|---|---|---|---|
| **1. ไม่ตั้งกฎ** (ค่าเริ่มต้น) | ไม่ต้องทำอะไร | ได้ | ได้ | ช่วงเร่งทำงานคนเดียว: CI รันตามหลังและแจ้งผล, Render ไม่ deploy ถ้า CI ล้ม |
| **2. Ruleset + เจ้าของข้ามได้ (แนะนำ)** | Settings → Rules → Rulesets → New branch ruleset → target `main`: ✅ *Require a pull request* ✅ *Require status checks to pass* → **`CI ผ่านทั้งหมด`** ✅ *Block force pushes* → **Bypass list: Repository admin = Always allow** | ได้ (เฉพาะเจ้าของ; CI ยังรันหลัง push) | ได้ และต้องผ่าน CI ก่อน merge | ใช้ได้ทั้งสองแบบ: คนอื่นและ Dependabot ต้องผ่าน PR + CI, เจ้าของเลือก push ตรงได้เมื่อรีบ |
| **3. เข้มงวด** | เหมือนข้อ 2 แต่ไม่ใส่ bypass (เพิ่ม *Require review from Code Owners* ได้) | ❌ ไม่ได้ | ✅ ต้องผ่าน CI | ใกล้ส่งงาน/ใช้ร่วมกับคนอื่น |

> ชื่อ check **`CI ผ่านทั้งหมด`** จะโผล่ในช่องค้นหาหลังจากรันสำเร็จอย่างน้อยหนึ่งรอบ ให้ push รอบแรกก่อนแล้วค่อยสร้าง ruleset
>
> **หมายเหตุ:** push ตรงเข้า `main` ไม่มีทางให้ GitHub ปฏิเสธก่อนเพราะ CI ยังไม่ได้รัน — จึงเป็นการ "แจ้งผลตามหลัง" เท่านั้น ถ้า CI แดงให้แก้ด้วย commit ถัดไปหรือ `git revert` ทันที; ส่วน Render ถูกกันไว้ด้วยข้อ 3 แล้ว ถ้าต้องการกัน Cloudflare ด้วยให้ใช้ทาง 2 หรือ 3 แล้ว merge ผ่าน PR

## แนวปฏิบัติที่ใช้ (อ้างอิง [Secure use reference — GitHub Docs](https://docs.github.com/en/actions/reference/security/secure-use))

- `permissions: contents: read` ระดับ workflow; มีเฉพาะ CodeQL ที่ขอ `security-events: write`
- **pin action ด้วย commit SHA เต็ม** (ตรวจแล้วว่ามีอยู่จริง) พร้อมคอมเมนต์เวอร์ชัน — Dependabot (`github-actions`) อัปเดต SHA ให้ทุกสัปดาห์
- `persist-credentials: false` ตอน checkout, ไม่ใช้ `pull_request_target`, ไม่ฝัง input ที่ไม่น่าไว้ใจใน `run:`
- `concurrency` ยกเลิกรอบเก่าของ PR, `timeout-minutes` ทุก job, `npm ci` + cache ผ่าน `setup-node`
- ไม่มี secret ใน CI เลย (ฐานทดสอบเป็น service container ใช้รหัสทิ้ง) และมีด่านตรวจค่าลับหลุด

## ข้อจำกัดที่ต้องรู้

- **frontend audit ไม่บล็อก:** Next 14.2 มีประกาศช่องโหว่ (critical/high) แต่เกือบทั้งหมดเป็นฟีเจอร์ฝั่งเซิร์ฟเวอร์ (image optimizer, server actions, middleware, RSC) ที่เราไม่ได้ deploy เพราะใช้ `output: 'export'` (ขึ้นเป็นไฟล์ static) ทางแก้คือย้ายเป็น Next 16 (เปลี่ยนใหญ่) จึงตั้ง Dependabot ไม่อัป major ของ `next` อัตโนมัติ และรายงานไว้ไม่ให้เงียบ
- **ยังไม่มีใน CI:** ทดสอบ UI ผ่านเบราว์เซอร์จริง (puppeteer) และสแกน QR ด้วย jsQR — ผูกกับเครื่อง/ข้อมูลเดโมและต้องใช้ Chrome จึงรันมือก่อนเดโม
- **workflow เพิ่งเขียน:** ผมตรวจด้วย `actionlint` และซ้อมรันทุกขั้นในเครื่องแล้ว แต่ยังไม่เคยรันบน GitHub จริง รอบแรกอาจต้องแก้เล็กน้อย
