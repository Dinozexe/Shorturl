#!/usr/bin/env node
// สร้างหน้า DFD / ER / Architecture เป็น HTML+SVG แบบ static (ไม่เรียก resource ภายนอก)
// ใช้: node scripts/build-diagrams.mjs  →  frontend/public/docs/{index,dfd,er,architecture}/index.html
// ถ้าแก้ระบบ (ตาราง/โฟลว์) ให้แก้ข้อมูลในไฟล์นี้แล้วรันใหม่ — หน้าเว็บจะถูก deploy ไปพร้อม frontend ที่ /docs/
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'public', 'docs');

const C = {
  ink: '#0f172a', muted: '#475569', line: '#cbd5e1', blue: '#1d4ed8', blueSoft: '#dbeafe', blueMid: '#93c5fd',
  ent: '#eff6ff', entLine: '#1e40af', store: '#f1f5f9', storeLine: '#334155', ext: '#ecfdf5', extLine: '#047857',
  proc: '#2563eb', flow: '#334155',
};
const FONT = `'Noto Sans Thai','Sukhumvit Set',Thonburi,'Segoe UI',system-ui,sans-serif`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---------- ตัวช่วยวาด ---------- */
class Svg {
  constructor(w, h) { this.w = w; this.h = h; this.parts = []; this.labels = []; }
  add(s) { this.parts.push(s); }
  text(x, y, lines, { size = 14, weight = 400, fill = C.ink, anchor = 'middle', mono = false, lh } = {}) {
    const ls = Array.isArray(lines) ? lines : [lines];
    const step = lh ?? size * 1.3;
    const y0 = y - ((ls.length - 1) * step) / 2;
    return `<text x="${x}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}"${mono ? ` font-family="ui-monospace,Menlo,Consolas,monospace"` : ''}>${ls
      .map((l, i) => `<tspan x="${x}" y="${(y0 + i * step + size * 0.35).toFixed(1)}">${esc(l)}</tspan>`)
      .join('')}</text>`;
  }
  entity(x, y, w, h, title, sub, kind = 'ent') {
    const [f, s] = kind === 'ext' ? [C.ext, C.extLine] : [C.ent, C.entLine];
    this.add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${f}" stroke="${s}" stroke-width="2"/>`);
    this.add(this.text(x + w / 2, y + h / 2 - (sub ? 8 : 0), title, { size: 15, weight: 700, fill: s }));
    if (sub) this.add(this.text(x + w / 2, y + h / 2 + 12, sub, { size: 12, fill: C.muted }));
    return { t: 'r', x, y, w, h };
  }
  proc(cx, cy, r, id, name, sub) {
    this.add(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.proc}" stroke="#1e3a8a" stroke-width="2"/>`);
    this.add(this.text(cx, cy - r * 0.52, id, { size: 13, weight: 700, fill: '#bfdbfe' }));
    this.add(`<line x1="${cx - r * 0.7}" x2="${cx + r * 0.7}" y1="${cy - r * 0.34}" y2="${cy - r * 0.34}" stroke="#93c5fd" stroke-width="1"/>`);
    this.add(this.text(cx, cy + r * 0.12, name, { size: r > 80 ? 17 : 14, weight: 700, fill: '#fff' }));
    if (sub) this.add(this.text(cx, cy + r * 0.55, sub, { size: 11, fill: '#dbeafe' }));
    return { t: 'c', x: cx, y: cy, r };
  }
  store(x, y, w, h, id, name, sub) {
    this.add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.store}" stroke="none"/>`);
    this.add(`<line x1="${x}" x2="${x + w}" y1="${y}" y2="${y}" stroke="${C.storeLine}" stroke-width="2"/><line x1="${x}" x2="${x + w}" y1="${y + h}" y2="${y + h}" stroke="${C.storeLine}" stroke-width="2"/>`);
    this.add(`<line x1="${x + 46}" x2="${x + 46}" y1="${y}" y2="${y + h}" stroke="${C.storeLine}" stroke-width="1.5"/>`);
    this.add(this.text(x + 23, y + h / 2, id, { size: 14, weight: 700, fill: C.storeLine }));
    this.add(this.text(x + 46 + (w - 46) / 2, y + h / 2 - (sub ? 8 : 0), name, { size: 14, weight: 700 }));
    if (sub) this.add(this.text(x + 46 + (w - 46) / 2, y + h / 2 + 11, sub, { size: 11, fill: C.muted }));
    return { t: 'r', x, y, w, h };
  }
  // เส้นทางข้อมูล: pts = [[x,y],...]; label อยู่ที่ (lx,ly) พร้อมพื้นขาวบางๆ กันเส้นทับ
  flow(pts, label, lx, ly, { anchor = 'middle', dash = false, both = false } = {}) {
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
    this.add(`<path d="${d}" fill="none" stroke="${C.flow}" stroke-width="1.6"${dash ? ' stroke-dasharray="6 4"' : ''} marker-end="url(#ah)"${both ? ' marker-start="url(#ahs)"' : ''}/>`);
    if (label) {
      const ls = Array.isArray(label) ? label : [label];
      this.labels.push(`<g font-size="12" fill="${C.ink}" stroke="#fff" stroke-width="5" stroke-linejoin="round" paint-order="stroke" style="paint-order:stroke">${this.text(lx, ly, ls, { size: 12, anchor, lh: 15 })}</g>`);
    }
  }

  // เชื่อมรูปสองรูปด้วยเส้นตรงที่ตัดขอบรูปให้เอง; off = เลื่อนเส้นขนาน (ใช้กับคู่เส้นสองทิศ)
  link(a, b, label, { off = 0, lt = 0.5, ldx = 0, ldy = 0, lo = 0, both = false, dash = false, anchor = 'middle' } = {}) {
    const ctr = (q) => (q.t === 'c' ? [q.x, q.y] : [q.x + q.w / 2, q.y + q.h / 2]);
    const [ax, ay] = ctr(a), [bx, by] = ctr(b);
    const len = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / len, uy = (by - ay) / len;
    const px = -uy * off, py = ux * off;
    const exit = (q, cx, cy, dx, dy) => {
      if (q.t === 'c') return [cx + dx * (q.r + 1), cy + dy * (q.r + 1)];
      const hw = q.w / 2, hh = q.h / 2;
      const k = Math.min(dx ? hw / Math.abs(dx) : 1e9, dy ? hh / Math.abs(dy) : 1e9) + 1;
      return [cx + dx * k, cy + dy * k];
    };
    const p1 = exit(a, ax + px, ay + py, ux, uy), p2 = exit(b, bx + px, by + py, -ux, -uy);
    const r = (v) => Math.round(v * 10) / 10;
    if (lo) { ldx += -uy * Math.sign(off) * lo; ldy += ux * Math.sign(off) * lo; }
    this.flow([[r(p1[0]), r(p1[1])], [r(p2[0]), r(p2[1])]], label, r(p1[0] + (p2[0] - p1[0]) * lt + ldx), r(p1[1] + (p2[1] - p1[1]) * lt + ldy), { both, dash, anchor });
  }
  render(title) {
    return `<svg viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}" role="img" aria-label="${esc(title)}" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">
<defs>
<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${C.flow}"/></marker>
<marker id="ahs" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M10 0L0 5L10 10z" fill="${C.flow}"/></marker>
</defs>
<rect width="${this.w}" height="${this.h}" fill="#fff"/>
${this.parts.join('\n')}
${this.labels.join('\n')}
</svg>`;
  }
}

/* ---------- DFD Level 0 ---------- */
function dfd0() {
  const s = new Svg(1180, 680);
  const P = s.proc(590, 340, 125, '0', 'Short URL', 'ระบบย่อลิงก์');
  const G = s.entity(40, 60, 210, 76, 'ผู้เข้าชมลิงก์ / Guest', 'ไม่ต้องล็อกอิน');
  const U = s.entity(40, 500, 210, 76, 'ผู้ใช้ (USER)', 'ล็อกอินด้วย Google');
  const A = s.entity(930, 500, 210, 76, 'ผู้ดูแล', 'ADMIN / MODERATOR');
  const O = s.entity(930, 60, 210, 76, 'Google', 'ผู้ให้บริการ SSO (OIDC)', 'ext');
  const o = 20, lo = 30;
  s.link(G, P, ['ลิงก์ต้นฉบับ (ย่อแบบ guest)', 'คำขอเปิดลิงก์สั้น · รหัสผ่านลิงก์'], { off: -o, lo, lt: 0.4 });
  s.link(P, G, ['ลิงก์สั้น (หมดอายุ 7 วัน)', '302 ไปปลายทาง / หน้าแจ้งสถานะ'], { off: -o, lo, lt: 0.6 });
  s.link(U, P, ['คำขอเข้าสู่ระบบ · ข้อมูลลิงก์ + การป้องกัน', 'สไตล์ QR · คำขอดูสถิติ'], { off: -o, lo, lt: 0.4 });
  s.link(P, U, ['รายการลิงก์ · QR', 'สถิติการคลิก'], { off: -o, lo, lt: 0.6 });
  s.link(A, P, ['คำสั่งจัดการผู้ใช้ / ลิงก์', 'บล็อกโดเมน'], { off: -o, lo, lt: 0.4 });
  s.link(P, A, ['ภาพรวมระบบ · รายชื่อ', 'Audit log'], { off: -o, lo, lt: 0.6 });
  s.link(O, P, ['id_token', '(sub, email)'], { off: -o, lo, lt: 0.4 });
  s.link(P, O, ['คำขอยืนยันตัวตน', '(OIDC + PKCE)'], { off: -o, lo, lt: 0.6 });
  s.add(s.text(590, 650, 'ลูกศร = ทิศทางข้อมูล · วงกลม = กระบวนการ · ฟ้า = ผู้ใช้งาน · เขียว = ระบบภายนอก', { size: 12, fill: C.muted }));
  return s.render('DFD Level 0');
}

/* ---------- DFD Level 1 ---------- */
function dfd1() {
  const s = new Svg(1340, 800);
  const R = 66, PY = 330;
  const X = { p6: 120, p1: 335, p2: 550, p4: 765, p5: 980, p3: 1195 };
  const A = s.entity(20, 30, 200, 70, 'ผู้ดูแล', 'ADMIN / MODERATOR');
  const O = s.entity(235, 30, 200, 70, 'Google', 'SSO (OIDC)', 'ext');
  const U = s.entity(560, 30, 200, 70, 'ผู้ใช้ (USER)', 'ล็อกอินแล้ว');
  const G = s.entity(1095, 30, 200, 70, 'ผู้เข้าชมลิงก์', 'Guest / ไม่ล็อกอิน');
  const p = (k, id, n, sub) => s.proc(X[k], PY, R, id, n, sub);
  const p6 = p('p6', '6.0', 'จัดการระบบ', 'RBAC · Audit');
  const p1 = p('p1', '1.0', 'ยืนยันตัวตน', 'SSO · JWT');
  const p2 = p('p2', '2.0', 'จัดการลิงก์', 'ย่อ · ป้องกัน');
  const p4 = p('p4', '4.0', 'สร้าง QR', 'สไตล์ · PNG/SVG');
  const p5 = p('p5', '5.0', 'สถิติคลิก', 'queue → DB');
  const p3 = p('p3', '3.0', 'Redirect', 'ตรวจสิทธิ์ · 302');
  const SY = 660, SW = 204, SH = 66;
  const st = (i, id, n, sub) => s.store(20 + 218 * i, SY, SW, SH, id, n, sub);
  const d5 = st(0, 'D5', 'audit_logs');
  const d1 = st(1, 'D1', 'users', 'sso_identities · api_keys');
  const d4 = st(2, 'D4', 'blocked_domains');
  const d2 = st(3, 'D2', 'links', 'รหัสสั้น · การป้องกัน · qr_style');
  const d6 = st(4, 'D6', 'Redis', 'cache · session · คิวคลิก');
  const d3 = st(5, 'D3', 'clicks', 'link_daily_stats');

  // เอนทิตี ↔ กระบวนการ
  s.link(A, p6, ['คำสั่ง ban/ปิดลิงก์/บล็อกโดเมน', 'ภาพรวม · รายชื่อ · audit'], { both: true, lt: 0.5, ldx: 78 });
  s.link(O, p1, ['คำขอ OIDC ↔ id_token'], { both: true, lt: 0.5, ldx: 90 });
  s.link(U, p1, 'ล็อกอิน / ออกจากระบบ', { lt: 0.62, ldx: -78, ldy: -12 });
  s.link(U, p2, ['URL · alias · วันหมดอายุ', 'รหัสผ่าน · จำกัดคลิก · วันเริ่ม', '↔ ลิงก์สั้น · รายการ'], { both: true, lt: 0.38, ldx: -62, ldy: -4 });
  s.link(U, p4, ['ขอ QR · สไตล์ ↔ QR'], { both: true, lt: 0.5, ldx: 85, ldy: 8 });
  s.link(U, p5, ['ขอสถิติ ↔ สถิติ'], { both: true, lt: 0.6, ldx: 70, ldy: -10 });
  s.link(G, p3, ['เปิด /code · รหัสผ่านลิงก์', '↔ 302 / หน้าสถานะ'], { both: true, lt: 0.5, ldx: 72 });
  s.link(G, p2, 'ย่อลิงก์แบบ guest → ลิงก์สั้น', { both: true, lt: 0.2, ldx: 80, ldy: 6, dash: true });

  // กระบวนการ ↔ ที่เก็บข้อมูล
  s.link(p6, d5, 'บันทึก audit', { lt: 0.5, ldx: -48 });
  s.link(p6, d1, 'ban / เปลี่ยนสิทธิ์', { both: true, lt: 0.62, ldx: 52 });
  s.link(p6, d4, 'บล็อก/ปลดโดเมน', { both: true, lt: 0.75, ldx: -30 });
  s.link(p6, d2, 'ปิด/เปิดลิงก์', { both: true, lt: 0.82, ldx: -42 });
  s.link(p1, d1, 'ผู้ใช้ · identity · key', { both: true, lt: 0.5, ldx: -78 });
  s.link(p1, d6, 'session (rt/bl)', { both: true, lt: 0.7, ldx: 40 });
  s.link(d4, p2, 'ตรวจโดเมนต้องห้าม', { lt: 0.5, ldx: -76 });
  s.link(p2, d2, 'บันทึก/อ่านลิงก์', { both: true, lt: 0.62, ldx: 56 });
  s.link(p2, d6, 'ลบ cache', { lt: 0.78, ldx: 46 });
  s.link(p4, d2, 'shortCode ↔ qr_style', { both: true, lt: 0.5, ldx: 78 });
  s.link(p5, d6, 'ดึงคิวคลิก', { lt: 0.5, ldx: 30 });
  s.link(p5, d3, 'บันทึกคลิก + ยอดรายวัน', { lt: 0.6, ldx: 52, ldy: 6 });
  s.link(p5, d2, 'click_count', { lt: 0.78, ldx: -60, dash: true });
  s.link(p3, d6, ['cache · นับสิทธิ์', 'เข้าคิวคลิก'], { both: true, lt: 0.55, ldx: 60 });
  s.link(d2, p3, 'cache miss', { lt: 0.38, ldx: 52, dash: true });
  s.add(s.text(670, 780, 'เส้นประ = การเข้าถึงรอง · 2.0/4.0/5.0/6.0 ต้องผ่าน 1.0 (JWT) ก่อน · 6.0 เฉพาะ ADMIN/MODERATOR', { size: 12, fill: C.muted }));
  return s.render('DFD Level 1');
}

/* ---------- DFD Level 2: Redirect (3.0) ---------- */
function dfd2() {
  const s = new Svg(1360, 760);
  const R = 58, y = 330;
  const xs = [270, 490, 710, 930, 1150];
  const V = s.entity(20, 295, 150, 70, 'ผู้เข้าชม', 'GET /:code');
  const P = [
    s.proc(xs[0], y, R, '3.1', 'หาลิงก์', 'cache → DB'),
    s.proc(xs[1], y, R, '3.2', 'ตรวจเงื่อนไข', 'ปิด/หมดอายุ/เริ่ม'),
    s.proc(xs[2], y, R, '3.3', 'ตรวจรหัสผ่าน', 'scrypt · rate limit'),
    s.proc(xs[3], y, R, '3.4', 'นับสิทธิ์คลิก', 'INCR lim:{id}'),
    s.proc(xs[4], y, R, '3.5', 'ตอบ 302', 'Location'),
  ];
  const R1 = s.store(250, 620, 300, 66, 'D6', 'Redis', 'link:{code} · lim:{id} · rl:*');
  const D2 = s.store(20, 620, 200, 66, 'D2', 'links', 'อ่านเมื่อ cache miss');
  const R2 = s.store(860, 620, 300, 66, 'D6', 'Redis', 'clicks:queue');
  const W = s.entity(560, 30, 240, 70, 'ผู้เข้าชม', 'รับหน้าสถานะ (ข้อผิดพลาด)');
  const D = s.entity(1100, 30, 240, 70, 'เว็บปลายทาง', 'URL ต้นฉบับ');
  s.link(V, P[0], 'รหัสสั้น', { lt: 0.5, ldy: -16 });
  ['ข้อมูลลิงก์', 'ผ่านเงื่อนไข', 'รหัสถูกต้อง', 'ได้สิทธิ์'].forEach((l, i) => s.link(P[i], P[i + 1], l, { lt: 0.5, ldy: -16 }));
  s.link(P[0], R1, 'GET link:{code}', { both: true, lt: 0.5, ldx: 70 });
  s.link(P[0], D2, 'cache miss → SELECT', { lt: 0.5, ldx: -78, dash: true });
  s.link(P[1], W, ['403 ยังไม่เริ่ม', '404 ไม่พบ/ปิด · 410 หมดอายุ'], { lt: 0.45, ldx: -105 });
  s.link(P[2], W, ['401 ขอรหัสผ่าน', '429 ลองผิดเกิน'], { lt: 0.5, ldx: 60 });
  s.link(P[3], W, '410 ครบจำนวนคลิก', { lt: 0.55, ldx: 60 });
  s.link(P[2], R1, 'rate limit (IP+ลิงก์)', { both: true, lt: 0.55, ldx: 70 });
  s.link(P[3], R1, 'INCR lim:{id} (atomic)', { both: true, lt: 0.4, ldx: 100 });
  s.link(P[4], D, '302 → URL ปลายทาง', { lt: 0.5, ldx: 70 });
  s.link(P[4], R2, ['เหตุการณ์คลิก', '(ip_hash · UA · referer · ประเทศ)'], { lt: 0.55, ldx: 105 });
  s.add(s.text(680, 735, 'หลังตอบ 302 จึงเข้าคิวคลิก (fire-and-forget) — analytics ล่มก็ไม่กระทบผู้เข้าชม', { size: 12, fill: C.muted }));
  return s.render('DFD Level 2 — 3.0 Redirect');
}

/* ---------- ER ---------- */
const T = {
  users: { x: 470, y: 40, cols: [
    ['id', 'uuid', 'PK'], ['email', 'text', 'UK'], ['name', 'text?', ''], ['role', 'USER|MODERATOR|ADMIN', ''], ['is_banned', 'bool', ''], ['last_login_at', 'timestamp?', ''], ['created_at', 'timestamp', ''],
  ] },
  sso_identities: { x: 10, y: 40, cols: [
    ['id', 'uuid', 'PK'], ['user_id', 'uuid', 'FK'], ['provider', 'google|microsoft', 'UK'], ['subject', 'text (sub)', 'UK'], ['email', 'text', ''], ['email_verified', 'bool', ''], ['created_at', 'timestamp', ''], ['last_login_at', 'timestamp', ''],
  ] },
  api_keys: { x: 930, y: 40, cols: [
    ['id', 'int', 'PK'], ['user_id', 'uuid', 'FK'], ['name', 'text', ''], ['prefix', 'text', ''], ['key_hash', 'sha256', 'UK'], ['last_used_at', 'timestamp?', ''], ['expires_at', 'timestamp?', ''], ['created_at', 'timestamp', ''],
  ] },
  links: { x: 470, y: 380, cols: [
    ['id', 'int', 'PK'], ['user_id', 'uuid?', 'FK'], ['short_code', 'text', 'UK'], ['original_url', 'text', ''], ['original_host', 'text', 'IDX'], ['status', 'ACTIVE|DISABLED|ADMIN_DISABLED', ''],
    ['expires_at', 'timestamp?', ''], ['starts_at', 'timestamp?', ''], ['max_clicks', 'int?', ''], ['password_hash', 'text? (scrypt)', ''], ['qr_style', 'jsonb?', ''], ['click_count', 'int', ''], ['created_at', 'timestamp', ''],
  ] },
  audit_logs: { x: 10, y: 400, cols: [
    ['id', 'int', 'PK'], ['actor_id', 'uuid?', 'FK'], ['action', 'enum', ''], ['target_type', 'USER|LINK|DOMAIN|API_KEY', ''], ['target_id', 'text', ''], ['detail', 'text?', ''], ['created_at', 'timestamp', ''],
  ] },
  blocked_domains: { x: 930, y: 400, cols: [
    ['id', 'int', 'PK'], ['domain', 'text', 'UK'], ['reason', 'text', ''], ['created_by_id', 'uuid?', 'FK'], ['created_at', 'timestamp', ''],
  ] },
  clicks: { x: 10, y: 770, cols: [
    ['id', 'bigint', 'PK'], ['link_id', 'int', 'FK'], ['ip_hash', 'sha256+salt', ''], ['user_agent', 'text?', ''], ['referer', 'text?', ''], ['country', 'char(2)?', ''], ['device', 'desktop|mobile|tablet|bot|unknown', ''], ['os', 'text?', ''], ['browser', 'text?', ''], ['clicked_at', 'timestamp', 'IDX'],
  ] },
  link_daily_stats: { x: 470, y: 850, cols: [['link_id', 'int', 'PK FK'], ['day', 'date (UTC)', 'PK'], ['clicks', 'int', '']] },
};
const ROW = 24, HEAD = 34, TW = 340;
const th = (t) => HEAD + T[t].cols.length * ROW;
const colSet = { PK: '#1d4ed8', FK: '#7c3aed', UK: '#047857', IDX: '#64748b' };

function erd() {
  const s = new Svg(1290, 1060);
  for (const [name, t] of Object.entries(T)) {
    const h = th(name);
    s.add(`<rect x="${t.x}" y="${t.y}" width="${TW}" height="${h}" rx="8" fill="#fff" stroke="${C.entLine}" stroke-width="2"/>`);
    s.add(`<path d="M${t.x} ${t.y + HEAD}V${t.y + 8}a8 8 0 0 1 8-8H${t.x + TW - 8}a8 8 0 0 1 8 8V${t.y + HEAD}z" fill="${C.proc}"/>`);
    s.add(s.text(t.x + 14, t.y + HEAD / 2, name, { size: 15, weight: 700, fill: '#fff', anchor: 'start', mono: true }));
    t.cols.forEach(([n, ty, k], i) => {
      const y = t.y + HEAD + i * ROW;
      if (i % 2) s.add(`<rect x="${t.x + 1}" y="${y}" width="${TW - 2}" height="${ROW}" fill="#f8fafc"/>`);
      const key = k.split(' ')[0];
      s.add(s.text(t.x + 12, y + ROW / 2, k, { size: 10, weight: 700, fill: colSet[key] ?? C.muted, anchor: 'start' }));
      s.add(s.text(t.x + 52, y + ROW / 2, n, { size: 13, anchor: 'start', mono: true, weight: k.includes('PK') ? 700 : 400 }));
      s.add(s.text(t.x + TW - 10, y + ROW / 2, ty, { size: 11, anchor: 'end', fill: C.muted }));
    });
  }
  const card = (x, y, txt, anchor = 'middle') => s.labels.push(`<g stroke="#fff" stroke-width="4" paint-order="stroke">${s.text(x, y, txt, { size: 12, weight: 700, fill: C.blue, anchor })}</g>`);
  const line = (pts, label, lx, ly, a, b) => {
    s.add(`<path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ')}" fill="none" stroke="${C.flow}" stroke-width="1.8"/>`);
    if (label) s.labels.push(`<g stroke="#fff" stroke-width="5" paint-order="stroke">${s.text(lx, ly, label, { size: 12, fill: C.muted })}</g>`);
    card(...a); card(...b);
  };
  const U = T.users, L = T.links;
  const SSO = T.sso_identities, API = T.api_keys, AUD = T.audit_logs, BLK = T.blocked_domains, CLK = T.clicks, DAY = T.link_daily_stats;
  const ub = U.y + th('users'), lb = L.y + th('links');
  line([[U.x, 100], [SSO.x + TW, 100]], 'ตัวตน SSO', 435, 80, [U.x - 12, 94, '1'], [SSO.x + TW + 12, 94, 'N']);
  line([[U.x + TW, 100], [API.x, 100]], 'ออก key', 895, 80, [U.x + TW + 12, 94, '1'], [API.x - 12, 94, 'N']);
  line([[U.x + TW / 2, ub], [L.x + TW / 2, L.y]], 'สร้าง (guest: user_id = NULL)', U.x + TW / 2 + 12, 335, [U.x + TW / 2 + 14, ub + 14, '0..1'], [L.x + TW / 2 + 12, L.y - 8, 'N'], 'start');
  line([[U.x + 50, ub], [U.x + 50, 310], [AUD.x + TW / 2, 310], [AUD.x + TW / 2, AUD.y]], 'ผู้กระทำ', 300, 298, [U.x + 62, ub + 14, '0..1'], [AUD.x + TW / 2 + 12, AUD.y - 8, 'N']);
  line([[U.x + TW - 50, ub], [U.x + TW - 50, 310], [BLK.x + TW / 2, 310], [BLK.x + TW / 2, BLK.y]], 'ผู้บล็อก', 880, 298, [U.x + TW - 38, ub + 14, '0..1'], [BLK.x + TW / 2 + 12, BLK.y - 8, 'N']);
  line([[L.x, lb - 40], [CLK.x + TW / 2, lb - 40], [CLK.x + TW / 2, CLK.y]], 'คลิกดิบ (เก็บ 90 วัน)', 300, lb - 52, [L.x - 12, lb - 46, '1'], [CLK.x + TW / 2 + 12, CLK.y - 8, 'N']);
  line([[L.x + TW / 2, lb], [DAY.x + TW / 2, DAY.y]], 'สรุปรายวัน (เก็บถาวร)', L.x + TW / 2 + 12, lb + 30, [L.x + TW / 2 + 12, lb + 14, '1'], [DAY.x + TW / 2 + 12, DAY.y - 8, 'N'], 'start');
  // legend
  const lx = 900, ly = 800;
  s.add(`<rect x="${lx}" y="${ly}" width="360" height="236" rx="8" fill="#f8fafc" stroke="${C.line}"/>`);
  s.add(s.text(lx + 16, ly + 24, 'สัญลักษณ์', { size: 14, weight: 700, anchor: 'start' }));
  [['PK', 'Primary key'], ['FK', 'Foreign key'], ['UK', 'Unique'], ['IDX', 'มี index ค้นหา'], ['?', 'ว่างได้ (nullable)'], ['1 / N / 0..1', 'ความสัมพันธ์ (cardinality)']].forEach(([k, d], i) => {
    s.add(s.text(lx + 16, ly + 52 + i * 22, k, { size: 12, weight: 700, anchor: 'start', fill: colSet[k] ?? C.blue }));
    s.add(s.text(lx + 110, ly + 52 + i * 22, d, { size: 12, anchor: 'start', fill: C.muted }));
  });
  s.add(s.text(lx + 16, ly + 196, ['ON DELETE: users → sso_identities/api_keys = CASCADE', 'users → links/audit_logs/blocked_domains = SET NULL', 'links → clicks/link_daily_stats = CASCADE'], { size: 11, anchor: 'start', fill: C.muted, lh: 15 }));
  return s.render('ER Diagram');
}

/* ---------- Architecture ---------- */
function arch() {
  const s = new Svg(1360, 740);
  const box = (x, y, w, h, title, lines, fill = C.ent, stroke = C.entLine) => {
    s.add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
    s.add(s.text(x + w / 2, y + 26, title, { size: 15, weight: 700, fill: stroke }));
    s.add(s.text(x + w / 2, y + 54 + ((lines.length - 1) * 16) / 2, lines, { size: 12, fill: C.muted, lh: 16 }));
    return { t: 'r', x, y, w, h };
  };
  const BR = box(20, 250, 230, 90, 'เบราว์เซอร์', ['ผู้ใช้ · ผู้เข้าชมลิงก์']);
  const CLI = box(20, 420, 230, 90, 'CLI  surl', ['API key  surl_…']);
  const FE = box(330, 20, 300, 120, 'Frontend (Next.js static)', ['Cloudflare Workers assets', 'shorturl.kittametdev.com', 'หน้าเว็บ · /docs']);
  const GG = box(1030, 20, 300, 100, 'Google', ['OpenID Connect + PKCE'], C.ext, C.extLine);
  const CORE = box(330, 270, 300, 130, 'core-api  :4000', ['api.kittametdev.com', 'Auth (SSO/JWT) · Links · QR', 'Admin · API keys · Guest']);
  const RED = box(680, 270, 300, 130, 'redirect-service  :4001', ['s.kittametdev.com', 'GET /:code → 302', 'รหัสผ่าน · จำกัดคลิก · วันเริ่ม']);
  const ANA = box(1030, 270, 300, 130, 'analytics-service  :4002', ['ดึงคิวคลิก → เขียน DB', 'ให้สถิติ (x-internal-key)', 'ไม่เปิดสู่สาธารณะ']);
  s.add(`<rect x="320" y="520" width="1020" height="200" rx="16" fill="#f8fafc" stroke="${C.line}" stroke-dasharray="6 4"/>`);
  s.add(s.text(335, 540, 'Data layer', { size: 12, weight: 700, fill: C.muted, anchor: 'start' }));
  const PG = box(350, 560, 440, 130, 'PostgreSQL 16 (Neon)', ['users · sso_identities · api_keys · links', 'clicks · link_daily_stats', 'audit_logs · blocked_domains'], C.store, C.storeLine);
  const RDS = box(880, 560, 430, 130, 'Redis 7 (Upstash)', ['cache link:{code} · session rt:/bl:', 'rate limit · ตัวนับ lim:{id}', 'คิว clicks:queue'], C.store, C.storeLine);
  s.link(BR, FE, 'โหลดหน้าเว็บ', { lt: 0.5, ldx: -48, ldy: -6 });
  s.link(BR, CORE, 'fetch /api/*', { lt: 0.5, ldy: -14 });
  s.link(CLI, CORE, 'x-api-key', { lt: 0.5, ldx: -22, ldy: 14 });
  s.flow([[135, 250], [135, 205], [780, 205], [780, 270]], 'เปิดลิงก์สั้น  s.kittametdev.com/:code', 450, 192);
  s.flow([[560, 270], [560, 235], [1130, 235], [1130, 270]], 'ขอสถิติ (x-internal-key)', 870, 248);
  s.link(CORE, GG, 'OIDC code exchange', { dash: true, lt: 0.35, ldx: 90, ldy: -42 });
  s.link(RED, ANA, 'ping /internal/flush', { lt: 0.5, ldy: -14 });
  s.link(CORE, PG, 'Prisma', { lt: 0.5, ldx: -30 });
  s.link(CORE, RDS, 'session · rate limit · ลบ cache', { both: true, lt: 0.3, ldx: 80, ldy: -6 });
  s.link(RED, PG, 'cache miss: SELECT', { dash: true, lt: 0.55, ldx: -60 });
  s.link(RED, RDS, 'cache · นับสิทธิ์ · เข้าคิว', { both: true, lt: 0.5, ldx: 70 });
  s.link(ANA, RDS, 'ดึงคิวคลิก', { lt: 0.5, ldx: 45 });
  s.link(ANA, PG, 'INSERT clicks · UPSERT daily · click_count', { lt: 0.9, ldx: 90, ldy: 14 });
  return s.render('System architecture');
}

/* ---------- ตาราง + หน้า HTML ---------- */
const page = (title, lead, body, extraNav = '') => `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Short URL By Kittamet</title>
<style>
:root{--ink:#0f172a;--muted:#475569;--line:#e2e8f0;--blue:#1d4ed8;--soft:#eff6ff}
*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--ink);font:15px/1.65 ${FONT}}
header{border-bottom:1px solid var(--line);background:#fff}
.bar{max-width:1280px;margin:0 auto;padding:10px 20px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.bar b{margin-right:14px;font-size:15px}.bar a{color:var(--muted);text-decoration:none;padding:6px 12px;border-radius:999px;font-size:14px;font-weight:500}
.bar a:hover{background:var(--soft);color:var(--blue)}.bar a.on{background:var(--blue);color:#fff}
main{max-width:1280px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:28px;margin:0 0 6px;letter-spacing:-.01em}h2{font-size:20px;margin:40px 0 4px}p.lead{color:var(--muted);margin:0 0 18px;max-width:80ch}
.sv{overflow:auto;border:1px solid var(--line);border-radius:14px;padding:6px;background:#fff;margin:12px 0}
.sv svg{display:block;height:auto;min-width:900px;width:100%}
table{border-collapse:collapse;width:100%;font-size:14px;margin:10px 0}th,td{border:1px solid var(--line);padding:8px 12px;text-align:left;vertical-align:top}
th{background:var(--soft);font-weight:600}code{font:13px ui-monospace,Menlo,Consolas,monospace;background:#f1f5f9;padding:1px 5px;border-radius:4px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-top:20px}
.card{display:block;border:1px solid var(--line);border-radius:14px;padding:18px;text-decoration:none;color:inherit}.card:hover{border-color:var(--blue);box-shadow:0 4px 18px #1d4ed81a}
.card b{display:block;font-size:17px;color:var(--blue)}.card span{color:var(--muted);font-size:14px}
ul{padding-left:20px}li{margin:3px 0}
</style></head><body>
<header><nav class="bar"><b>Short URL By Kittamet</b>${nav(extraNav)}</nav></header>
<main><h1>${esc(title)}</h1><p class="lead">${lead}</p>${body}</main></body></html>`;
const NAV = [['/docs/', 'ภาพรวม', ''], ['/docs/dfd/', 'DFD', 'dfd'], ['/docs/er/', 'ER Diagram', 'er'], ['/docs/architecture/', 'Architecture', 'architecture'], ['/', 'กลับหน้าเว็บ', 'x']];
function nav(cur) { return NAV.map(([h, l, k]) => `<a href="${h}"${k === cur ? ' class="on"' : ''}>${l}</a>`).join(''); }
const tbl = (head, rows) => `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const sv = (svg) => `<div class="sv">${svg}</div>`;

const pages = {
  '': page('เอกสารระบบ', 'ไดอะแกรมทั้งหมดวาดให้ตรงกับระบบที่ deploy อยู่ (ตาราง/โฟลว์ตามโค้ดจริง) — เปิดดูได้ทันทีโดยไม่ต้องล็อกอิน',
    `<div class="cards">
<a class="card" href="/docs/dfd/"><b>Data Flow Diagram</b><span>Level 0 · Level 1 · Level 2 (Redirect) พร้อมตารางอธิบายกระบวนการและที่เก็บข้อมูล</span></a>
<a class="card" href="/docs/er/"><b>ER Diagram</b><span>8 ตาราง คีย์ ความสัมพันธ์ และเหตุผลการออกแบบ</span></a>
<a class="card" href="/docs/architecture/"><b>Architecture</b><span>Micro-service 3 ตัว · Postgres · Redis · โดเมนและการ deploy</span></a></div>`),

  dfd: page('Data Flow Diagram', 'แสดงการไหลของข้อมูลของระบบย่อลิงก์ แบ่ง 3 ระดับ: ภาพรวม (L0) → กระบวนการหลัก (L1) → ขยายส่วน Redirect (L2) · สัญลักษณ์แบบ Yourdon/DeMarco',
    `<h2>Level 0 — Context Diagram</h2><p class="lead">ระบบทั้งหมดเป็นกระบวนการเดียว คุยกับผู้ใช้ 3 กลุ่ม และ Google (SSO)</p>${sv(dfd0())}
<h2>Level 1 — กระบวนการหลัก 6 ตัว</h2><p class="lead">แตกกระบวนการ 0 ออกเป็น 6 ตัว พร้อมที่เก็บข้อมูล D1–D6</p>${sv(dfd1())}
${tbl(['รหัส', 'กระบวนการ', 'หน้าที่', 'บริการที่ทำงานจริง'], [
  ['1.0', 'ยืนยันตัวตน', 'ล็อกอิน Google (OIDC+PKCE) / บัญชีทดสอบ · ออก JWT (15 นาที) + refresh cookie (7 วัน, หมุนทุกครั้ง, ตรวจจับการใช้ซ้ำ)', 'core-api'],
  ['2.0', 'จัดการลิงก์', 'ย่อลิงก์ (ผู้ใช้/guest), ตั้งชื่อเอง, วันหมดอายุ, รหัสผ่าน, จำกัดจำนวนคลิก, วันเริ่มใช้, ปิด/เปิด/ลบ, ตรวจโดเมนที่บล็อก', 'core-api'],
  ['3.0', 'Redirect', 'หาลิงก์จาก cache → DB, ตรวจเงื่อนไขและรหัสผ่าน, ตอบ 302 และเข้าคิวคลิก', 'redirect-service'],
  ['4.0', 'สร้าง QR', 'สร้าง QR จากลิงก์สั้น (PNG/SVG/matrix) และบันทึกสไตล์ (ลายจุด สี โลโก้ ข้อความ)', 'core-api'],
  ['5.0', 'สถิติคลิก', 'ดึงคิวคลิกเป็น batch → บันทึก clicks + สรุปรายวัน + click_count, ให้ข้อมูลกราฟ (ประเทศ อุปกรณ์ OS เบราว์เซอร์)', 'analytics-service'],
  ['6.0', 'จัดการระบบ', 'ผู้ดูแล: ดู/แบน/เปลี่ยนสิทธิ์ผู้ใช้, ปิดลิงก์, บล็อกโดเมน, ดู audit log (MODERATOR ทำได้บางส่วน)', 'core-api'],
])}
${tbl(['ที่เก็บ', 'เนื้อหา'], [
  ['D1', '<code>users</code>, <code>sso_identities</code>, <code>api_keys</code>'], ['D2', '<code>links</code>'], ['D3', '<code>clicks</code>, <code>link_daily_stats</code>'],
  ['D4', '<code>blocked_domains</code>'], ['D5', '<code>audit_logs</code>'], ['D6', 'Redis: cache ลิงก์, session/blacklist, rate limit, ตัวนับคลิก, คิวคลิก'],
])}
<h2>Level 2 — กระบวนการ 3.0 Redirect</h2><p class="lead">ขั้นตอนตอนมีคนเปิดลิงก์สั้น: หาลิงก์ → ตรวจเงื่อนไข → ตรวจรหัสผ่าน → นับสิทธิ์ → ตอบ 302</p>${sv(dfd2())}`, 'dfd'),

  er: page('ER Diagram', 'ตรงกับ <code>services/core-api/prisma/schema.prisma</code> · 8 ตาราง · ไม่เก็บรหัสผ่านผู้ใช้ (ใช้ SSO) · ไม่เก็บ IP ดิบ (เก็บ hash)',
    `${sv(erd())}
${tbl(['ประเด็น', 'การตัดสินใจ'], [
  ['<code>sso_identities</code> แยกจาก <code>users</code>', '1 คนผูกได้หลาย provider; ระบุตัวตนด้วย <code>sub</code> ไม่ใช่อีเมล'],
  ['<code>links.user_id</code> เป็น NULL ได้', 'ลิงก์ guest ไม่มีเจ้าของ (หมดอายุ 7 วัน) และเมื่อลบผู้ใช้ ลิงก์/QR ที่แจกไปแล้วยังใช้ได้'],
  ['<code>password_hash</code>', 'scrypt + salt ต่อลิงก์ ไม่ส่งออกทาง API'],
  ['<code>max_clicks</code>', 'ตัวนับจริงอยู่ใน Redis (<code>lim:{id}</code>) เพื่อนับแบบ atomic'],
  ['<code>click_count</code>', 'เก็บซ้ำใน links เพื่ออ่านเร็ว อัปเดตเป็น batch จากคิว'],
  ['<code>clicks</code> + <code>link_daily_stats</code>', 'คลิกดิบเก็บ 90 วัน; ยอดรายวันเก็บถาวรเพื่อกราฟย้อนหลัง'],
  ['<code>qr_style</code>', 'JSONB บันทึกสไตล์ QR (ไม่เก็บรูปที่อัปโหลด)'],
  ['<code>ip_hash</code>', 'sha256(ip + salt) เพื่อ PDPA'],
])}
<p class="lead">รายละเอียดเต็ม (CHECK constraint, index, key ใน Redis): <code>docs/er-diagram.md</code> ใน repository</p>`, 'er'),

  architecture: page('Architecture', 'Micro-service 3 ตัว แยกหน้าที่ชัดเจน สื่อสารกันผ่าน HTTP ภายใน และ Redis',
    `${sv(arch())}
${tbl(['บริการ', 'หน้าที่', 'ที่รัน'], [
  ['frontend', 'หน้าเว็บ (Next.js export เป็น static) + หน้าเอกสารนี้', 'Cloudflare Workers (static assets) · shorturl.kittametdev.com'],
  ['core-api', 'Auth, ลิงก์, QR, admin, API key, guest', 'Render · api.kittametdev.com'],
  ['redirect-service', 'เปิดลิงก์สั้น → 302 ให้เร็ว (cache Redis) และเข้าคิวคลิก', 'Render · s.kittametdev.com'],
  ['analytics-service', 'ประมวลผลคิวคลิก, ให้สถิติแก่ core-api', 'Render (ภายใน, ป้องกันด้วย x-internal-key)'],
  ['PostgreSQL 16', 'ข้อมูลหลักทั้งหมด', 'Neon'],
  ['Redis 7', 'cache, session, rate limit, ตัวนับ, คิว', 'Upstash'],
])}
<h2>การไหลสำคัญ</h2>
<ul><li><b>ย่อลิงก์</b> — เบราว์เซอร์ → core-api ตรวจ URL/โดเมนต้องห้าม → บันทึก <code>links</code> → ลบ cache เก่า</li>
<li><b>เปิดลิงก์</b> — redirect-service อ่าน Redis (ไม่มีค่อยอ่าน DB แล้ว cache 1 ชม.) → ตรวจเงื่อนไข → 302 → เข้าคิวคลิกแล้วแจ้ง analytics ให้ flush</li>
<li><b>สถิติ</b> — analytics ดึงคิวเป็น batch เขียนลง DB; หน้า stats เรียก core-api → analytics (ถ้าล่ม แสดงยอดรวมจาก <code>click_count</code>)</li></ul>`, 'architecture'),
};

for (const [dir, html] of Object.entries(pages)) {
  const p = join(OUT, dir);
  mkdirSync(p, { recursive: true });
  writeFileSync(join(p, 'index.html'), html);
}
console.log('สร้างเสร็จ →', OUT);
