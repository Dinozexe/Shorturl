import { User } from '@prisma/client';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import { audit } from '../audit/audit.service';
import { config } from '../common/config';
import { HttpError } from '../common/http-error';
import { prisma } from '../prisma/client';
import { redis } from '../redis/client';
import { SsoError, type SsoProfile, type TokenPair } from './auth.types';

interface RefreshPayload {
  sub: string;
  jti: string;
  iatMs?: number;
}

const SESSION_EXPIRED = 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';
const BAD_CREDENTIALS = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
const LOGIN_EMAIL_LIMIT = 10; // ครั้ง/15 นาที ต่ออีเมล (กันเดารหัสข้าม IP)
const LOGIN_EMAIL_WINDOW_SEC = 15 * 60;

// เทียบแบบ constant-time ผ่าน sha256 (ความยาวเท่ากันเสมอ)
const sha = (s: string) => createHash('sha256').update(s).digest();
const safeEqual = (a: string, b: string) => timingSafeEqual(sha(a), sha(b));

/**
 * หาหรือสร้างผู้ใช้จากโปรไฟล์ SSO (ระบุตัวตนด้วย provider+sub ไม่ใช่อีเมล)
 * ผูกเข้าบัญชีเดิมที่มีอีเมลตรงกันได้เฉพาะเมื่อ provider รับรองอีเมล
 */
export async function signInWithProfile(profile: SsoProfile): Promise<User> {
  const email = profile.email.trim().toLowerCase();

  const identity = await prisma.ssoIdentity.findUnique({
    where: { provider_subject: { provider: profile.provider, subject: profile.subject } },
    include: { user: true },
  });

  let user: User;
  let registered = false;

  if (identity) {
    user = identity.user;
    await assertNotBanned(user);
    await prisma.ssoIdentity.update({
      where: { id: identity.id },
      data: { email, emailVerified: profile.emailVerified, lastLoginAt: new Date() },
    });
  } else {
    const existing = await prisma.user.findUnique({ where: { email }, include: { identities: true } });

    if (existing) {
      await assertNotBanned(existing);
      if (!profile.emailVerified) {
        throw new SsoError('อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบด้วย Google');
      }
      const verified = existing.identities.filter((i) => i.emailVerified);
      if (verified.some((i) => i.provider === profile.provider)) {
        throw new SsoError('บัญชีนี้ผูกกับบัญชีผู้ให้บริการเดียวกันอีกบัญชีหนึ่งไว้แล้ว');
      }
      // กัน nOAuth: identity ที่อีเมลยังไม่ยืนยันอาจถูกสร้างโดยคนอื่น → ลบทิ้งและเตะทุก session
      const stale = existing.identities.filter((i) => !i.emailVerified);
      await prisma.$transaction([
        prisma.ssoIdentity.deleteMany({ where: { id: { in: stale.map((i) => i.id) } } }),
        prisma.ssoIdentity.create({
          data: {
            userId: existing.id,
            provider: profile.provider,
            subject: profile.subject,
            email,
            emailVerified: profile.emailVerified,
          },
        }),
      ]);
      if (stale.length) await revokeAllSessions(existing.id);
      user = existing;
    } else {
      user = await prisma.user.create({
        data: {
          email,
          name: profile.name,
          identities: {
            create: {
              provider: profile.provider,
              subject: profile.subject,
              email,
              emailVerified: profile.emailVerified,
            },
          },
        },
      });
      registered = true;
    }
  }

  user = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), ...(user.name ? {} : { name: profile.name }) },
  });

  await audit(registered ? 'USER_REGISTER' : 'USER_LOGIN', {
    actorId: user.id,
    targetType: 'USER',
    targetId: user.id,
    detail: profile.provider,
  });
  return user;
}

async function assertNotBanned(user: User) {
  if (!user.isBanned) return;
  await audit('USER_LOGIN_BLOCKED', { actorId: user.id, targetType: 'USER', targetId: user.id });
  throw new SsoError('บัญชีนี้ถูกระงับการใช้งาน');
}

/**
 * ล็อกอินด้วยอีเมล+รหัสผ่าน — ใช้ได้เฉพาะบัญชีเดโมใน env (DEMO_ADMIN_EMAIL/PASSWORD)
 * ไม่เก็บรหัสผ่านหรือ hash ใน DB; ผู้ใช้ทั่วไปเข้าด้วย SSO เท่านั้น
 */
export async function loginWithPassword(rawEmail: string, password: string): Promise<User> {
  const email = rawEmail.trim().toLowerCase();

  const key = `rl:login-email:${email}`;
  const attempts = await redis.incr(key);
  if (attempts === 1) await redis.expire(key, LOGIN_EMAIL_WINDOW_SEC);
  if (attempts > LOGIN_EMAIL_LIMIT) throw new HttpError(429, 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ภายหลัง');

  const demo = config.demoAdmin;
  // เทียบทั้งอีเมลและรหัสเสมอ (ไม่ short-circuit) เพื่อไม่ให้เวลาตอบบอกใบ้ว่าอีเมลถูก
  const emailOk = safeEqual(email, demo?.email ?? randomUUID());
  const passwordOk = safeEqual(password, demo?.password ?? randomUUID());
  if (!demo || !emailOk || !passwordOk) throw new HttpError(401, BAD_CREDENTIALS);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new HttpError(401, BAD_CREDENTIALS); // ยังไม่ได้ seed

  // ตรวจ ban หลังรหัสผ่านถูกเท่านั้น (ไม่เปิดเผยสถานะบัญชีให้คนเดารหัส)
  if (user.isBanned) {
    await audit('USER_LOGIN_BLOCKED', { actorId: user.id, targetType: 'USER', targetId: user.id, detail: 'password' });
    throw new HttpError(403, 'บัญชีนี้ถูกระงับการใช้งาน');
  }

  await redis.del(key);
  const updated = await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit('USER_LOGIN', { actorId: user.id, targetType: 'USER', targetId: user.id, detail: 'password' });
  return updated;
}

/** ออก access (15 นาที) + refresh (7 วัน); refresh jti เก็บใน Redis ใช้ได้ครั้งเดียว */
export async function issueTokens(userId: string): Promise<TokenPair> {
  const refreshJti = randomUUID();
  // iat ของ JWT ละเอียดแค่วินาที → ใส่เวลาแบบ ms ไว้เทียบกับ rtnbf (เวลาเพิกถอนทุก session)
  const iatMs = Date.now();
  const accessToken = jwt.sign({ sub: userId, iatMs }, config.jwtAccessSecret, {
    algorithm: 'HS256',
    expiresIn: config.accessTtlSec,
    jwtid: randomUUID(),
  });
  const refreshToken = jwt.sign({ sub: userId, iatMs }, config.jwtRefreshSecret, {
    algorithm: 'HS256',
    expiresIn: config.refreshTtlSec,
    jwtid: refreshJti,
  });
  await redis.set(`rt:${refreshJti}`, userId, 'EX', config.refreshTtlSec);
  return { accessToken, refreshToken, expiresIn: config.accessTtlSec };
}

/** หมุน refresh token: ใช้ซ้ำ = เพิกถอนทุก session ของผู้ใช้นั้น */
export async function refresh(refreshToken: string | undefined): Promise<TokenPair & { user: User }> {
  if (!refreshToken) throw new HttpError(401, SESSION_EXPIRED);

  let payload: RefreshPayload;
  try {
    payload = jwt.verify(refreshToken, config.jwtRefreshSecret, { algorithms: ['HS256'] }) as unknown as RefreshPayload;
  } catch {
    throw new HttpError(401, SESSION_EXPIRED);
  }

  const notBefore = await redis.get(`rtnbf:${payload.sub}`);
  if (notBefore && (payload.iatMs ?? 0) < Number(notBefore)) throw new HttpError(401, SESSION_EXPIRED);

  const owner = await redis.getdel(`rt:${payload.jti}`);
  if (!owner) {
    await revokeAllSessions(payload.sub);
    throw new HttpError(401, 'ตรวจพบการใช้ token ซ้ำ ระบบออกจากระบบทุกอุปกรณ์แล้ว กรุณาเข้าสู่ระบบใหม่');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.isBanned) throw new HttpError(401, SESSION_EXPIRED);

  return { ...(await issueTokens(user.id)), user };
}

/** logout: ลบ refresh ที่ยังใช้ได้ + blacklist access token ที่เหลือ TTL */
export async function logout(refreshToken: string | undefined, accessToken: string | undefined) {
  if (refreshToken) {
    const p = jwt.decode(refreshToken) as RefreshPayload | null;
    if (p?.jti) await redis.del(`rt:${p.jti}`);
  }
  if (accessToken) {
    try {
      const p = jwt.verify(accessToken, config.jwtAccessSecret, { algorithms: ['HS256'] }) as unknown as {
        jti: string;
        exp: number;
      };
      const ttl = p.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) await redis.set(`bl:${p.jti}`, '1', 'EX', ttl);
    } catch {
      // access token หมดอายุ/ไม่ถูกต้อง = ใช้ไม่ได้อยู่แล้ว
    }
  }
}

/** เพิกถอนทุก session: token ที่ออกก่อนเวลานี้ (ms) ใช้ไม่ได้ (ban / ตรวจพบใช้ซ้ำ / ผูก SSO) */
export async function revokeAllSessions(userId: string) {
  await redis.set(`rtnbf:${userId}`, String(Date.now()), 'EX', config.refreshTtlSec);
}
