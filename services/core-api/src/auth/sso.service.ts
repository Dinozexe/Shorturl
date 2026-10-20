import { SsoProvider } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { config } from '../common/config';
import { redis } from '../redis/client';
import { SsoError, type SsoProfile } from './auth.types';

interface ProviderDef {
  id: SsoProvider;
  label: string;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  jwksUrl: string;
  scope: string;
  isValidIssuer: (iss: string) => boolean;
}

interface SsoState {
  provider: SsoProvider;
  nonce: string;
  verifier: string;
}

type Claims = JWTPayload & Record<string, unknown>;

const STATE_TTL_SEC = 10 * 60;
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

const b64url = (buf: Buffer) => buf.toString('base64url');
const truthy = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';

function definitions(): ProviderDef[] {
  const { google, microsoft } = config;
  const tenant = microsoft.tenant;
  const multiTenant = tenant === 'common' || tenant === 'organizations' || tenant === 'consumers';
  const all: ProviderDef[] = [
    {
      id: 'google',
      label: 'Google',
      clientId: google.clientId,
      clientSecret: google.clientSecret,
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
      scope: 'openid email profile',
      isValidIssuer: (iss) => iss === 'https://accounts.google.com' || iss === 'accounts.google.com',
    },
    {
      id: 'microsoft',
      label: 'Microsoft',
      clientId: microsoft.clientId,
      clientSecret: microsoft.clientSecret,
      authUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
      tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      jwksUrl: `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`,
      scope: 'openid email profile',
      // tenant=common → issuer เป็นของ tenant จริงของผู้ใช้ จึงเช็ครูปแบบแทน
      isValidIssuer: (iss) =>
        multiTenant
          ? /^https:\/\/login\.microsoftonline\.com\/[0-9a-f-]+\/v2\.0$/i.test(iss)
          : iss === `https://login.microsoftonline.com/${tenant}/v2.0`,
    },
  ];
  return all.filter((p) => p.clientId && p.clientSecret);
}

function find(provider: string): ProviderDef {
  const def = definitions().find((p) => p.id === provider);
  if (!def) throw new SsoError('ไม่รองรับการเข้าสู่ระบบด้วยบริการนี้');
  return def;
}

const redirectUri = (provider: SsoProvider) => `${config.apiBaseUrl}/api/auth/sso/${provider}/callback`;

export function listProviders() {
  return definitions().map(({ id, label }) => ({ id, label }));
}

/** สร้าง URL ส่งผู้ใช้ไปหน้าล็อกอินของ provider (code flow + PKCE + state + nonce) */
export async function buildAuthUrl(provider: string): Promise<string> {
  const def = find(provider);
  const state = b64url(randomBytes(24));
  const nonce = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());

  const saved: SsoState = { provider: def.id, nonce, verifier };
  await redis.set(`sso:${state}`, JSON.stringify(saved), 'EX', STATE_TTL_SEC);

  const params = new URLSearchParams({
    client_id: def.clientId,
    redirect_uri: redirectUri(def.id),
    response_type: 'code',
    scope: def.scope,
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `${def.authUrl}?${params}`;
}

/** แลก code → id_token, ตรวจลายเซ็น/issuer/audience/nonce แล้วแปลงเป็นโปรไฟล์กลาง */
export async function handleCallback(provider: string, code: string, state: string): Promise<SsoProfile> {
  const def = find(provider);

  // state ใช้ได้ครั้งเดียว (กัน replay / CSRF)
  const raw = await redis.getdel(`sso:${state}`);
  if (!raw) throw new SsoError('คำขอเข้าสู่ระบบหมดอายุ กรุณาลองใหม่');
  const saved = JSON.parse(raw) as SsoState;
  if (saved.provider !== def.id) throw new SsoError('คำขอเข้าสู่ระบบไม่ถูกต้อง');

  const res = await fetch(def.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: def.clientId,
      client_secret: def.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri(def.id),
      code_verifier: saved.verifier,
    }),
  });
  if (!res.ok) throw new SsoError('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');
  const { id_token: idToken } = (await res.json()) as { id_token?: string };
  if (!idToken) throw new SsoError('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');

  let claims: Claims;
  try {
    let jwks = jwksCache.get(def.id);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(def.jwksUrl));
      jwksCache.set(def.id, jwks);
    }
    claims = (await jwtVerify(idToken, jwks, { audience: def.clientId })).payload as Claims;
  } catch {
    throw new SsoError('ตรวจสอบข้อมูลจากผู้ให้บริการไม่ผ่าน');
  }
  if (typeof claims.iss !== 'string' || !def.isValidIssuer(claims.iss) || claims.nonce !== saved.nonce || !claims.sub) {
    throw new SsoError('ตรวจสอบข้อมูลจากผู้ให้บริการไม่ผ่าน');
  }

  return def.id === 'google' ? googleProfile(claims) : microsoftProfile(claims);
}

function googleProfile(claims: Claims): SsoProfile {
  const email = typeof claims.email === 'string' ? claims.email : '';
  // Google ต้อง email_verified=true เท่านั้น
  if (!email || !truthy(claims.email_verified)) throw new SsoError('บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล');
  return {
    provider: 'google',
    subject: claims.sub!,
    email,
    emailVerified: true,
    name: typeof claims.name === 'string' ? claims.name : null,
  };
}

function microsoftProfile(claims: Claims): SsoProfile {
  const email =
    typeof claims.email === 'string' ? claims.email : typeof claims.preferred_username === 'string' ? claims.preferred_username : '';
  if (!email.includes('@')) throw new SsoError('ไม่พบอีเมลในบัญชี Microsoft นี้');
  return {
    provider: 'microsoft',
    subject: claims.sub!,
    email,
    // Microsoft ไม่รับรองอีเมลเว้นแต่มี claim xms_edov
    emailVerified: truthy(claims.xms_edov),
    name: typeof claims.name === 'string' ? claims.name : null,
  };
}
