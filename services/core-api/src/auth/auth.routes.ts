import { Router, type CookieOptions, type Response } from 'express';
import { config } from '../common/config';
import { HttpError } from '../common/http-error';
import { rateLimit } from '../common/rate-limit';
import * as auth from './auth.service';
import { SsoError } from './auth.types';
import { requireAuth } from './auth.middleware';
import * as sso from './sso.service';

const REFRESH_COOKIE = 'rt';

// path จำกัดเฉพาะ /api/auth เพื่อไม่ให้ cookie ถูกส่งไป endpoint อื่น
const cookieBase: CookieOptions = {
  httpOnly: true,
  secure: config.cookie.secure,
  sameSite: 'lax',
  path: '/api/auth',
  domain: config.cookie.domain,
};

const setRefreshCookie = (res: Response, token: string) =>
  res.cookie(REFRESH_COOKIE, token, { ...cookieBase, maxAge: config.refreshTtlSec * 1000 });

export const authRouter = Router();

authRouter.get('/sso/providers', (_req, res) => {
  res.json(sso.listProviders());
});

authRouter.get('/sso/:provider/start', rateLimit('sso', 20, 60), async (req, res) => {
  try {
    res.redirect(await sso.buildAuthUrl(String(req.params.provider)));
  } catch (e) {
    if (e instanceof SsoError) throw new HttpError(404, e.message);
    throw e;
  }
});

authRouter.get('/sso/:provider/callback', rateLimit('sso', 20, 60), async (req, res) => {
  const fail = (msg: string) => res.redirect(`${config.frontendOrigin}/login?sso_error=${encodeURIComponent(msg)}`);
  const { code, state, error } = req.query;

  if (typeof error === 'string') return fail('ยกเลิกการเข้าสู่ระบบ');
  if (typeof code !== 'string' || typeof state !== 'string') return fail('คำขอเข้าสู่ระบบไม่ถูกต้อง');

  try {
    const profile = await sso.handleCallback(String(req.params.provider), code, state);
    const user = await auth.signInWithProfile(profile);
    const tokens = await auth.issueTokens(user.id);
    setRefreshCookie(res, tokens.refreshToken);
    // access token ไม่ส่งผ่าน URL — frontend เรียก POST /api/auth/refresh เพื่อรับเอง
    // ผู้ดูแลระบบเข้าหน้าแอดมินเลย ผู้ใช้ทั่วไปเข้ารายการลิงก์ของตัวเอง
    res.redirect(`${config.frontendOrigin}${user.role === 'USER' ? '/dashboard' : '/admin'}`);
  } catch (e) {
    if (e instanceof SsoError) return fail(e.message);
    console.error('sso callback error', e);
    return fail('เกิดข้อผิดพลาด กรุณาลองใหม่');
  }
});

authRouter.post('/login', rateLimit('login', 10, 60), async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || email.length > 254 || password.length > 200) {
    throw new HttpError(400, 'กรุณากรอกอีเมลและรหัสผ่าน');
  }
  const user = await auth.loginWithPassword(email, password);
  const tokens = await auth.issueTokens(user.id);
  setRefreshCookie(res, tokens.refreshToken);
  res.json({
    accessToken: tokens.accessToken,
    expiresIn: tokens.expiresIn,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

authRouter.post('/refresh', rateLimit('refresh', 30, 60), async (req, res) => {
  try {
    const { user, refreshToken, accessToken, expiresIn } = await auth.refresh(req.cookies?.[REFRESH_COOKIE]);
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, expiresIn, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (e) {
    res.clearCookie(REFRESH_COOKIE, cookieBase);
    throw e;
  }
});

authRouter.post('/logout', async (req, res) => {
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  await auth.logout(req.cookies?.[REFRESH_COOKIE], bearer);
  res.clearCookie(REFRESH_COOKIE, cookieBase);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  const { id, email, name, role } = req.user!;
  res.json({ id, email, name, role });
});
