#!/usr/bin/env node
// surl — CLI ของโปรเจกต์ (Node 18+, ไม่มี dependency)
// คำสั่งพัฒนา: `surl dev` (เลือก/รันหลาย service พร้อมกัน), `surl status`, `surl migrate`
// คำสั่งใช้งานลิงก์ผ่าน API key: login / whoami / shorten / ls / stats / qr / on / off / rm / config
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IS_WIN = process.platform === 'win32';
const TTY = Boolean(process.stdout.isTTY);

// ---------- สี ----------
const paint = (code) => (s) => (TTY ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const bold = paint(1);
const dim = paint(2);
const red = paint(31);
const green = paint(32);
const yellow = paint(33);
const blue = paint(34);
const magenta = paint(35);
const cyan = paint(36);

// ---------- service ที่รันได้ ----------
// script = npm script ที่ใช้รัน (ต้องมีใน package.json ของ service นั้น จึงจะนับว่า "มีให้รัน")
const SERVICES = [
  { id: 'infra', label: 'PostgreSQL + Redis', note: 'docker compose', kind: 'docker', ports: [5442, 6380], paint: yellow, aliases: ['db', 'docker'] },
  { id: 'core-api', label: 'core-api', note: ':4000', dir: 'services/core-api', script: 'start:dev', ports: [4000], paint: cyan, aliases: ['core', 'api'] },
  { id: 'redirect-service', label: 'redirect-service', note: ':4001', dir: 'services/redirect-service', script: 'start:dev', ports: [4001], paint: green, aliases: ['redirect'] },
  { id: 'analytics-service', label: 'analytics-service', note: ':4002', dir: 'services/analytics-service', script: 'start:dev', ports: [4002], paint: magenta, aliases: ['analytics'] },
  { id: 'frontend', label: 'frontend', note: ':3000', dir: 'frontend', script: 'dev', ports: [3000], paint: blue, aliases: ['web', 'fe'] },
];

function isAvailable(s) {
  if (s.kind === 'docker') return existsSync(path.join(ROOT, 'docker-compose.yml'));
  const pkg = path.join(ROOT, s.dir, 'package.json');
  if (!existsSync(pkg)) return false;
  try {
    return Boolean(JSON.parse(readFileSync(pkg, 'utf8')).scripts?.[s.script]);
  } catch {
    return false;
  }
}

function findService(name) {
  const n = name.toLowerCase();
  return SERVICES.find((s) => s.id === n || s.aliases.includes(n));
}

// ---------- ช่วยเหลือ ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function portOpen(port, timeout = 400) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host: '127.0.0.1' });
    const done = (v) => {
      sock.destroy();
      resolve(v);
    };
    sock.setTimeout(timeout, () => done(false));
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
  });
}

async function waitFor(check, timeoutMs, everyMs = 500) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await check()) return true;
    await sleep(everyMs);
  }
  return false;
}

// อ่าน .env ที่ root ส่งต่อให้ทุก service (prisma ไม่อ่าน .env นอกโฟลเดอร์ของตัวเอง)
function loadDotenv() {
  const file = path.join(ROOT, '.env');
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || m[1].startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    out[m[1]] = v;
  }
  return out;
}

const npm = IS_WIN ? 'npm.cmd' : 'npm';
const npx = IS_WIN ? 'npx.cmd' : 'npx';

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', shell: IS_WIN, ...opts });
}

// ---------- เมนูเลือก service (ลูกศร ↑↓, เว้นวรรค เลือก/ยกเลิก, a = ทั้งหมด, Enter ยืนยัน) ----------
function pickServices(items) {
  return new Promise((resolve) => {
    const rows = [{ id: '*', label: 'รันทั้งหมด', note: 'ทุก service ที่มีโค้ดแล้ว', available: true }, ...items];
    const selected = new Set(items.filter((i) => i.available).map((i) => i.id)); // เริ่มต้น = เลือกทั้งหมดที่รันได้
    let cursor = 0;
    let drawn = 0;

    const allOn = () => items.filter((i) => i.available).every((i) => selected.has(i.id));
    const mark = (r) => {
      if (!r.available) return dim('[–]');
      const on = r.id === '*' ? allOn() : selected.has(r.id);
      return on ? green('[x]') : '[ ]';
    };

    const draw = () => {
      if (drawn) process.stdout.write(`\x1b[${drawn}A\x1b[J`);
      const lines = [
        bold('เลือก service ที่จะรัน') + dim('   ↑↓ เลื่อน · เว้นวรรค เลือก/ยกเลิก · a ทั้งหมด · Enter เริ่ม · q ออก'),
        ...rows.map((r, i) => {
          const pointer = i === cursor ? cyan('❯') : ' ';
          const text = r.available ? r.label : dim(`${r.label}`);
          const note = r.available ? dim(r.note ?? '') : dim('(ยังไม่มีโค้ด)');
          return ` ${pointer} ${mark(r)} ${text}  ${note}`;
        }),
      ];
      process.stdout.write(lines.join('\n') + '\n');
      drawn = lines.length;
    };

    const toggle = () => {
      const r = rows[cursor];
      if (!r.available) return;
      if (r.id === '*') {
        const on = allOn();
        for (const i of items) if (i.available) (on ? selected.delete(i.id) : selected.add(i.id));
      } else if (selected.has(r.id)) selected.delete(r.id);
      else selected.add(r.id);
    };

    const finish = (result) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('keypress', onKey);
      resolve(result);
    };

    const onKey = (_str, key) => {
      if (!key) return;
      if ((key.ctrl && key.name === 'c') || key.name === 'q' || key.name === 'escape') return finish(null);
      if (key.name === 'up' || key.name === 'k') cursor = (cursor - 1 + rows.length) % rows.length;
      else if (key.name === 'down' || key.name === 'j') cursor = (cursor + 1) % rows.length;
      else if (key.name === 'space') toggle();
      else if (key.name === 'a') {
        const on = allOn();
        for (const i of items) if (i.available) (on ? selected.delete(i.id) : selected.add(i.id));
      } else if (key.name === 'return') return finish([...selected]);
      draw();
    };

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('keypress', onKey);
    draw();
  });
}

// ---------- รัน child พร้อม prefix สี ----------
const children = new Map(); // id → child
let shuttingDown = false;

function pipeWithPrefix(stream, svc, isErr) {
  let buf = '';
  const tag = svc.paint(`[${svc.id}]`.padEnd(19));
  const emit = (line) => (isErr ? process.stderr : process.stdout).write(`${tag} ${line}\n`);
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      emit(buf.slice(0, i).replace(/\r$/, ''));
      buf = buf.slice(i + 1);
    }
  });
  stream.on('end', () => buf && emit(buf));
}

function startService(svc, env) {
  const child = spawn(npm, ['run', svc.script], {
    cwd: path.join(ROOT, svc.dir),
    env: { ...process.env, ...env, FORCE_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: !IS_WIN, // ตั้งเป็น process group เพื่อปิดทั้งต้นไม้ได้ตอน Ctrl+C
    shell: IS_WIN,
  });
  children.set(svc.id, child);
  pipeWithPrefix(child.stdout, svc, false);
  pipeWithPrefix(child.stderr, svc, true);
  child.on('exit', (code, signal) => {
    children.delete(svc.id);
    if (!shuttingDown) {
      console.log(`${svc.paint(`[${svc.id}]`)} ${code === 0 ? 'หยุดทำงานแล้ว' : red(`หยุดทำงาน (code ${code ?? signal})`)}`);
      if (children.size === 0) process.exit(code ?? 0);
    }
  });
  return child;
}

function killChild(child, signal) {
  try {
    if (IS_WIN) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
    else process.kill(-child.pid, signal);
  } catch {
    /* จบไปแล้ว */
  }
}

async function shutdown(opts, code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${yellow('กำลังปิด service ...')}`);
  for (const child of children.values()) killChild(child, 'SIGTERM');
  await waitFor(() => children.size === 0, 4000, 100);
  for (const child of children.values()) killChild(child, 'SIGKILL');
  if (opts.stopInfra) {
    console.log(dim('docker compose stop'));
    run('docker', ['compose', 'stop']);
  }
  process.exit(code);
}

// ---------- surl dev ----------
function parseArgs(argv) {
  // ไม่ใช้ตัวเลือกแบบ -- : พิมพ์เป็นคำธรรมดา เช่น `surl dev all` / `surl dev all nomigrate down`
  const opts = { all: false, migrate: true, stopInfra: false, names: [], help: false };
  for (const a of argv) {
    if (a === 'all') opts.all = true;
    else if (a === 'nomigrate') opts.migrate = false;
    else if (a === 'down') opts.stopInfra = true;
    else if (a === 'help') opts.help = true;
    else if (a.startsWith('-')) fail(`ไม่ใช้ตัวเลือกแบบ ${a} แล้ว — พิมพ์เป็นคำ เช่น: surl dev all (ดู: surl help)`);
    else opts.names.push(a);
  }
  return opts;
}

function fail(msg) {
  console.error(red(`✗ ${msg}`));
  process.exit(1);
}

async function ensureInfra(env) {
  const docker = run('docker', ['info']);
  if (docker.status !== 0) fail('ใช้ docker ไม่ได้ — เปิด Docker Desktop ก่อน (หรือไม่ต้องเลือก infra ถ้ามี Postgres/Redis อยู่แล้ว)');
  console.log(`${yellow('▶ infra')} docker compose up -d`);
  const up = run('docker', ['compose', 'up', '-d'], { stdio: 'inherit', env: { ...process.env, ...env } });
  if (up.status !== 0) fail('docker compose up ไม่สำเร็จ');
  process.stdout.write(dim('  รอ PostgreSQL พร้อม '));
  const ready = await waitFor(
    async () => run('docker', ['compose', 'exec', '-T', 'postgres', 'pg_isready', '-U', 'shorturl']).status === 0,
    60000,
    1000,
  );
  console.log(ready ? green('✔') : red('✗'));
  if (!ready) fail('PostgreSQL ไม่พร้อมภายใน 60 วินาที (ดู: docker compose logs postgres)');
  console.log(`  ${green('✔')} PostgreSQL :5442  Redis :6380`);
}

function ensureDeps(svc) {
  if (existsSync(path.join(ROOT, svc.dir, 'node_modules'))) return;
  console.log(`${svc.paint(`▶ ${svc.id}`)} ยังไม่มี node_modules → npm install`);
  const r = spawnSync(npm, ['install'], { cwd: path.join(ROOT, svc.dir), stdio: 'inherit', shell: IS_WIN });
  if (r.status !== 0) fail(`npm install ของ ${svc.id} ไม่สำเร็จ`);
}

function migrate(env) {
  console.log(`${cyan('▶ core-api')} prisma migrate deploy`);
  const r = spawnSync(npx, ['prisma', 'migrate', 'deploy'], {
    cwd: path.join(ROOT, 'services/core-api'),
    env: { ...process.env, ...env },
    encoding: 'utf8',
    shell: IS_WIN,
  });
  if (r.status !== 0) {
    process.stderr.write(`${r.stdout ?? ''}${r.stderr ?? ''}`);
    fail('migrate ไม่สำเร็จ (เช็ค DATABASE_URL ใน .env และว่า PostgreSQL รันอยู่) — ข้ามได้ด้วย: surl dev ... nomigrate');
  }
  const applied = /(\d+) migration/.exec(r.stdout ?? '');
  console.log(`  ${green('✔')} ${applied ? `${applied[1]} migration พร้อม` : 'schema เป็นปัจจุบัน'}`);
}

async function cmdDev(argv) {
  const opts = parseArgs(argv);
  if (opts.help) return printHelp();

  if (!existsSync(path.join(ROOT, '.env'))) {
    fail('ไม่พบไฟล์ .env ที่ root ของโปรเจกต์ — สร้างตามตารางในหัวข้อ "ตัวแปรสภาพแวดล้อม" ของ README.md');
  }
  const env = loadDotenv();

  // 1) เลือก service
  let ids;
  if (opts.names.length) {
    ids = opts.names.map((n) => {
      const s = findService(n);
      if (!s) fail(`ไม่รู้จัก service "${n}" — ที่มี: ${SERVICES.map((x) => x.id).join(', ')}`);
      if (!isAvailable(s)) fail(`${s.id} ยังไม่มีโค้ด/สคริปต์ ${s.script ?? ''} ให้รัน`);
      return s.id;
    });
  } else if (opts.all || !process.stdin.isTTY || !TTY) {
    ids = SERVICES.filter(isAvailable).map((s) => s.id);
  } else {
    const picked = await pickServices(SERVICES.map((s) => ({ id: s.id, label: s.label, note: s.note, available: isAvailable(s) })));
    if (!picked) return console.log(dim('ยกเลิก'));
    ids = picked;
  }
  if (ids.length === 0) fail('ยังไม่ได้เลือก service ไหนเลย');
  const chosen = SERVICES.filter((s) => ids.includes(s.id));
  console.log(`${bold('จะรัน:')} ${chosen.map((s) => s.paint(s.id)).join(', ')}\n`);

  // 2) infra
  if (chosen.some((s) => s.id === 'infra')) await ensureInfra(env);
  const apps = chosen.filter((s) => s.kind !== 'docker');
  if (apps.length === 0) return console.log(`\n${dim('รันเฉพาะ infra — หยุดด้วย: docker compose stop')}`);

  // 3) DB ต้องพร้อมถ้า service ที่เลือกต้องใช้
  if (!chosen.some((s) => s.id === 'infra') && !(await portOpen(5442)) && apps.some((s) => s.id !== 'frontend')) {
    console.log(yellow('⚠ ไม่พบ PostgreSQL ที่ :5442 — service ที่ต้องใช้ DB จะ error (เลือก "PostgreSQL + Redis" ด้วย)'));
  }

  // 4) ติดตั้ง dependency + migrate + ข้ามตัวที่ port ถูกใช้อยู่แล้ว
  const toStart = [];
  for (const s of apps) {
    if (await portOpen(s.ports[0])) {
      console.log(`${yellow('⚠')} ${s.id}: port :${s.ports[0]} ถูกใช้อยู่แล้ว (รันอยู่หรือไม่) → ข้าม`);
      continue;
    }
    ensureDeps(s);
    toStart.push(s);
  }
  if (opts.migrate && toStart.some((s) => s.id === 'core-api')) migrate(env);
  if (toStart.length === 0) return console.log(dim('\nไม่มี service ใหม่ให้เริ่ม'));

  // 5) เริ่ม
  process.on('SIGINT', () => shutdown(opts));
  process.on('SIGTERM', () => shutdown(opts));
  console.log('');
  for (const s of toStart) startService(s, env);

  // 6) แจ้งเมื่อ port เปิดแล้ว
  await Promise.all(
    toStart.map(async (s) => {
      const up = await waitFor(() => portOpen(s.ports[0]), 90000, 700);
      if (shuttingDown) return;
      console.log(up ? `${green('✔')} ${s.paint(s.id)} พร้อมที่ ${bold(`http://localhost:${s.ports[0]}`)}` : `${red('✗')} ${s.id} ยังไม่เปิด :${s.ports[0]} ภายใน 90 วินาที`);
    }),
  );
  console.log(dim('\nกด Ctrl+C เพื่อปิดทั้งหมด'));
}

// ---------- surl migrate ----------
function cmdMigrate() {
  if (!existsSync(path.join(ROOT, '.env'))) fail('ไม่พบไฟล์ .env ที่ root ของโปรเจกต์');
  ensureDeps(SERVICES.find((s) => s.id === 'core-api'));
  migrate(loadDotenv());
}

// ---------- surl status ----------
async function cmdStatus() {
  console.log(bold('สถานะ port'));
  for (const s of SERVICES) {
    const results = await Promise.all(s.ports.map(async (p) => [p, await portOpen(p)]));
    const state = results.map(([p, up]) => (up ? green(`:${p} เปิด`) : dim(`:${p} ปิด`))).join('  ');
    console.log(`  ${s.paint(s.id.padEnd(18))} ${state}${isAvailable(s) ? '' : dim('  (ยังไม่มีโค้ด)')}`);
  }
}


// =====================================================================
// คำสั่งใช้งานลิงก์ (ผ่าน API key `surl_…` ที่สร้างจากหน้า /keys บนเว็บ)
// =====================================================================
const CONFIG_DIR = IS_WIN ? path.join(process.env.APPDATA ?? os.homedir(), 'surl') : path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'surl');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_API = 'http://localhost:4000';

function readConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
  try {
    chmodSync(CONFIG_FILE, 0o600); // มี key อยู่ในไฟล์ — เจ้าของอ่านได้คนเดียว
  } catch {
    /* Windows ไม่รองรับ */
  }
}

const apiBase = (cfg = readConfig()) => (process.env.SURL_API || cfg.api || DEFAULT_API).replace(/\/+$/, '');
const apiToken = (cfg = readConfig()) => process.env.SURL_TOKEN || cfg.token || '';

// แยก argv: --k v / --k=v / -k v; ธง boolean ระบุใน bools; ที่เหลือเป็นอาร์กิวเมนต์ตำแหน่ง
function parseFlags(argv, { bools = [], short = {} } = {}) {
  const flags = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    let name = null;
    let val;
    if (a.startsWith('--')) [name, val] = a.slice(2).split(/=(.*)/s, 2);
    else if (/^-[A-Za-z]$/.test(a)) name = short[a[1]] ?? a[1];
    else {
      pos.push(a);
      continue;
    }
    if (bools.includes(name)) flags[name] = val === undefined ? true : val !== 'false';
    else if (val !== undefined) flags[name] = val;
    else if (i + 1 < argv.length) flags[name] = argv[++i];
    else fail(`ธง --${name} ต้องมีค่า`);
  }
  return { flags, pos };
}

async function request(method, route, body, { raw = false, token } = {}) {
  const cfg = readConfig();
  const tok = token ?? apiToken(cfg);
  if (!tok) fail('ยังไม่ได้เข้าสู่ระบบ — สร้าง API key ที่หน้า /keys บนเว็บ แล้วรัน: surl login --token surl_…');
  let res;
  try {
    res = await fetch(apiBase(cfg) + route, {
      method,
      headers: { authorization: `Bearer ${tok}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    fail(`เชื่อมต่อ ${apiBase(cfg)} ไม่ได้ (${e?.cause?.code ?? e?.message}) — ตรวจ API: surl config`);
  }
  if (res.status === 204) return null;
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      msg = (await res.json()).message ?? msg;
    } catch {
      /* ไม่ใช่ JSON */
    }
    if (res.status === 401 && token === undefined) msg += ' — key ถูกเพิกถอนหรือหมดอายุ? ลอง surl login ใหม่';
    fail(msg);
  }
  return raw ? Buffer.from(await res.arrayBuffer()) : res.json();
}

const out = (flags, data, pretty) => (flags.json ? console.log(JSON.stringify(data, null, 2)) : pretty());
const num = (n) => Number(n).toLocaleString('en-US');
const shortOf = (u) => String(u).replace(/^https?:\/\//, '');

// รับได้ทั้ง code (abc123) หรือ URL เต็ม (https://s.example.com/abc123)
async function resolveLink(arg) {
  if (!arg) fail('ต้องระบุลิงก์ (code หรือ URL สั้น)');
  const code = decodeURIComponent(String(arg).replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop());
  const page = await request('GET', `/api/links?q=${encodeURIComponent(code)}&pageSize=100`);
  const hit = page.items.find((l) => l.shortCode === code);
  if (!hit) fail(`ไม่พบลิงก์ "${code}" ในบัญชีนี้`);
  return hit;
}

// "7d" "12h" "30m" = นับจากตอนนี้; ไม่งั้นรับวันที่/เวลา (2026-12-31, 2026-12-31T09:00, ISO)
function parseWhen(v, label) {
  const rel = /^(\d+)([dhm])$/.exec(String(v));
  const d = rel ? new Date(Date.now() + Number(rel[1]) * { d: 86400e3, h: 3600e3, m: 60e3 }[rel[2]]) : new Date(v);
  if (Number.isNaN(d.getTime())) fail(`${label} ไม่ถูกต้อง: "${v}" (ตัวอย่าง: 7d, 2026-12-31, 2026-12-31T09:00)`);
  return d.toISOString();
}

function statusText(l) {
  if (l.status === 'ADMIN_DISABLED') return red('ผู้ดูแลปิด');
  if (l.status === 'DISABLED') return dim('ปิดอยู่');
  if (l.expired) return dim('หมดอายุ');
  if (l.limitReached) return dim('เปิดครบแล้ว');
  if (l.notStarted) return yellow('ยังไม่เริ่ม');
  return green('ใช้งานอยู่');
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (a) => {
      rl.close();
      resolve(a.trim());
    });
  });
}

async function cmdLogin(argv) {
  const { flags } = parseFlags(argv, { short: { t: 'token' } });
  let token = flags.token || process.env.SURL_TOKEN || '';
  if (!token) {
    if (!process.stdin.isTTY) fail('ใช้: surl login --token surl_…  (สร้าง key ที่หน้า /keys บนเว็บ)');
    token = await prompt('วาง API key (surl_…): ');
  }
  if (!/^surl_[A-Za-z0-9_-]{20,}$/.test(token)) fail('รูปแบบ API key ไม่ถูกต้อง (ต้องขึ้นต้นด้วย surl_)');
  const cfg = readConfig();
  if (flags.api) cfg.api = String(flags.api).replace(/\/+$/, '');
  const me = await (async () => {
    const prev = process.env.SURL_API;
    if (flags.api) process.env.SURL_API = cfg.api;
    try {
      return await request('GET', '/api/auth/me', undefined, { token });
    } finally {
      if (flags.api) prev === undefined ? delete process.env.SURL_API : (process.env.SURL_API = prev);
    }
  })();
  writeConfig({ ...cfg, token });
  console.log(`${green('✔')} เข้าสู่ระบบแล้ว: ${bold(me.email)} ${dim(`(${apiBase(cfg)})`)}`);
  console.log(dim(`  เก็บ key ไว้ที่ ${CONFIG_FILE} (อ่านได้เฉพาะเจ้าของ)`));
}

function cmdLogout() {
  const cfg = readConfig();
  if (!cfg.token) return console.log(dim('ยังไม่ได้เข้าสู่ระบบ'));
  delete cfg.token;
  writeConfig(cfg);
  console.log(`${green('✔')} ลบ key ออกจากเครื่องแล้ว ${dim('(ถ้าต้องการให้ key ใช้ไม่ได้ เพิกถอนที่หน้า /keys บนเว็บ)')}`);
}

async function cmdWhoami(argv) {
  const { flags } = parseFlags(argv, { bools: ['json'] });
  const me = await request('GET', '/api/auth/me');
  out(flags, me, () => console.log(`${bold(me.email)}${me.name ? ` (${me.name})` : ''}  ${dim(apiBase())}`));
}

async function cmdShorten(argv) {
  const { flags, pos } = parseFlags(argv, { bools: ['json'], short: { a: 'alias', e: 'expires', p: 'password', m: 'max' } });
  if (!pos[0]) fail('ใช้: surl shorten <url> [--alias ชื่อ] [--expires 7d|2026-12-31] [--start …] [--max N] [--password รหัส]');
  const body = { url: pos[0] };
  if (flags.alias) body.alias = String(flags.alias);
  if (flags.expires) body.expiresAt = parseWhen(flags.expires, '--expires');
  if (flags.start) body.startsAt = parseWhen(flags.start, '--start');
  if (flags.max !== undefined) {
    if (!/^\d+$/.test(String(flags.max))) fail('--max ต้องเป็นจำนวนเต็ม');
    body.maxClicks = Number(flags.max);
  }
  if (flags.password) body.password = String(flags.password);
  const l = await request('POST', '/api/links', body);
  out(flags, l, () => {
    console.log(bold(l.shortUrl));
    console.log(dim(`  → ${l.originalUrl}`));
    const tags = [l.expiresAt && `หมดอายุ ${l.expiresAt.slice(0, 16).replace('T', ' ')}`, l.startsAt && `เริ่ม ${l.startsAt.slice(0, 16).replace('T', ' ')}`, l.maxClicks !== null && `เปิดได้ ${num(l.maxClicks)} ครั้ง`, l.hasPassword && 'มีรหัสผ่าน'].filter(Boolean);
    if (tags.length) console.log(dim(`  ${tags.join(' · ')}`));
  });
}

async function cmdLs(argv) {
  const { flags } = parseFlags(argv, { bools: ['json'], short: { q: 'q', n: 'limit' } });
  const page = Math.max(1, Number(flags.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(flags.limit) || 20));
  const data = await request('GET', `/api/links?page=${page}&pageSize=${limit}${flags.q ? `&q=${encodeURIComponent(flags.q)}` : ''}`);
  out(flags, data, () => {
    if (!data.items.length) return console.log(dim(flags.q ? `ไม่พบลิงก์ที่ตรงกับ "${flags.q}"` : 'ยังไม่มีลิงก์'));
    const w = Math.max(...data.items.map((l) => shortOf(l.shortUrl).length));
    for (const l of data.items) {
      const lock = l.hasPassword ? ' 🔒' : '';
      console.log(`${bold(shortOf(l.shortUrl).padEnd(w))}  ${String(num(l.clickCount)).padStart(6)} ครั้ง  ${statusText(l)}${lock}  ${dim(l.originalUrl.length > 60 ? l.originalUrl.slice(0, 59) + '…' : l.originalUrl)}`);
    }
    const last = Math.max(1, Math.ceil(data.total / limit));
    console.log(dim(`\nหน้า ${page}/${last} · ทั้งหมด ${num(data.total)} ลิงก์${page < last ? ` · หน้าถัดไป: surl ls --page ${page + 1}` : ''}`));
  });
}

async function cmdStats(argv) {
  const { flags, pos } = parseFlags(argv, { bools: ['json'], short: { d: 'days' } });
  const link = await resolveLink(pos[0]);
  const days = Number(flags.days) || 30;
  const s = await request('GET', `/api/links/${link.id}/stats?days=${days}`);
  out(flags, s, () => {
    console.log(`${bold(shortOf(link.shortUrl))}  ${statusText(link)}  ${dim(link.originalUrl)}`);
    if (s.unavailable) return console.log(yellow(`\nระบบสถิติไม่พร้อม ตอนนี้รู้แค่ยอดรวม ${num(s.total)} ครั้ง`));
    console.log(`\n  ทั้งหมด ${bold(num(s.total))}   ${days} วันล่าสุด ${bold(num(s.windowClicks))}   ผู้เข้าชมไม่ซ้ำ ${bold(num(s.uniqueVisitors))}\n`);
    const max = Math.max(1, ...s.daily.map((d) => d.clicks));
    for (const d of s.daily.slice(-14)) console.log(`  ${d.day.slice(5)}  ${cyan('█'.repeat(Math.round((d.clicks / max) * 24)) || dim('·'))} ${d.clicks}`);
    const top = (title, items, label) => {
      if (!items.length) return;
      const total = items.reduce((a, b) => a + b.clicks, 0) || 1;
      console.log(`\n  ${bold(title)}`);
      for (const i of items.slice(0, 5)) console.log(`    ${String(label(i.key)).padEnd(22)} ${String(i.clicks).padStart(5)}  ${dim(`${Math.round((i.clicks / total) * 100)}%`)}`);
    };
    top('อุปกรณ์', s.devices, (k) => k ?? 'ไม่ทราบ');
    top('ระบบปฏิบัติการ', s.os, (k) => k ?? 'ไม่ทราบ');
    top('เบราว์เซอร์', s.browsers, (k) => k ?? 'ไม่ทราบ');
    top('ประเทศ', s.countries, (k) => k ?? 'ไม่ทราบ');
    top('เว็บที่พามา', s.referers, (k) => (k ? k.replace(/^https?:\/\//, '') : 'เข้าตรง'));
  });
}

async function cmdQr(argv) {
  const { flags, pos } = parseFlags(argv, { short: { o: 'out', f: 'format' } });
  const link = await resolveLink(pos[0]);
  const format = String(flags.format ?? (flags.out && /\.svg$/i.test(flags.out) ? 'svg' : 'png'));
  if (format !== 'png' && format !== 'svg') fail('--format ต้องเป็น png หรือ svg');
  const scale = Number(flags.scale) || 10;
  const buf = await request('GET', `/api/links/${link.id}/qr?format=${format}&scale=${scale}`, undefined, { raw: true });
  const file = path.resolve(String(flags.out ?? `qr-${link.shortCode}.${format}`));
  writeFileSync(file, buf);
  console.log(`${green('✔')} บันทึก QR แล้ว: ${file} ${dim(`(${shortOf(link.shortUrl)})`)}`);
}

async function cmdToggle(argv, to) {
  const { pos } = parseFlags(argv);
  const link = await resolveLink(pos[0]);
  await request('PATCH', `/api/links/${link.id}`, { status: to });
  console.log(`${green('✔')} ${to === 'ACTIVE' ? 'เปิด' : 'ปิด'}ลิงก์ ${bold(shortOf(link.shortUrl))} แล้ว`);
}

async function cmdRm(argv) {
  const { flags, pos } = parseFlags(argv, { bools: ['yes'], short: { y: 'yes' } });
  const link = await resolveLink(pos[0]);
  if (!flags.yes) {
    if (!process.stdin.isTTY) fail('ลบลิงก์ต้องยืนยัน: ใส่ -y');
    const a = await prompt(`ลบ ${shortOf(link.shortUrl)} (${num(link.clickCount)} ครั้ง) ถาวร? พิมพ์ y เพื่อยืนยัน: `);
    if (!/^y(es)?$/i.test(a)) return console.log(dim('ยกเลิก'));
  }
  await request('DELETE', `/api/links/${link.id}`);
  console.log(`${green('✔')} ลบ ${bold(shortOf(link.shortUrl))} แล้ว`);
}

function cmdConfig(argv) {
  const [sub, key, value] = argv;
  const cfg = readConfig();
  if (sub === 'set') {
    if (key !== 'api' || !value) fail('ใช้: surl config set api <URL ของ core-api>');
    if (!/^https?:\/\//.test(value)) fail('URL ต้องขึ้นต้นด้วย http:// หรือ https://');
    writeConfig({ ...cfg, api: value.replace(/\/+$/, '') });
    return console.log(`${green('✔')} ตั้ง API เป็น ${bold(value.replace(/\/+$/, ''))}`);
  }
  if (sub === 'path') return console.log(CONFIG_FILE);
  if (sub && sub !== 'get') fail('ใช้: surl config [set api <URL> | path]');
  console.log(`${bold('API')}    ${apiBase(cfg)}${process.env.SURL_API ? dim('  (จาก SURL_API)') : cfg.api ? '' : dim('  (ค่าเริ่มต้น)')}`);
  const t = apiToken(cfg);
  console.log(`${bold('Key')}    ${t ? `${t.slice(0, 11)}…${process.env.SURL_TOKEN ? dim('  (จาก SURL_TOKEN)') : ''}` : dim('ยังไม่ได้เข้าสู่ระบบ')}`);
  console.log(`${bold('ไฟล์')}   ${dim(CONFIG_FILE)}`);
}

function printHelp() {
  console.log(`${bold('surl')} — CLI ของโปรเจกต์ Short URL

${bold('ใช้งาน')}
  surl dev                      เปิดเมนูเลือก service ที่จะรัน (ค่าเริ่มต้น = ทั้งหมด)
  surl dev all                  รันทุก service ที่มีโค้ดแล้ว ไม่ถามเมนู
  surl dev core-api frontend    รันเฉพาะที่ระบุ
  surl dev all nomigrate down   ใส่คำท้ายได้ (ดูด้านล่าง)
  surl status                   ดูว่า port ไหนเปิดอยู่
  surl migrate                  รัน prisma migrate deploy (ใช้ค่าจาก .env)
  surl help

${bold('ใช้งานลิงก์')} ${dim('(ต้องมี API key จากหน้า /keys บนเว็บ)')}
  surl login --token surl_…     เก็บ key ไว้ในเครื่อง (เพิ่ม --api <URL> ถ้าไม่ใช่ localhost:4000)
  surl whoami                   ดูว่าล็อกอินเป็นใคร
  surl shorten <url>            ย่อลิงก์  [--alias ชื่อ] [--expires 7d|2026-12-31] [--start …] [--max N] [--password รหัส]
  surl ls [-q คำค้น]            รายการลิงก์  [--page N] [--limit N]
  surl stats <code>             สถิติ  [--days 30]
  surl qr <code>                บันทึก QR เป็นไฟล์  [-o ไฟล์] [--format png|svg] [--scale 10]
  surl on|off <code>            เปิด/ปิดลิงก์
  surl rm <code> [-y]           ลบลิงก์ถาวร
  surl logout                   ลบ key ออกจากเครื่อง
  surl config                   ดู/ตั้งค่า  (surl config set api <URL>)
  ทุกคำสั่งใส่ --json ได้เพื่อได้ผลลัพธ์เป็น JSON · <code> ใช้ URL สั้นเต็มก็ได้
  ตัวแปร: SURL_TOKEN, SURL_API (ทับค่าในไฟล์)

${bold('ชื่อ service')}
${SERVICES.map((s) => `  ${s.id.padEnd(18)} ${s.label}${s.aliases.length ? dim(`  (ย่อ: ${s.aliases.join(', ')})`) : ''}${isAvailable(s) ? '' : dim('  — ยังไม่มีโค้ด')}`).join('\n')}

${bold('คำท้ายของ dev')} (พิมพ์ต่อท้ายได้เลย ไม่ต้องมี --)
  all               รันทั้งหมด ไม่ถามเมนู
  nomigrate         ไม่รัน prisma migrate deploy ก่อนเริ่ม core-api
  down              ตอนกด Ctrl+C ให้หยุด docker (postgres/redis) ด้วย (ค่าเริ่มต้น: ปล่อยรันต่อ)
`);
}

// ---------- main ----------
const [cmd = 'help', ...rest] = process.argv.slice(2);
try {
  if (cmd === 'dev') await cmdDev(rest);
  else if (cmd === 'status') await cmdStatus();
  else if (cmd === 'migrate') cmdMigrate();
  else if (cmd === 'login') await cmdLogin(rest);
  else if (cmd === 'logout') cmdLogout();
  else if (cmd === 'whoami') await cmdWhoami(rest);
  else if (cmd === 'shorten') await cmdShorten(rest);
  else if (cmd === 'ls' || cmd === 'list') await cmdLs(rest);
  else if (cmd === 'stats') await cmdStats(rest);
  else if (cmd === 'qr') await cmdQr(rest);
  else if (cmd === 'on') await cmdToggle(rest, 'ACTIVE');
  else if (cmd === 'off') await cmdToggle(rest, 'DISABLED');
  else if (cmd === 'rm') await cmdRm(rest);
  else if (cmd === 'config') cmdConfig(rest);
  else if (cmd === 'help' || cmd === '-h' || cmd === '--help') printHelp();
  else fail(`ไม่รู้จักคำสั่ง "${cmd}" (ดู: surl help)`);
} catch (e) {
  console.error(red(`✗ ${e?.message ?? e}`));
  process.exit(1);
}
