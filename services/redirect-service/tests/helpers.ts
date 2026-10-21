import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app';
import { CLICK_QUEUE } from '../src/clicks';
import { pool } from '../src/db';
import { redis } from '../src/redis';

export async function startServer() {
  const server: Server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

export async function resetState() {
  await redis.flushdb();
  await pool.query('DELETE FROM links');
}

export async function shutdown(s?: { server: Server }) {
  if (s) await new Promise((r) => s.server.close(r));
  await pool.end();
  redis.disconnect();
}

export interface LinkOpts {
  url?: string;
  status?: 'ACTIVE' | 'DISABLED' | 'ADMIN_DISABLED';
  expiresAt?: number | null; // epoch ms
  startsAt?: number | null;
  maxClicks?: number | null;
  passwordHash?: string | null;
  clickCount?: number;
}

let seq = 0;
/** เพิ่มลิงก์ตรงใน DB (เวลาเป็น timestamptz) */
export async function addLink(code = `t${Date.now().toString(36)}${++seq}`, o: LinkOpts = {}) {
  const { rows } = await pool.query(
    `INSERT INTO links (short_code, original_url, original_host, status, expires_at, starts_at, max_clicks, password_hash, click_count)
     VALUES ($1, $2, 'example.com', $3::"LinkStatus", to_timestamp($4::double precision / 1000), to_timestamp($5::double precision / 1000), $6, $7, $8)
     RETURNING id`,
    [code, o.url ?? 'https://example.com/dest', o.status ?? 'ACTIVE', o.expiresAt ?? null, o.startsAt ?? null, o.maxClicks ?? null, o.passwordHash ?? null, o.clickCount ?? 0],
  );
  return { id: rows[0].id as number, code };
}

export const get = (base: string, path: string, headers: Record<string, string> = {}, method = 'GET') => fetch(base + path, { method, redirect: 'manual', headers });
export const postPassword = (base: string, code: string, password: string, headers: Record<string, string> = {}) =>
  fetch(`${base}/${code}`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }, body: `password=${encodeURIComponent(password)}` });

export async function queued() {
  const raws = await redis.lrange(CLICK_QUEUE, 0, -1);
  return raws.map((r) => JSON.parse(r));
}
/** รอให้คิวคลิกมีอย่างน้อย n รายการ (เข้าคิวหลังตอบ redirect แบบ fire-and-forget) */
export async function waitQueue(n: number, timeoutMs = 2000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if ((await redis.llen(CLICK_QUEUE)) >= n) return queued();
    await new Promise((r) => setTimeout(r, 25));
  }
  return queued();
}
