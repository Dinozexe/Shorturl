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
      this.labels.push(`<g font-size="13" fill="${C.ink}" stroke="#fff" stroke-width="6" stroke-linejoin="round" paint-order="stroke" style="paint-order:stroke">${this.text(lx, ly, ls, { size: 13, anchor, lh: 17 })}</g>`);
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
// ที่เก็บข้อมูลวางเป็นกลุ่มใต้แต่ละกระบวนการ (ที่เก็บเดียวกันวาดซ้ำได้ใน DFD) → เส้นเป็นแนวตั้งสั้นๆ ไม่ตัดกัน
function dfd1() {
  const s = new Svg(1340, 770);
  const R = 62, PY = 300, PANEL_Y = 480, ROWH = 52, PW = 196;
  const X = { p6: 120, p1: 335, p2: 550, p3: 765, p4: 980, p5: 1195 };
  const ent = (cx, w, y, t, sub, k) => s.entity(cx - w / 2, y, w, 70, t, sub, k);
  const A = ent(X.p6, 190, 30, 'ผู้ดูแล', 'ADMIN / MODERATOR');
  const O = ent(X.p1, 190, 30, 'Google', 'SSO (OIDC)', 'ext');
  const U1 = ent(X.p2, 190, 30, 'ผู้ใช้ (USER)', 'ล็อกอินแล้ว');
  const G = ent(X.p3, 190, 30, 'ผู้เข้าชมลิงก์', 'Guest / ไม่ล็อกอิน');
  const U2 = ent((X.p4 + X.p5) / 2, 190, 30, 'ผู้ใช้ (USER)', 'ล็อกอินแล้ว');
  const P = {
    p6: s.proc(X.p6, PY, R, '6.0', 'จัดการระบบ', 'RBAC · Audit'),
    p1: s.proc(X.p1, PY, R, '1.0', 'ยืนยันตัวตน', 'SSO · JWT'),
    p2: s.proc(X.p2, PY, R, '2.0', 'จัดการลิงก์', 'ย่อ · ป้องกัน'),
    p3: s.proc(X.p3, PY, R, '3.0', 'Redirect', 'ตรวจสิทธิ์ · 302'),
    p4: s.proc(X.p4, PY, R, '4.0', 'สร้าง QR', 'สไตล์ · PNG/SVG'),
    p5: s.proc(X.p5, PY, R, '5.0', 'สถิติคลิก', 'queue → DB'),
  };
  const panel = (k, rows) => {
    rows.forEach(([id, n, sub], i) => s.store(X[k] - PW / 2, PANEL_Y + i * ROWH, PW, ROWH, id, n, sub));
    return { t: 'r', x: X[k] - PW / 2, y: PANEL_Y, w: PW, h: rows.length * ROWH };
  };
  const S = {
    p6: panel('p6', [['D1', 'users', 'แบน · เปลี่ยนสิทธิ์'], ['D2', 'links', 'ปิด/เปิดลิงก์'], ['D4', 'blocked_domains', 'บล็อก/ปลด'], ['D5', 'audit_logs', 'บันทึกกิจกรรม']]),
    p1: panel('p1', [['D1', 'users', 'sso_identities'], ['D6', 'Redis', 'session (rt/bl)']]),
    p2: panel('p2', [['D4', 'blocked_domains', 'ตรวจโดเมนต้องห้าม'], ['D2', 'links', 'บันทึก · แก้ · ลบ'], ['D6', 'Redis', 'ลบ cache']]),
    p3: panel('p3', [['D6', 'Redis', 'cache · ตัวนับ · คิวคลิก'], ['D2', 'links', 'อ่านเมื่อ cache miss']]),
    p4: panel('p4', [['D2', 'links', 'รหัสสั้น · qr_style']]),
    p5: panel('p5', [['D6', 'Redis', 'ดึงคิวคลิก'], ['D3', 'clicks', 'link_daily_stats'], ['D2', 'links', 'click_count']]),
  };
  // ผู้ใช้งาน ↔ กระบวนการ
  s.link(A, P.p6, ['คำสั่ง ↔', 'ภาพรวม · audit'], { both: true, ldx: 64 });
  s.link(O, P.p1, ['OIDC ↔', 'id_token'], { both: true, ldx: -52 });
  s.link(U1, P.p1, 'ล็อกอิน', { lt: 0.4, ldx: 34, ldy: -8 });
  s.link(U1, P.p2, ['ข้อมูลลิงก์ ↔', 'ลิงก์สั้น'], { both: true, lt: 0.62, ldx: -52 });
  s.link(G, P.p3, ['เปิด /code ↔', '302 / หน้าสถานะ'], { both: true, ldx: 70 });
  s.link(G, P.p2, ['ย่อลิงก์', 'แบบ guest'], { both: true, dash: true, lt: 0.5, ldx: -2, ldy: -22 });
  s.link(U2, P.p4, ['ขอ QR ↔ QR'], { both: true, lt: 0.5, ldx: -52, ldy: -2 });
  s.link(U2, P.p5, ['ขอสถิติ ↔', 'สถิติ'], { both: true, lt: 0.5, ldx: 56, ldy: -2 });
  // กระบวนการ ↔ ที่เก็บข้อมูล
  const sl = { p6: ['จัดการ', 'ข้อมูลระบบ'], p1: ['ผู้ใช้', 'session'], p2: ['บันทึก · ตรวจ', 'ลบ cache'], p3: ['อ่าน cache', 'เข้าคิวคลิก'], p4: ['อ่านรหัส', 'บันทึกสไตล์'], p5: ['ดึงคิว', 'บันทึกคลิก'], };
  for (const k of Object.keys(P)) s.link(P[k], S[k], sl[k], { both: true, lt: 0.5, ldx: 70 });
  s.add(s.text(670, 748, 'ลูกศรสองหัว = ข้อมูลไหลสองทาง · ที่เก็บข้อมูลเดียวกันวาดซ้ำใต้หลายกระบวนการเพื่อให้เส้นไม่ตัดกัน (D2 links และ D6 Redis ใช้ร่วมกัน)', { size: 12, fill: C.muted }));
  s.add(s.text(670, 726, '2.0 / 4.0 / 5.0 / 6.0 ต้องผ่าน 1.0 (JWT) ก่อน · 6.0 เฉพาะ ADMIN/MODERATOR · เส้นประ = ย่อลิงก์โดยไม่ล็อกอิน', { size: 12, fill: C.muted }));
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
  s.link(P[2], W, ['401 ขอรหัสผ่าน', '429 ลองผิดเกิน'], { lt: 0.5, ldx: -62 });
  s.link(P[3], W, '410 ครบจำนวนคลิก', { lt: 0.45, ldx: 95, ldy: 6 });
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
    ['id', 'uuid', 'PK'], ['email', 'text', 'UK'], ['name', 'text?', ''], ['role', 'USER|MODERATOR|ADMIN', ''], ['is_banned', 'bool', ''], ['last_login_at', 'timestamptz?', ''], ['created_at', 'timestamptz', ''],
  ] },
  sso_identities: { x: 10, y: 40, cols: [
    ['id', 'uuid', 'PK'], ['user_id', 'uuid', 'FK'], ['provider', 'google|microsoft', 'UK'], ['subject', 'text (sub)', 'UK'], ['email', 'text', ''], ['email_verified', 'bool', ''], ['created_at', 'timestamptz', ''], ['last_login_at', 'timestamptz', ''],
  ] },
  links: { x: 470, y: 380, cols: [
    ['id', 'int', 'PK'], ['user_id', 'uuid?', 'FK'], ['short_code', 'text', 'UK'], ['original_url', 'text', ''], ['original_host', 'text', 'IDX'], ['status', 'ACTIVE|DISABLED|ADMIN_DISABLED', ''],
    ['expires_at', 'timestamptz?', ''], ['starts_at', 'timestamptz?', ''], ['max_clicks', 'int?', ''], ['password_hash', 'text? (scrypt)', ''], ['qr_style', 'jsonb?', ''], ['click_count', 'int', ''], ['created_at', 'timestamptz', ''],
  ] },
  audit_logs: { x: 10, y: 400, cols: [
    ['id', 'int', 'PK'], ['actor_id', 'uuid?', 'FK'], ['action', 'enum', ''], ['target_type', 'USER|LINK|DOMAIN|API_KEY', ''], ['target_id', 'text', ''], ['detail', 'text?', ''], ['created_at', 'timestamptz', ''],
  ] },
  blocked_domains: { x: 930, y: 400, cols: [
    ['id', 'int', 'PK'], ['domain', 'text', 'UK'], ['reason', 'text', ''], ['created_by_id', 'uuid?', 'FK'], ['created_at', 'timestamptz', ''],
  ] },
  clicks: { x: 10, y: 770, cols: [
    ['id', 'bigint', 'PK'], ['link_id', 'int', 'FK'], ['ip_hash', 'sha256+salt', ''], ['user_agent', 'text?', ''], ['referer', 'text?', ''], ['country', 'char(2)?', ''], ['device', 'desktop|mobile|tablet|bot|unknown', ''], ['os', 'text?', ''], ['browser', 'text?', ''], ['clicked_at', 'timestamptz', 'IDX'],
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
  const SSO = T.sso_identities, AUD = T.audit_logs, BLK = T.blocked_domains, CLK = T.clicks, DAY = T.link_daily_stats;
  const ub = U.y + th('users'), lb = L.y + th('links');
  line([[U.x, 100], [SSO.x + TW, 100]], 'ตัวตน SSO', 435, 80, [U.x - 12, 94, '1'], [SSO.x + TW + 12, 94, 'N']);
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
  s.add(s.text(lx + 16, ly + 196, ['ON DELETE: users → sso_identities = CASCADE', 'users → links/audit_logs/blocked_domains = SET NULL', 'links → clicks/link_daily_stats = CASCADE'], { size: 11, anchor: 'start', fill: C.muted, lh: 15 }));
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
  const FE = box(330, 20, 300, 120, 'Frontend (Next.js static)', ['Cloudflare Workers assets', 'shorturl.kittametdev.com', 'หน้าเว็บ · /docs']);
  const GG = box(1030, 20, 300, 100, 'Google', ['OpenID Connect + PKCE'], C.ext, C.extLine);
  const CORE = box(330, 270, 300, 130, 'core-api  :4000', ['api.kittametdev.com', 'Auth (SSO/JWT) · Links · QR', 'Admin · Guest']);
  const RED = box(680, 270, 300, 130, 'redirect-service  :4001', ['s.kittametdev.com', 'GET /:code → 302', 'รหัสผ่าน · จำกัดคลิก · วันเริ่ม']);
  const ANA = box(1030, 270, 300, 130, 'analytics-service  :4002', ['ดึงคิวคลิก → เขียน DB', 'ให้สถิติ (x-internal-key)', 'ไม่เปิดสู่สาธารณะ']);
  s.add(`<rect x="320" y="520" width="1020" height="200" rx="16" fill="#f8fafc" stroke="${C.line}" stroke-dasharray="6 4"/>`);
  s.add(s.text(335, 540, 'Data layer', { size: 12, weight: 700, fill: C.muted, anchor: 'start' }));
  const PG = box(350, 560, 440, 130, 'PostgreSQL 16 (Neon)', ['users · sso_identities · links', 'clicks · link_daily_stats', 'audit_logs · blocked_domains'], C.store, C.storeLine);
  const RDS = box(880, 560, 430, 130, 'Redis 7 (Upstash)', ['cache link:{code} · session rt:/bl:', 'rate limit · ตัวนับ lim:{id}', 'คิว clicks:queue'], C.store, C.storeLine);
  s.link(BR, FE, 'โหลดหน้าเว็บ', { lt: 0.5, ldx: -48, ldy: -6 });
  s.link(BR, CORE, 'fetch /api/*', { lt: 0.5, ldy: -14 });
  s.flow([[135, 250], [135, 205], [780, 205], [780, 270]], 'เปิดลิงก์สั้น  s.kittametdev.com/:code', 450, 192);
  s.flow([[560, 270], [560, 235], [1130, 235], [1130, 270]], 'ขอสถิติ (x-internal-key)', 870, 248);
  s.link(CORE, GG, 'OIDC code exchange', { dash: true, lt: 0.35, ldx: 90, ldy: -42 });
  s.link(RED, ANA, 'ping /internal/flush', { lt: 0.5, ldy: -14 });
  s.link(CORE, PG, 'Prisma', { lt: 0.5, ldx: -30 });
  s.link(CORE, RDS, 'session · rate limit · ลบ cache', { both: true, lt: 0.3, ldx: 80, ldy: -6 });
  s.link(RED, PG, 'cache miss: SELECT', { dash: true, lt: 0.55, ldx: -60 });
  s.link(RED, RDS, 'cache · นับสิทธิ์ · เข้าคิว', { both: true, lt: 0.5, ldx: 70 });
  s.link(ANA, RDS, 'ดึงคิวคลิก', { lt: 0.5, ldx: 45 });
  s.link(ANA, PG, 'INSERT clicks · UPSERT daily · click_count', { lt: 0.22, ldx: 120, ldy: 6 });
  return s.render('System architecture');
}

/* ---------- หน้า HTML ---------- */
const REPO = 'https://github.com/Dinozexe/Shorturl';
const NAV = [['/docs/', 'ภาพรวม', ''], ['/docs/dfd/', 'DFD', 'dfd'], ['/docs/er/', 'ER Diagram', 'er'], ['/docs/architecture/', 'Architecture', 'architecture']];
const ORDER = ['', 'dfd', 'er', 'architecture'];
const TITLES = { '': 'เอกสารระบบ', dfd: 'Data Flow Diagram', er: 'ER Diagram', architecture: 'Architecture' };
const href = (k) => (k ? `/docs/${k}/` : '/docs/');

const CSS = `
:root{--ink:#0f172a;--muted:#475569;--line:#e2e8f0;--blue:#1d4ed8;--soft:#eff6ff;--r:14px}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:76px}
body{margin:0;background:#fff;color:var(--ink);font:16px/1.7 ${FONT};-webkit-text-size-adjust:100%}
a{color:var(--blue)}a:focus-visible,summary:focus-visible{outline:3px solid #93c5fd;outline-offset:2px;border-radius:6px}
.skip{position:absolute;left:-999px;top:8px;background:var(--blue);color:#fff;padding:8px 14px;border-radius:8px;z-index:10}.skip:focus{left:8px}
header{position:sticky;top:0;z-index:5;background:#fffffff0;backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.bar{max-width:1200px;margin:0 auto;padding:10px 20px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px;margin-right:auto;text-decoration:none;color:var(--ink);font-weight:700}
.brand img{width:32px;height:32px;border-radius:50%}.brand small{display:block;font-weight:400;color:var(--muted);font-size:12px;line-height:1.1}
nav.tabs{display:flex;gap:4px;flex-wrap:wrap}
nav.tabs a{padding:7px 14px;border-radius:999px;text-decoration:none;color:var(--muted);font-size:14px;font-weight:500}
nav.tabs a:hover{background:var(--soft);color:var(--blue)}nav.tabs a[aria-current=page]{background:var(--blue);color:#fff}
.back{font-size:14px;text-decoration:none;padding:7px 12px;border:1px solid var(--line);border-radius:999px;color:var(--ink)}.back:hover{border-color:var(--blue);color:var(--blue)}
main{max-width:1200px;margin:0 auto;padding:32px 20px 72px}
h1{font-size:clamp(26px,4vw,34px);line-height:1.25;margin:0 0 8px;letter-spacing:-.01em}
h2{font-size:22px;margin:0 0 4px;line-height:1.3}h3{font-size:17px;margin:28px 0 8px}
.lead{color:var(--muted);margin:0 0 20px;max-width:70ch}
.layout{display:grid;grid-template-columns:minmax(0,1fr);gap:0 40px}
.toc{margin:0 0 8px;padding:0;list-style:none;display:flex;gap:2px;overflow-x:auto;border-bottom:1px solid var(--line);scrollbar-width:none}
.toc::-webkit-scrollbar{display:none}
.toc a{display:block;white-space:nowrap;padding:10px 14px;text-decoration:none;font-size:14px;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-1px}
.toc a:hover{color:var(--ink)}.toc a.on{color:var(--blue);border-bottom-color:var(--blue);font-weight:600}
@media(min-width:1040px){.layout{grid-template-columns:200px minmax(0,1fr)}
.toc{position:sticky;top:84px;align-self:start;flex-direction:column;border:0;border-left:1px solid var(--line);margin:44px 0 0;overflow:visible}
.toc a{border:0;margin:0 0 0 -1px;padding:6px 14px;border-left:2px solid transparent}.toc a.on{border-left-color:var(--blue)}
.toc::before{content:'ในหน้านี้';display:block;padding:0 14px 8px;font-size:12px;font-weight:600;color:var(--muted)}}
section.d{margin-top:44px}
figure{margin:14px 0 0}.sv{overflow:auto;border:1px solid var(--line);border-radius:var(--r);background:#fff}
.sv svg{display:block;width:100%;height:auto;min-width:820px}
figcaption{display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between;color:var(--muted);font-size:14px;margin-top:8px}
figcaption a{font-weight:500}
.tw{overflow-x:auto;margin:16px 0}table{border-collapse:collapse;width:100%;font-size:15px;min-width:560px}
th,td{border-bottom:1px solid var(--line);padding:10px 12px;text-align:left;vertical-align:top}th{background:var(--soft);font-weight:600;white-space:nowrap}
code{font:13px ui-monospace,Menlo,Consolas,monospace;background:#f1f5f9;padding:1px 6px;border-radius:5px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px;margin:24px 0 8px}
.card{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:var(--r);text-decoration:none;color:inherit;overflow:hidden;transition:border-color .15s,box-shadow .15s}
.card:hover{border-color:var(--blue);box-shadow:0 6px 24px #1d4ed81f}
.thumb{height:190px;overflow:hidden;background:#f8fafc;border-bottom:1px solid var(--line);position:relative}
.thumb svg{position:absolute;left:0;top:0;width:100%;height:auto;pointer-events:none}
.card .t{padding:16px 18px 18px}.card b{display:block;font-size:18px;color:var(--blue)}.card span{color:var(--muted);font-size:15px}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:12px}
.fact{border:1px solid var(--line);border-radius:var(--r);padding:14px 16px}.fact b{display:block;margin-bottom:2px}.fact span{color:var(--muted);font-size:15px}
ul.flows{padding-left:20px;margin:8px 0}ul.flows li{margin:6px 0}
.pn{display:flex;justify-content:space-between;gap:12px;margin-top:56px;padding-top:20px;border-top:1px solid var(--line);flex-wrap:wrap}
.pn a{text-decoration:none;border:1px solid var(--line);border-radius:12px;padding:10px 16px;font-weight:500}.pn a:hover{border-color:var(--blue)}
footer{max-width:1200px;margin:0 auto;padding:0 20px 40px;color:var(--muted);font-size:14px}
@media(max-width:640px){main{padding-top:22px}.bar{gap:6px}.brand small{display:none}.thumb{height:150px}}
@media print{header,.pn,.toc,.back{display:none}.sv{overflow:visible;border:0}.sv svg{min-width:0}}
`;

function shell(key, body) {
  const title = TITLES[key];
  const i = ORDER.indexOf(key);
  const prev = ORDER[i - 1], next = ORDER[i + 1];
  const pn = `<div class="pn">${prev !== undefined ? `<a href="${href(prev)}" rel="prev">← ${TITLES[prev]}</a>` : '<span></span>'}${next !== undefined ? `<a href="${href(next)}" rel="next">${TITLES[next]} →</a>` : '<span></span>'}</div>`;
  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Short URL By Kittamet</title>
<meta name="description" content="${esc(DESC[key])}"><link rel="icon" href="/logo-128.png"><meta name="theme-color" content="#1d4ed8">
<style>${CSS}</style></head><body>
<a class="skip" href="#main">ข้ามไปเนื้อหา</a>
<header><div class="bar">
<a class="brand" href="/docs/"><img src="/logo-128.png" alt="" width="32" height="32"><span>Short URL<small>เอกสารระบบ</small></span></a>
<nav class="tabs" aria-label="เอกสาร">${NAV.map(([h, l, k]) => `<a href="${h}"${k === key ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
<a class="back" href="/">เปิดเว็บ</a></div></header>
<main id="main">${body}${pn}</main>
<footer>วาดจากโค้ดจริงของระบบ · <a href="${REPO}">ซอร์สโค้ดบน GitHub</a></footer>
<script>(function(){var l=[].slice.call(document.querySelectorAll('.toc a'));if(!l.length||!('IntersectionObserver' in window))return;var m={};l.forEach(function(a){m[a.getAttribute('href').slice(1)]=a});var o=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){l.forEach(function(a){a.classList.remove('on')});m[e.target.id].classList.add('on')}})},{rootMargin:'-20% 0px -70% 0px'});Object.keys(m).forEach(function(id){var n=document.getElementById(id);if(n)o.observe(n)});l[0].classList.add('on')})();</script></body></html>`;
}
const DESC = {
  '': 'เอกสารระบบ Short URL: DFD, ER Diagram และ Architecture',
  dfd: 'Data Flow Diagram ระดับ 0, 1 และ 2 ของระบบย่อลิงก์ Short URL',
  er: 'ER Diagram 7 ตารางของระบบย่อลิงก์ Short URL',
  architecture: 'สถาปัตยกรรม micro-service ของระบบย่อลิงก์ Short URL',
};

const tbl = (head, rows) => `<div class="tw"><table><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
// รูปแต่ละภาพ: ฝังในหน้า + มีไฟล์ .svg แยกให้เปิดเต็มจอ/ดาวน์โหลด
const files = {};
function fig(id, h2, lead, svg, file, alt) {
  files[file] = svg;
  return `<section class="d" id="${id}"><h2>${h2}</h2><p class="lead">${lead}</p>
<figure><div class="sv" role="img" aria-label="${esc(alt)}" tabindex="0">${svg.replace(/ role="img" aria-label="[^"]*"/, '')}</div>
<figcaption><span>เลื่อนซ้าย-ขวาถ้าภาพกว้างกว่าจอ</span><span><a href="${file}" target="_blank" rel="noopener">เปิดภาพเต็ม</a> · <a href="${file}" download>ดาวน์โหลด SVG</a></span></figcaption></figure></section>`;
}
const toc = (items) => `<ul class="toc" aria-label="ในหน้านี้">${items.map(([id, l]) => `<li><a href="#${id}">${l}</a></li>`).join('')}</ul>`;
const layout = (items, inner) => `<div class="layout">${toc(items)}<div class="content">${inner}</div></div>`;
const thumb = (svg) => `<div class="thumb" aria-hidden="true">${svg.replace(/ role="img" aria-label="[^"]*"/, '')}</div>`;

const D0 = dfd0(), D1 = dfd1(), D2 = dfd2(), ER = erd(), AR = arch();

const pages = {
  '': shell('', `<h1>เอกสารระบบ</h1>
<p class="lead">ระบบย่อลิงก์ที่ทำงานจริง: ย่อลิงก์ สร้าง QR ดูประวัติและสถิติการคลิก ไดอะแกรมด้านล่างวาดจากโค้ดที่ deploy อยู่ เปิดดูได้โดยไม่ต้องล็อกอิน</p>
<div class="cards">
<a class="card" href="/docs/dfd/">${thumb(D1)}<div class="t"><b>Data Flow Diagram</b><span>การไหลของข้อมูล 3 ระดับ: ภาพรวม → 6 กระบวนการ → ขั้นตอน Redirect</span></div></a>
<a class="card" href="/docs/er/">${thumb(ER)}<div class="t"><b>ER Diagram</b><span>7 ตาราง คีย์ ความสัมพันธ์ และเหตุผลการออกแบบ</span></div></a>
<a class="card" href="/docs/architecture/">${thumb(AR)}<div class="t"><b>Architecture</b><span>Micro-service 3 ตัว ฐานข้อมูล Redis และการ deploy</span></div></a>
</div>
<h2 style="margin-top:40px">ระบบโดยย่อ</h2>
<div class="facts">
<div class="fact"><b>3 service แยกหน้าที่</b><span>core-api (ลิงก์/บัญชี) · redirect-service (เปิดลิงก์เร็ว) · analytics-service (สถิติ)</span></div>
<div class="fact"><b>เปิดลิงก์ไม่รอฐานข้อมูล</b><span>อ่านจาก Redis cache และเก็บคลิกผ่านคิว ไม่เขียน DB ระหว่าง redirect</span></div>
<div class="fact"><b>เข้าสู่ระบบด้วย Google</b><span>ไม่เก็บรหัสผ่านผู้ใช้ · ย่อลิงก์แบบไม่ล็อกอินได้ (ใช้ได้ 7 วัน)</span></div>
<div class="fact"><b>ป้องกันลิงก์ได้</b><span>รหัสผ่าน · จำกัดจำนวนครั้ง · วันเริ่มใช้ · วันหมดอายุ</span></div>
</div>`),

  dfd: shell('dfd', `<h1>Data Flow Diagram</h1>
<p class="lead">แสดงว่าข้อมูลไหลระหว่างผู้ใช้ ระบบ และที่เก็บข้อมูลอย่างไร แบ่ง 3 ระดับ ใช้สัญลักษณ์ Yourdon/DeMarco: วงกลม = กระบวนการ, สี่เหลี่ยม = ผู้ใช้งาน/ระบบภายนอก, เส้นคู่ขนาน = ที่เก็บข้อมูล</p>
<div class="layout">${toc([['l0', 'Level 0'], ['l1', 'Level 1'], ['procs', 'กระบวนการและที่เก็บข้อมูล'], ['l2', 'Level 2 · Redirect']])}<div class="content">
${fig('l0', 'Level 0 — ภาพรวมระบบ', 'ระบบทั้งหมดเป็นกระบวนการเดียว คุยกับผู้ใช้ 3 กลุ่มและ Google', D0, 'dfd-level0.svg', 'DFD Level 0')}
${fig('l1', 'Level 1 — 6 กระบวนการหลัก', 'แตกกระบวนการ 0 ออกเป็น 6 ตัว พร้อมที่เก็บข้อมูล D1–D6', D1, 'dfd-level1.svg', 'DFD Level 1')}
<section class="d" id="procs"><h2>กระบวนการและที่เก็บข้อมูล</h2>
${tbl(['รหัส', 'กระบวนการ', 'หน้าที่', 'ทำงานที่'], [
  ['1.0', 'ยืนยันตัวตน', 'ล็อกอิน Google (OIDC + PKCE) หรือบัญชีทดสอบ ออก JWT อายุ 15 นาทีและ refresh cookie 7 วัน (หมุนทุกครั้ง ตรวจจับการใช้ซ้ำ)', 'core-api'],
  ['2.0', 'จัดการลิงก์', 'ย่อลิงก์ (ผู้ใช้/guest) ตั้งชื่อเอง วันหมดอายุ รหัสผ่าน จำกัดคลิก วันเริ่มใช้ ปิด/เปิด/ลบ และตรวจโดเมนที่บล็อก', 'core-api'],
  ['3.0', 'Redirect', 'หาลิงก์จาก cache → DB ตรวจเงื่อนไขและรหัสผ่าน ตอบ 302 แล้วเข้าคิวคลิก', 'redirect-service'],
  ['4.0', 'สร้าง QR', 'สร้าง QR จากลิงก์สั้น (PNG/SVG/matrix) และบันทึกสไตล์ที่ตั้ง', 'core-api'],
  ['5.0', 'สถิติคลิก', 'ดึงคิวคลิกเป็น batch → บันทึก clicks + สรุปรายวัน + click_count และให้ข้อมูลกราฟ', 'analytics-service'],
  ['6.0', 'จัดการระบบ', 'ดู/แบน/เปลี่ยนสิทธิ์ผู้ใช้ ปิดลิงก์ บล็อกโดเมน ดู audit log (MODERATOR ทำได้บางส่วน)', 'core-api'],
])}
${tbl(['ที่เก็บ', 'เนื้อหา'], [
  ['D1', '<code>users</code>, <code>sso_identities</code>'], ['D2', '<code>links</code>'], ['D3', '<code>clicks</code>, <code>link_daily_stats</code>'],
  ['D4', '<code>blocked_domains</code>'], ['D5', '<code>audit_logs</code>'], ['D6', 'Redis: cache ลิงก์, session/blacklist, rate limit, ตัวนับคลิก, คิวคลิก'],
])}</section>
${fig('l2', 'Level 2 — กระบวนการ 3.0 Redirect', 'ตอนมีคนเปิดลิงก์สั้น: หาลิงก์ → ตรวจเงื่อนไข → ตรวจรหัสผ่าน → นับสิทธิ์ → ตอบ 302', D2, 'dfd-level2-redirect.svg', 'DFD Level 2 กระบวนการ Redirect')}</div></div>`),

  er: shell('er', `<h1>ER Diagram</h1>
<p class="lead">ตรงกับ <code>services/core-api/prisma/schema.prisma</code> · 7 ตาราง · ไม่เก็บรหัสผ่านผู้ใช้ (ใช้ SSO) · ไม่เก็บ IP ดิบ (เก็บ hash)</p>
<div class="layout">${toc([['erd', 'แผนภาพ'], ['notes', 'เหตุผลการออกแบบ']])}<div class="content">
${fig('erd', 'ความสัมพันธ์ระหว่างตาราง', 'PK = primary key · FK = foreign key · UK = unique · ? = ว่างได้', ER, 'er-diagram.svg', 'ER Diagram')}
<section class="d" id="notes"><h2>เหตุผลการออกแบบ</h2>
${tbl(['ประเด็น', 'การตัดสินใจ'], [
  ['<code>sso_identities</code> แยกจาก <code>users</code>', '1 คนผูกได้หลาย provider ระบุตัวตนด้วย <code>sub</code> ไม่ใช่อีเมล'],
  ['<code>links.user_id</code> เป็น NULL ได้', 'ลิงก์ guest ไม่มีเจ้าของ (หมดอายุ 7 วัน) และเมื่อลบผู้ใช้ ลิงก์/QR ที่แจกไปแล้วยังใช้ได้'],
  ['<code>password_hash</code>', 'scrypt + salt ต่อลิงก์ ไม่ส่งออกทาง API'],
  ['<code>max_clicks</code>', 'ตัวนับจริงอยู่ใน Redis (<code>lim:{id}</code>) เพื่อนับแบบ atomic'],
  ['<code>click_count</code>', 'เก็บซ้ำใน links เพื่ออ่านเร็ว อัปเดตเป็น batch จากคิว'],
  ['<code>clicks</code> + <code>link_daily_stats</code>', 'คลิกดิบเก็บ 90 วัน ยอดรายวันเก็บถาวรเพื่อกราฟย้อนหลัง'],
  ['<code>qr_style</code>', 'JSONB บันทึกสไตล์ QR (ไม่เก็บรูปที่อัปโหลด)'],
  ['<code>ip_hash</code>', 'sha256(ip + salt) เพื่อ PDPA'],
])}
<p>รายละเอียดเต็ม (CHECK constraint, index, key ใน Redis) อยู่ที่ <a href="${REPO}/blob/main/docs/er-diagram.md">docs/er-diagram.md</a></p></section></div></div>`),

  architecture: shell('architecture', `<h1>Architecture</h1>
<p class="lead">Micro-service 3 ตัวแยกหน้าที่ชัดเจน คุยกันผ่าน HTTP ภายในและ Redis</p>
<div class="layout">${toc([['diagram', 'แผนภาพ'], ['services', 'บริการ'], ['flows', 'การไหลสำคัญ']])}<div class="content">
${fig('diagram', 'ภาพรวมสถาปัตยกรรม', 'ลูกศรประ = การเข้าถึงรอง (cache miss, OIDC)', AR, 'architecture.svg', 'Architecture')}
<section class="d" id="services"><h2>บริการ</h2>
${tbl(['บริการ', 'หน้าที่', 'ที่รัน'], [
  ['frontend', 'หน้าเว็บ (Next.js export เป็น static) และหน้าเอกสารนี้', 'Cloudflare Workers · shorturl.kittametdev.com'],
  ['core-api', 'Auth, ลิงก์, QR, admin, guest', 'Render · api.kittametdev.com'],
  ['redirect-service', 'เปิดลิงก์สั้น → 302 เร็ว (cache Redis) และเข้าคิวคลิก', 'Render · s.kittametdev.com'],
  ['analytics-service', 'ประมวลผลคิวคลิก ให้สถิติแก่ core-api', 'Render (ภายใน ป้องกันด้วย x-internal-key)'],
  ['PostgreSQL 16', 'ข้อมูลหลักทั้งหมด', 'Neon'],
  ['Redis 7', 'cache, session, rate limit, ตัวนับ, คิว', 'Upstash'],
])}</section>
<section class="d" id="flows"><h2>การไหลสำคัญ</h2>
<ul class="flows"><li><b>ย่อลิงก์</b> — เบราว์เซอร์ → core-api ตรวจ URL/โดเมนต้องห้าม → บันทึก <code>links</code> → ลบ cache เก่า</li>
<li><b>เปิดลิงก์</b> — redirect-service อ่าน Redis (ไม่มีค่อยอ่าน DB แล้ว cache 1 ชั่วโมง) → ตรวจเงื่อนไข → 302 → เข้าคิวคลิกแล้วแจ้ง analytics ให้ flush</li>
<li><b>สถิติ</b> — analytics ดึงคิวเป็น batch เขียนลง DB หน้า stats เรียก core-api → analytics (ถ้าล่ม แสดงยอดรวมจาก <code>click_count</code>)</li></ul></section></div></div>`),
};

for (const [dir, html] of Object.entries(pages)) {
  const p = join(OUT, dir);
  mkdirSync(p, { recursive: true });
  writeFileSync(join(p, 'index.html'), html);
  for (const [f, svg] of Object.entries(files)) if (html.includes(`href="${f}"`)) writeFileSync(join(p, f), svg.replace('<svg ', '<svg xmlns:xlink="http://www.w3.org/1999/xlink" '));
}
console.log('สร้างเสร็จ →', OUT);
