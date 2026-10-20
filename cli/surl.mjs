#!/usr/bin/env node
// surl — CLI ของโปรเจกต์ (Node 18+, ไม่มี dependency)
// ตอนนี้มีคำสั่งสำหรับพัฒนา: `surl dev` (เลือก/รันหลาย service พร้อมกัน), `surl status`
// คำสั่งใช้งานลิงก์ (login/shorten/ls/stats/qr/...) จะเพิ่มใน P8
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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

${bold('ชื่อ service')}
${SERVICES.map((s) => `  ${s.id.padEnd(18)} ${s.label}${s.aliases.length ? dim(`  (ย่อ: ${s.aliases.join(', ')})`) : ''}${isAvailable(s) ? '' : dim('  — ยังไม่มีโค้ด')}`).join('\n')}

${bold('คำท้ายของ dev')} (พิมพ์ต่อท้ายได้เลย ไม่ต้องมี --)
  all               รันทั้งหมด ไม่ถามเมนู
  nomigrate         ไม่รัน prisma migrate deploy ก่อนเริ่ม core-api
  down              ตอนกด Ctrl+C ให้หยุด docker (postgres/redis) ด้วย (ค่าเริ่มต้น: ปล่อยรันต่อ)

${dim('คำสั่งใช้งานลิงก์ (login / shorten / ls / stats / qr ...) จะเพิ่มใน P8')}`);
}

// ---------- main ----------
const [cmd = 'help', ...rest] = process.argv.slice(2);
try {
  if (cmd === 'dev') await cmdDev(rest);
  else if (cmd === 'status') await cmdStatus();
  else if (cmd === 'migrate') cmdMigrate();
  else if (cmd === 'help' || cmd === '-h' || cmd === '--help') printHelp();
  else fail(`ไม่รู้จักคำสั่ง "${cmd}" (ดู: surl help)`);
} catch (e) {
  console.error(red(`✗ ${e?.message ?? e}`));
  process.exit(1);
}
