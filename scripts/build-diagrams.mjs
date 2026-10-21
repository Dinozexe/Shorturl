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

/* ---------- ขึ้นบรรทัดใหม่ของป้ายบนเส้น ---------- */
// ไทยไม่มีเว้นวรรคให้ตัดคำ จึงตัดที่ "จุดพักที่ผู้เขียนกำหนด" เท่านั้น: ตัวคั่น ' · ' และขอบของแต่ละสมาชิกในอาร์เรย์
// แล้วบรรจุแบบ greedy ให้แต่ละบรรทัดไม่เกินความกว้าง (ประมาณจากจำนวนตัวอักษรที่ไม่ใช่สระ/วรรณยุกต์ลอย)
const MARKS = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g;
const textWidth = (t, size = 13) => t.replace(MARKS, '').length * size * 0.54;
function wrapLabel(label, maxPx, size = 13) {
  const items = Array.isArray(label) ? label : [label];
  const units = [];
  items.forEach((it) => String(it).split(' · ').forEach((part, i) => units.push({ t: part, sep: ' · ' })));
  const lines = [];
  let line = '';
  const flush = () => line && lines.push(line);
  for (const u of units) {
    const cand = line ? line + u.sep + u.t : u.t;
    if (!line || textWidth(cand, size) <= maxPx) line = cand;
    else {
      flush();
      line = u.t;
    }
  }
  flush();
  // หน่วยเดียวที่ยาวเกิน: ตัดที่ช่องว่างภายใน
  return lines.flatMap((l) => {
    if (textWidth(l, size) <= maxPx || !l.includes(' ')) return [l];
    const out = [];
    let cur = '';
    for (const w of l.split(' ')) {
      const c = cur ? `${cur} ${w}` : w;
      if (!cur || textWidth(c, size) <= maxPx) cur = c;
      else {
        out.push(cur);
        cur = w;
      }
    }
    out.push(cur);
    return out;
  });
}

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
  // ผู้ใช้งาน/ระบบภายนอก (Gane-Sarson): สี่เหลี่ยมมีเงา · dup = มุมตัดแสดงว่าวาดซ้ำ
  entity(x, y, w, h, title, sub, kind = 'ent', dup = false) {
    const [f, s] = kind === 'ext' ? [C.ext, C.extLine] : [C.ent, C.entLine];
    this.add(`<rect x="${x + 4}" y="${y + 4}" width="${w}" height="${h}" fill="#cbd5e1"/>`);
    this.add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" stroke="${s}" stroke-width="2"/>`);
    if (dup) this.add(`<path d="M${x} ${y + h - 14}L${x + 14} ${y + h}H${x}z" fill="${s}"/>`);
    this.add(this.text(x + w / 2, y + h / 2 - (sub ? 8 : 0), title, { size: 15, weight: 700, fill: s }));
    if (sub) this.add(this.text(x + w / 2, y + h / 2 + 12, sub, { size: 12, fill: C.muted }));
    return { t: 'r', x, y, w, h };
  }
  // กระบวนการ (Gane-Sarson): สี่เหลี่ยมมุมมน แถบบนเป็นรหัส ตัวกลางเป็นชื่อ
  gs(x, y, w, h, id, name, sub) {
    this.add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#fff" stroke="${C.proc}" stroke-width="2.4"/>`);
    this.add(`<path d="M${x} ${y + 26}V${y + 12}a12 12 0 0 1 12-12H${x + w - 12}a12 12 0 0 1 12 12V${y + 26}z" fill="${C.proc}"/>`);
    this.add(this.text(x + w / 2, y + 13, id, { size: 13, weight: 700, fill: '#fff' }));
    this.add(this.text(x + w / 2, y + 26 + (h - 26) / 2 - (sub ? 8 : 0), name, { size: 15, weight: 700 }));
    if (sub) this.add(this.text(x + w / 2, y + 26 + (h - 26) / 2 + 12, sub, { size: 11.5, fill: C.muted }));
    return { t: 'r', x, y, w, h };
  }
  // ลูกศรคู่แนวตั้ง: `down` ไปทางล่าง (ซ้าย) / `up` ไปทางบน (ขวา) ป้ายอยู่ข้างเส้นของตัวเอง
  vpair(x, yTop, yBot, down, up, { gap = 12, dash = false } = {}) {
    const ym = (yTop + yBot) / 2;
    this.flow([[x - gap, yTop], [x - gap, yBot]], down, x - gap - 7, ym, { anchor: 'end', dash });
    this.flow([[x + gap, yBot], [x + gap, yTop]], up, x + gap + 7, ym, { anchor: 'start', dash });
  }
  // ลูกศรคู่แนวนอน: `right` อยู่เหนือเส้น, `left` อยู่ใต้เส้น
  hpair(y, xL, xR, right, left, { gap = 14 } = {}) {
    const xm = (xL + xR) / 2, n = (l) => (Array.isArray(l) ? l.length : 1);
    this.flow([[xL, y - gap], [xR, y - gap]], right, xm, y - gap - 10 - (n(right) - 1) * 8.5, {});
    this.flow([[xR, y + gap], [xL, y + gap]], left, xm, y + gap + 14 + (n(left) - 1) * 8.5, {});
  }
  proc(cx, cy, r, id, name, sub, big = false) {
    this.add(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.proc}" stroke="#1e3a8a" stroke-width="2"/>`);
    this.add(this.text(cx, cy - r * 0.52, id, { size: big ? 18 : 13, weight: 700, fill: '#bfdbfe' }));
    this.add(`<line x1="${cx - r * 0.7}" x2="${cx + r * 0.7}" y1="${cy - r * 0.34}" y2="${cy - r * 0.34}" stroke="#93c5fd" stroke-width="1"/>`);
    if (big) {
      // วงกลมระบบ (Level 0): ชื่อระบบใหญ่เด่น ใต้ลงมาเป็น By Kittamet
      this.add(this.text(cx, cy + r * 0.04, name, { size: 52, weight: 800, fill: '#fff' }));
      if (sub) this.add(this.text(cx, cy + r * 0.34, sub, { size: 22, weight: 500, fill: '#dbeafe' }));
    } else {
      this.add(this.text(cx, cy + r * 0.12, name, { size: r > 80 ? 17 : 14, weight: 700, fill: '#fff' }));
      if (sub) this.add(this.text(cx, cy + r * 0.55, sub, { size: 11, fill: '#dbeafe' }));
    }
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
  flow(pts, label, lx, ly, { anchor = 'middle', dash = false, both = false, w = 190 } = {}) {
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
    this.add(`<path d="${d}" fill="none" stroke="${C.flow}" stroke-width="1.6"${dash ? ' stroke-dasharray="6 4"' : ''} marker-end="url(#ah)"${both ? ' marker-start="url(#ahs)"' : ''}/>`);
    if (label) {
      const ls = wrapLabel(label, w);
      this.labels.push(`<g font-size="13" fill="${C.ink}" stroke="#fff" stroke-width="6" stroke-linejoin="round" paint-order="stroke" style="paint-order:stroke">${this.text(lx, ly, ls, { size: 13, anchor, lh: 17 })}</g>`);
    }
  }

  // ลูกศรคู่ระหว่างกล่องกับ "วงกลมกระบวนการ" แนวตั้ง: ปลายเส้นคำนวณให้แตะขอบวงกลมพอดี
  // side 'top' = กล่องอยู่เหนือวงกลม (yBox = ขอบล่างของกล่อง) · 'bottom' = กล่องอยู่ใต้วงกลม (yBox = ขอบบนของกล่อง)
  vpairC(x, yBox, c, side, down, up, { gap = 12, dash = false } = {}) {
    const edge = (xx) => c.y + (side === 'top' ? -1 : 1) * Math.sqrt(Math.max(0, c.r * c.r - (xx - c.x) ** 2));
    const xl = x - gap, xr = x + gap, el = edge(xl), er = edge(xr);
    const ym = (yBox + el) / 2;
    const r1 = (v) => Math.round(v * 10) / 10;
    if (side === 'top') {
      this.flow([[xl, yBox], [xl, r1(el)]], down, xl - 7, ym, { anchor: 'end', dash, w: 96 });
      this.flow([[xr, r1(er)], [xr, yBox]], up, xr + 7, ym, { anchor: 'start', dash, w: 96 });
    } else {
      this.flow([[xl, r1(el)], [xl, yBox]], down, xl - 7, ym, { anchor: 'end', dash, w: 96 });
      this.flow([[xr, yBox], [xr, r1(er)]], up, xr + 7, ym, { anchor: 'start', dash, w: 96 });
    }
  }
  // ลูกศรคู่แนวนอนระหว่างกล่องข้างจอกับวงกลมใหญ่ side 'left' | 'right' (ตำแหน่งของกล่อง) — บนสุดไปทางวงกลม, ล่างกลับมา
  hpairC(y, xBox, c, side, toSys, fromSys, { gap = 14 } = {}) {
    const edge = (yy) => c.x + (side === 'left' ? -1 : 1) * Math.sqrt(Math.max(0, c.r * c.r - (yy - c.y) ** 2));
    const r1 = (v) => Math.round(v * 10) / 10;
    const y1 = y - gap, y2 = y + gap, e1 = edge(y1), e2 = edge(y2);
    const W = Math.min(260, Math.abs(xBox - e1) - 20), n = (l) => wrapLabel(l, W).length;
    this.flow([[xBox, y1], [r1(e1), y1]], toSys, (xBox + e1) / 2, y1 - 10 - (n(toSys) - 1) * 8.5, { w: W });
    this.flow([[r1(e2), y2], [xBox, y2]], fromSys, (xBox + e2) / 2, y2 + 14 + (n(fromSys) - 1) * 8.5, { w: W });
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
// รูปทรงตามความหมาย (Yourdon-DeMarco): สี่เหลี่ยม = ผู้ใช้งาน/ระบบภายนอก · วงกลม = กระบวนการ · แถบเปิดปลาย = ที่เก็บข้อมูล · ลูกศร = ข้อมูลที่ไหล
function dfd0() {
  const s = new Svg(1260, 640);
  const c = { x: 630, y: 320, r: 205 };
  s.proc(c.x, c.y, c.r, '0', 'Short URL', 'By Kittamet', true);
  const E = (x, y, t, sub, k) => s.entity(x, y, 210, 90, t, sub, k);
  E(30, 140, 'ผู้เข้าชมลิงก์', 'Guest · ไม่ต้องล็อกอิน');
  E(30, 410, 'ผู้ใช้ (USER)', 'ล็อกอินด้วย Google');
  E(1020, 140, 'Google', 'ผู้ให้บริการ SSO (OIDC)', 'ext');
  E(1020, 410, 'ผู้ดูแล', 'ADMIN / MODERATOR');
  s.hpairC(185, 240, c, 'left', ['ลิงก์ต้นฉบับ', 'คำขอเปิดลิงก์ · รหัสผ่านลิงก์'], ['ลิงก์สั้น (ใช้ได้ 7 วัน)', '302 ไปปลายทาง / หน้าสถานะ']);
  s.hpairC(455, 240, c, 'left', ['คำขอเข้าสู่ระบบ · ข้อมูลลิงก์', 'การป้องกัน · คำขอ QR · คำขอสถิติ'], ['โทเคนเข้าสู่ระบบ · รายการลิงก์', 'ข้อมูล QR · สถิติการคลิก']);
  s.hpairC(185, 1020, c, 'right', 'id_token (sub, email)', 'คำขอยืนยันตัวตน (OIDC + PKCE)');
  s.hpairC(455, 1020, c, 'right', ['คำสั่งจัดการผู้ใช้ · ลิงก์', 'โดเมนที่บล็อก'], ['ภาพรวมระบบ · รายชื่อ', 'audit log']);
  s.add(s.text(630, 612, 'สี่เหลี่ยม = ผู้ใช้งาน/ระบบภายนอก · วงกลม = กระบวนการ · ลูกศร = ข้อมูลที่ไหล (หนึ่งเส้นต่อหนึ่งทิศ)', { size: 12.5, fill: C.muted }));
  return s.render('DFD Level 0');
}

/* ---------- DFD Level 1 ---------- */
function dfd1() {
  const s = new Svg(1340, 830);
  const R = 56, CY = 340, PANEL_Y = 520, ROWH = 52, PNW = 196;
  const cx = { p6: 130, p1: 345, p2: 560, p3: 775, p4: 990, p5: 1205 };
  const circ = (k) => ({ x: cx[k], y: CY, r: R });
  const E = (c, w, t, sub, k, dup) => s.entity(c - w / 2, 30, w, 70, t, sub, k, dup);
  E(cx.p6, 190, 'ผู้ดูแล', 'ADMIN / MODERATOR');
  E(cx.p1 - 45, 100, 'Google', 'SSO', 'ext');
  E(cx.p2, 120, 'ผู้ใช้', 'USER', 'ent', true);
  E(cx.p3, 150, 'ผู้เข้าชมลิงก์', 'Guest');
  E((cx.p4 + cx.p5) / 2, 300, 'ผู้ใช้ (USER)', 'ล็อกอินแล้ว', 'ent', true);
  const proc = (k, id, n, sub) => s.proc(cx[k], CY, R, id, n, sub);
  proc('p6', '6.0', 'จัดการระบบ', 'RBAC · Audit'); proc('p1', '1.0', 'ยืนยันตัวตน', 'SSO · JWT'); proc('p2', '2.0', 'จัดการลิงก์', 'ย่อ · ป้องกัน');
  proc('p3', '3.0', 'Redirect', 'ตรวจสิทธิ์ · 302'); proc('p4', '4.0', 'สร้าง QR', 'สไตล์ · PNG/SVG'); proc('p5', '5.0', 'สถิติคลิก', 'queue → DB');
  const panel = (k, rows) => rows.forEach(([id, n, sub], i) => s.store(cx[k] - PNW / 2, PANEL_Y + i * ROWH, PNW, ROWH, id, n, sub));
  panel('p6', [['D1', 'users', 'แบน · เปลี่ยนสิทธิ์'], ['D2', 'links', 'ปิด/เปิดลิงก์'], ['D4', 'blocked_domains', 'บล็อก/ปลด'], ['D5', 'audit_logs', 'บันทึกกิจกรรม']]);
  panel('p1', [['D1', 'users', 'sso_identities'], ['D6', 'Redis', 'session (rt/bl)']]);
  panel('p2', [['D4', 'blocked_domains', 'ตรวจโดเมนต้องห้าม'], ['D2', 'links', 'บันทึก · แก้ · ลบ'], ['D6', 'Redis', 'ลบ cache']]);
  panel('p3', [['D6', 'Redis', 'cache · ตัวนับ · คิวคลิก'], ['D2', 'links', 'อ่านเมื่อ cache miss']]);
  panel('p4', [['D2', 'links', 'รหัสสั้น · qr_style']]);
  panel('p5', [['D6', 'Redis', 'ดึงคิวคลิก'], ['D3', 'clicks', 'link_daily_stats'], ['D2', 'links', 'click_count']]);

  const top = 100, topY = (c, x) => CY - Math.sqrt(R * R - (x - c) ** 2);
  s.vpairC(cx.p6, top, circ('p6'), 'top', 'คำสั่งผู้ดูแล', ['ภาพรวม', 'audit']);
  s.vpairC(cx.p1 - 30, top, circ('p1'), 'top', 'คำขอ OIDC', ['id_token']);
  s.vpairC(cx.p2, top, circ('p2'), 'top', ['ข้อมูลลิงก์'], ['ลิงก์สั้น']);
  s.vpairC(cx.p3, top, circ('p3'), 'top', ['คำขอเปิดลิงก์', 'รหัสผ่าน'], '302 / หน้าสถานะ');
  s.vpairC(cx.p4, top, circ('p4'), 'top', ['ขอ QR'], ['ข้อมูล QR']);
  s.vpairC(cx.p5, top, circ('p5'), 'top', ['ขอสถิติ'], ['สถิติ']);
  // ผู้ใช้ → 1.0 (เส้นหักมุมฉาก: เส้นบนเลี้ยวไกลกว่า เพื่อไม่ตัดกัน)
  const l1 = cx.p1 + 30, l2 = cx.p1 + 46, ux = cx.p2 - 60;
  s.flow([[ux, 52], [l1, 52], [l1, topY(cx.p1, l1)]], 'ล็อกอิน', (ux + l1) / 2 + 8, 38);
  s.flow([[l2, topY(cx.p1, l2)], [l2, 82], [ux, 82]], 'โทเคน', (ux + l2) / 2 + 8, 95);
  // ผู้เข้าชม → 2.0 (ย่อลิงก์แบบ guest) เข้าด้านขวาของวงกลม
  const gx = cx.p3 - 75, xa = cx.p2 + 90, xb = cx.p2 + 106, ex = (dy) => cx.p2 + Math.sqrt(R * R - dy * dy);
  s.flow([[gx, 52], [xa, 52], [xa, CY - 16], [ex(16), CY - 16]], 'URL เดิม', (gx + xa) / 2, 38, { dash: true });
  s.flow([[ex(16), CY + 16], [xb, CY + 16], [xb, 82], [gx, 82]], 'ลิงก์สั้น', (gx + xb) / 2, 95, { dash: true });

  const pt = PANEL_Y;
  s.vpairC(cx.p6, pt, circ('p6'), 'bottom', ['แบน · ปิดลิงก์', 'บล็อกโดเมน'], ['ข้อมูลผู้ใช้', 'ลิงก์ · audit']);
  s.vpairC(cx.p1, pt, circ('p1'), 'bottom', ['ผู้ใช้ใหม่', 'session'], ['ข้อมูลผู้ใช้', 'session']);
  s.vpairC(cx.p2, pt, circ('p2'), 'bottom', ['บันทึก/แก้ลิงก์', 'ลบ cache'], ['ลิงก์', 'โดเมนต้องห้าม']);
  s.vpairC(cx.p3, pt, circ('p3'), 'bottom', ['นับสิทธิ์', 'เข้าคิวคลิก'], ['ลิงก์ (cache)', 'ตัวนับ']);
  s.vpairC(cx.p4, pt, circ('p4'), 'bottom', ['qr_style'], ['รหัสสั้น', 'qr_style']);
  s.vpairC(cx.p5, pt, circ('p5'), 'bottom', ['คลิก · รายวัน', 'click_count'], ['คิวคลิก']);
  s.add(s.text(670, 752, 'สี่เหลี่ยม = ผู้ใช้งาน/ระบบภายนอก (มุมตัด ◣ = วาดซ้ำเพื่อไม่ให้เส้นตัดกัน) · วงกลม = กระบวนการ · แถบเปิดปลาย Dn = ที่เก็บข้อมูล', { size: 12.5, fill: C.muted }));
  s.add(s.text(670, 774, 'ลูกศรหนึ่งเส้นต่อหนึ่งทิศ · เส้นประ = ย่อลิงก์โดยไม่ล็อกอิน · D2 links และ D6 Redis วาดซ้ำใต้หลายกระบวนการ · 2.0/4.0/5.0/6.0 ต้องผ่าน 1.0 (JWT) ก่อน', { size: 12.5, fill: C.muted }));
  return s.render('DFD Level 1');
}

/* ---------- DFD Level 2: Redirect (3.0) ---------- */
function dfd2() {
  const s = new Svg(1260, 780);
  const R = 56, cy = 330, x = [300, 510, 720, 930, 1140];
  const C = (i) => ({ x: x[i], y: cy, r: R });
  s.entity(20, cy - 40, 140, 80, 'ผู้เข้าชม', 'GET /:code');
  s.entity(380, 30, 850, 70, 'ผู้เข้าชม', 'รับผลตอบกลับ: หน้าสถานะ (3.2–3.4) หรือ 302 ไปยัง URL ต้นฉบับ (3.5)', 'ent', true);
  const nm = [['3.1', 'หาลิงก์', 'cache → DB'], ['3.2', 'ตรวจเงื่อนไข', 'ปิด/หมดอายุ/เริ่ม'], ['3.3', 'ตรวจรหัสผ่าน', 'scrypt'], ['3.4', 'นับสิทธิ์คลิก', 'INCR lim:{id}'], ['3.5', 'ตอบ 302', 'Location']];
  nm.forEach(([id, n, sub], i) => s.proc(x[i], cy, R, id, n, sub));
  s.flow([[160, cy], [x[0] - R, cy]], 'รหัสสั้น', 218, cy - 14);
  ['ข้อมูลลิงก์', 'ผ่านเงื่อนไข', 'รหัสถูกต้อง', 'ได้สิทธิ์'].forEach((l, i) => s.flow([[x[i] + R, cy], [x[i + 1] - R, cy]], l, (x[i] + x[i + 1]) / 2, cy - 14));
  // ผลตอบกลับขึ้นไปหาผู้เข้าชม
  const top = cy - R;
  s.flow([[x[1], top], [x[1], 100]], ['403 ยังไม่เริ่ม', '404 ไม่พบ ปิด', 'หรือหมดอายุ'], x[1] + 8, 200, { anchor: 'start', w: 110 });
  s.flow([[x[2], top], [x[2], 100]], ['401 ขอรหัสผ่าน', '429 ลองผิดเกิน'], x[2] + 8, 200, { anchor: 'start', w: 110 });
  s.flow([[x[3], top], [x[3], 100]], '410 ครบจำนวนคลิก', x[3] + 8, 200, { anchor: 'start' });
  s.flow([[x[4], top], [x[4], 100]], '302 + URL ต้นฉบับ', x[4] + 8, 200, { anchor: 'start' });
  // ที่เก็บข้อมูล
  const SY = 530, bot = cy + R;
  s.store(300, SY, 710, 62, 'D6', 'Redis', 'link:{code} · lim:{id} · rl:*');
  s.store(1035, SY, 200, 62, 'D6', 'Redis', 'clicks:queue');
  s.store(60, 660, 230, 62, 'D2', 'links', 'อ่านเมื่อ cache miss');
  const e = (xx, i = 0) => cy + Math.sqrt(R * R - (xx - x[i]) ** 2);
  s.flow([[323, e(323)], [323, SY]], 'GET link:{code}', 331, 455, { anchor: 'start' });
  s.flow([[347, SY], [347, e(347)]], 'ลิงก์ (cache hit)', 355, 490, { anchor: 'start' });
  s.flow([[250, e(250)], [250, 660]], 'SELECT เมื่อ cache miss', 242, 570, { anchor: 'end', dash: true });
  s.flow([[266, 660], [266, e(266)]], 'ข้อมูลลิงก์', 274, 620, { anchor: 'start', dash: true });
  s.vpairC(x[2] - 20, SY, C(2), 'bottom', 'นับครั้งที่ลอง', 'ผลตรวจ');
  s.vpairC(x[3] - 20, SY, C(3), 'bottom', 'INCR lim:{id}', 'สิทธิ์ที่เหลือ');
  s.flow([[x[4], bot], [x[4], SY]], ['เหตุการณ์คลิก', '(ip_hash, UA, ประเทศ)'], x[4] - 8, 450, { anchor: 'end' });
  s.add(s.text(630, 752, 'เข้าคิวคลิกหลังตอบ 302 แล้ว (fire-and-forget) — ถ้า analytics ล่มก็ไม่กระทบผู้เข้าชม', { size: 12.5, fill: C.muted }));
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
    ['id', 'int', 'PK'], ['actor_id', 'uuid?', 'FK'], ['action', 'enum', ''], ['target_type', 'USER|LINK|DOMAIN', ''], ['target_id', 'text', ''], ['detail', 'text?', ''], ['created_at', 'timestamptz', ''],
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
// แบ่งเป็นชั้น (lane): ผู้ใช้/ภายนอก → Application → Data · เส้นตรงหักมุมฉาก ไม่ตัดกัน
// analytics อยู่ตรงกลางเพราะคุยกับทั้ง core-api (ขอสถิติ) และ redirect-service (ปลุก flush)
function arch() {
  const s = new Svg(1280, 720);
  const lane = (y, h, title) => {
    s.add(`<rect x="12" y="${y}" width="1256" height="${h}" rx="18" fill="#f8fafc" stroke="${C.line}"/>`);
    s.add(s.text(34, y + 24, title, { size: 13, weight: 700, fill: C.muted, anchor: 'start' }));
  };
  const box = (cx, y, w, h, title, lines, fill = '#fff', stroke = C.entLine) => {
    s.add(`<rect x="${cx - w / 2}" y="${y}" width="${w}" height="${h}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
    s.add(s.text(cx, y + 26, title, { size: 16, weight: 700, fill: stroke }));
    s.add(s.text(cx, y + 54 + ((lines.length - 1) * 17) / 2, lines, { size: 12.5, fill: C.muted, lh: 17 }));
  };
  const X = { core: 300, ana: 640, red: 980 };

  lane(14, 170, 'ผู้ใช้และระบบภายนอก');
  lane(204, 230, 'Application — Docker บน Render');
  lane(454, 250, 'Data');

  box(X.core, 56, 220, 100, 'Google', ['ผู้ให้บริการยืนยันตัวตน', 'OpenID Connect + PKCE'], C.ext, C.extLine);
  box(X.ana, 56, 220, 100, 'เบราว์เซอร์', ['ผู้ใช้ · ผู้เข้าชมลิงก์']);
  box(X.red, 56, 240, 100, 'Frontend', ['Next.js (static) บน Cloudflare', 'shorturl.kittametdev.com']);

  const sy = 270, sh = 130;
  box(X.core, sy, 240, sh, 'core-api  :4000', ['api.kittametdev.com', 'Auth · ลิงก์ · QR · แอดมิน', 'ใช้ PostgreSQL + Redis']);
  box(X.ana, sy, 240, sh, 'analytics-service  :4002', ['ภายใน (ไม่เปิดสู่สาธารณะ)', 'ดึงคิวคลิก → เขียนฐานข้อมูล', 'ให้สถิติแก่ core-api']);
  box(X.red, sy, 240, sh, 'redirect-service  :4001', ['s.kittametdev.com', 'GET /:code → 302', 'อ่าน Redis · miss → PostgreSQL']);

  // ผู้ใช้ ↔ ระบบ
  s.flow([[X.ana + 110, 96], [X.red - 120, 96]], 'โหลดหน้าเว็บ', (X.ana + 110 + X.red - 120) / 2, 84, { w: 90 });
  s.flow([[X.ana - 50, 156], [X.ana - 50, 232], [X.core + 70, 232], [X.core + 70, sy]], 'เรียก API  /api/*', 470, 220, { w: 170 });
  s.flow([[X.ana + 50, 156], [X.ana + 50, 232], [X.red - 70, 232], [X.red - 70, sy]], 'เปิดลิงก์สั้น  /:code', 810, 220, { w: 170 });
  s.vpair(X.core - 50, 156, sy, 'id_token', ['คำขอ + code', '(OIDC)'], { gap: 11 });
  // บริการ ↔ บริการ
  s.hpair(sy + 56, X.core + 120, X.ana - 120, 'ขอสถิติ', 'สถิติ', { gap: 12 });
  s.flow([[X.red - 120, sy + 62], [X.ana + 120, sy + 62]], ['ปลุก', 'flush'], (X.red - 120 + X.ana + 120) / 2, sy + 40, { w: 90 });
  // บริการ → ที่เก็บข้อมูล
  const dy = 484, dh = 190;
  s.add(`<rect x="110" y="${dy}" width="1060" height="${dh}" rx="14" fill="#fff" stroke="${C.line}" stroke-dasharray="6 4"/>`);
  box(340, dy + 40, 400, 120, 'PostgreSQL 16', ['Neon · ข้อมูลหลักทั้งหมด', 'users · links · clicks', 'link_daily_stats · audit_logs · blocked_domains'], C.store, C.storeLine);
  box(940, dy + 40, 400, 120, 'Redis 7', ['Upstash · เร็วและชั่วคราว', 'cache ลิงก์ · session · rate limit', 'ตัวนับสิทธิ์คลิก · คิวคลิก'], C.store, C.storeLine);
  s.vpair(X.core, sy + sh, dy, 'เขียน', 'อ่าน', { gap: 12 });
  s.vpair(X.ana, sy + sh, dy, 'เขียนคลิก', 'ดึงคิว', { gap: 12 });
  s.vpair(X.red, sy + sh, dy, 'เข้าคิว', 'อ่าน cache', { gap: 12 });
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
<p class="lead">แสดงว่าข้อมูลไหลระหว่างผู้ใช้ ระบบ และที่เก็บข้อมูลอย่างไร แบ่ง 3 ระดับ ใช้สัญลักษณ์ Yourdon-DeMarco ที่รูปทรงบอกความหมาย: สี่เหลี่ยม = ผู้ใช้งาน/ระบบภายนอก, วงกลม = กระบวนการ, แถบเปิดปลายมีรหัส Dn = ที่เก็บข้อมูล, ลูกศรหนึ่งเส้นต่อหนึ่งทิศ</p>
<div class="layout">${toc([['l0', 'Level 0'], ['l1', 'Level 1'], ['l2', 'Level 2 · Redirect']])}<div class="content">
${fig('l0', 'Level 0 — ภาพรวมระบบ', 'ระบบทั้งหมดเป็นกระบวนการเดียว คุยกับผู้ใช้ 3 กลุ่มและ Google', D0, 'dfd-level0.svg', 'DFD Level 0')}
${fig('l1', 'Level 1 — 6 กระบวนการหลัก', 'แตกกระบวนการ 0 ออกเป็น 6 ตัว พร้อมที่เก็บข้อมูล D1–D6', D1, 'dfd-level1.svg', 'DFD Level 1')}

${fig('l2', 'Level 2 — กระบวนการ 3.0 Redirect', 'ตอนมีคนเปิดลิงก์สั้น: หาลิงก์ → ตรวจเงื่อนไข → ตรวจรหัสผ่าน → นับสิทธิ์ → ตอบ 302', D2, 'dfd-level2-redirect.svg', 'DFD Level 2 กระบวนการ Redirect')}</div></div>`),

  er: shell('er', `<h1>ER Diagram</h1>
<p class="lead">ตรงกับ <code>services/core-api/prisma/schema.prisma</code> · 7 ตาราง · ไม่เก็บรหัสผ่านผู้ใช้ (ใช้ SSO) · ไม่เก็บ IP ดิบ (เก็บ hash)</p>
${fig('erd', 'ความสัมพันธ์ระหว่างตาราง', 'PK = primary key · FK = foreign key · UK = unique · ? = ว่างได้', ER, 'er-diagram.svg', 'ER Diagram')}`),

  architecture: shell('architecture', `<h1>Architecture</h1>
<p class="lead">Micro-service 3 ตัวแยกหน้าที่ชัดเจน คุยกันผ่าน HTTP ภายในและ Redis</p>
<div class="layout">${toc([['diagram', 'แผนภาพ'], ['services', 'บริการ']])}<div class="content">
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
</div></div>`),
};

for (const [dir, html] of Object.entries(pages)) {
  const p = join(OUT, dir);
  mkdirSync(p, { recursive: true });
  writeFileSync(join(p, 'index.html'), html);
  for (const [f, svg] of Object.entries(files)) if (html.includes(`href="${f}"`)) writeFileSync(join(p, f), svg.replace('<svg ', '<svg xmlns:xlink="http://www.w3.org/1999/xlink" '));
}
console.log('สร้างเสร็จ →', OUT);
