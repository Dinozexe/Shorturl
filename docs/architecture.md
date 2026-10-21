# Architecture

ดูภาพได้ที่ **https://shorturl.kittametdev.com/docs/architecture/**

- `frontend` — Next.js static export บน Cloudflare Workers (`shorturl.kittametdev.com`)
- `core-api` :4000 (`api.kittametdev.com`) — auth, ลิงก์, QR, admin, API key, guest
- `redirect-service` :4001 (`s.kittametdev.com`) — `GET /:code` → 302 อ่านจาก Redis cache (miss → Postgres) ตรวจรหัสผ่าน/จำกัดคลิก/วันเริ่ม แล้วเข้าคิว `clicks:queue` และ ping analytics
- `analytics-service` :4002 — ดึงคิวเป็น batch เขียน `clicks` + `link_daily_stats` + `links.click_count`, ให้สถิติแก่ core-api (header `x-internal-key`)
- PostgreSQL 16 (Neon) และ Redis 7 (Upstash); รัน 3 service เป็น Docker บน Render (free tier: cold start 30–50 วินาที)
