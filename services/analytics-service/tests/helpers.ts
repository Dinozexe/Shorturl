import { createHash } from 'node:crypto';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app';
import { pool } from '../src/db';
import { CLICK_QUEUE } from '../src/events';
import { redis } from '../src/redis';

export const KEY = 'test-internal-key-0123456789';

export async function startServer() {
  const server: Server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

export async function resetState() {
  await redis.flushdb();
  await pool.query('DELETE FROM links'); // clicks / link_daily_stats ลบตามด้วย cascade
}

export async function shutdown(s?: { server: Server }) {
  if (s) await new Promise((r) => s.server.close(r));
  await pool.end();
  redis.disconnect();
}

let seq = 0;
export async function addLink(clickCount = 0) {
  const { rows } = await pool.query(`INSERT INTO links (short_code, original_url, original_host, click_count) VALUES ($1, 'https://example.com', 'example.com', $2) RETURNING id`, [`an${Date.now().toString(36)}${++seq}`, clickCount]);
  return rows[0].id as number;
}

export const ipHash = (n: number | string) => createHash('sha256').update(`ip-${n}`).digest('hex');

export interface Ev { l: number; h?: string; ua?: string | null; r?: string | null; c?: string | null; d?: string; o?: string | null; b?: string | null; t?: number }
/** สร้างเหตุการณ์คลิกตามสัญญากับ redirect-service */
export const ev = (e: Ev) => JSON.stringify({ h: ipHash('a'), ua: 'ua', r: null, c: null, d: 'desktop', o: 'Windows', b: 'Chrome', t: Date.now(), ...e });
export const push = (...events: string[]) => redis.rpush(CLICK_QUEUE, ...events);

export const call = (base: string, path: string, init: RequestInit & { key?: string | null } = {}) =>
  fetch(base + path, { method: init.method ?? 'GET', headers: { ...(init.key === null ? {} : { 'x-internal-key': init.key ?? KEY }), ...(init.headers as object) }, redirect: 'manual' });
