# Data Flow Diagram

ดูภาพได้ที่ **https://shorturl.kittametdev.com/docs/dfd/** (Level 0 · Level 1 · Level 2 ของ Redirect) — สร้างจาก `scripts/build-diagrams.mjs`

## กระบวนการ (Level 1)

| รหัส | กระบวนการ | หน้าที่ | บริการ |
|---|---|---|---|
| 1.0 | ยืนยันตัวตน | Google OIDC + PKCE / บัญชีทดสอบ, JWT 15 นาที + refresh cookie 7 วัน (หมุน + ตรวจใช้ซ้ำ) | core-api |
| 2.0 | จัดการลิงก์ | ย่อลิงก์ (ผู้ใช้/guest), alias, หมดอายุ, รหัสผ่าน, จำกัดคลิก, วันเริ่ม, ปิด/เปิด/ลบ, ตรวจโดเมนต้องห้าม | core-api |
| 3.0 | Redirect | cache → DB, ตรวจเงื่อนไข/รหัสผ่าน/สิทธิ์คลิก, ตอบ 302, เข้าคิวคลิก | redirect-service |
| 4.0 | สร้าง QR | QR PNG/SVG/matrix + บันทึกสไตล์ | core-api |
| 5.0 | สถิติคลิก | flush คิว → clicks + สรุปรายวัน + click_count, ให้ข้อมูลกราฟ | analytics-service |
| 6.0 | จัดการระบบ | ผู้ใช้/ลิงก์/โดเมนที่บล็อก/audit (ADMIN, MODERATOR บางส่วน) | core-api |

## ที่เก็บข้อมูล

| รหัส | เนื้อหา |
|---|---|
| D1 | `users`, `sso_identities` |
| D2 | `links` |
| D3 | `clicks`, `link_daily_stats` |
| D4 | `blocked_domains` |
| D5 | `audit_logs` |
| D6 | Redis: cache ลิงก์, session/blacklist, rate limit, ตัวนับคลิก, คิวคลิก |

ผู้ใช้งานภายนอก: ผู้เข้าชมลิงก์/Guest, ผู้ใช้ (USER), ผู้ดูแล (ADMIN/MODERATOR), Google (SSO)
