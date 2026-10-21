import type { Role } from '@prisma/client';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app';
import { issueTokens } from '../src/auth/auth.service';
import { prisma } from '../src/prisma/client';
import { redis } from '../src/redis/client';

export interface Res<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export interface TestServer {
  base: string;
  server: Server;
}

export async function startServer(): Promise<TestServer> {
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server };
}

/** ล้างทุกอย่างในฐานทดสอบ (ฐาน/Redis ถูกตรวจใน setup.ts แล้วว่าเป็นของทดสอบ) */
export async function resetState() {
  await redis.flushdb();
  await prisma.auditLog.deleteMany();
  await prisma.link.deleteMany(); // clicks/daily stats ลบตามด้วย cascade
  await prisma.blockedDomain.deleteMany();
  await prisma.user.deleteMany();
}

export async function shutdown(s: TestServer | undefined) {
  if (s) await new Promise((r) => s.server.close(r));
  await prisma.$disconnect();
  redis.disconnect();
}

let seq = 0;
export async function makeUser(role: Role = 'USER', extra: { isBanned?: boolean } = {}) {
  const user = await prisma.user.create({ data: { email: `u${Date.now()}-${++seq}@example.test`, name: `User ${seq}`, role, ...extra } });
  const { accessToken } = await issueTokens(user.id);
  return { user, token: accessToken };
}

export function client(base: string) {
  const call = async <T = any>(method: string, path: string, opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<Res<T>> => {
    const res = await fetch(base + path, {
      method,
      redirect: 'manual', // ไม่ตามการ redirect (เช่น SSO ไป Google) ให้ทดสอบ Location ได้
      headers: {
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const type = res.headers.get('content-type') ?? '';
    const body = res.status === 204 ? null : type.includes('json') ? await res.json() : type.startsWith('image/png') ? Buffer.from(await res.arrayBuffer()) : await res.text();
    return { status: res.status, body: body as T, headers: res.headers };
  };
  return {
    get: <T = any>(p: string, token?: string, headers?: Record<string, string>) => call<T>('GET', p, { token, headers }),
    post: <T = any>(p: string, body?: unknown, token?: string, headers?: Record<string, string>) => call<T>('POST', p, { token, body: body ?? {}, headers }),
    patch: <T = any>(p: string, body: unknown, token?: string) => call<T>('PATCH', p, { token, body }),
    put: <T = any>(p: string, body: unknown, token?: string) => call<T>('PUT', p, { token, body }),
    del: <T = any>(p: string, token?: string) => call<T>('DELETE', p, { token }),
  };
}

export const cookieOf = (res: Res, name: string): string | undefined => {
  const raw = res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  return raw?.split(';')[0].slice(name.length + 1);
};
