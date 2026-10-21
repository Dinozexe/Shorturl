import { randomBytes, scrypt, timingSafeEqual } from 'crypto';

// รหัสผ่านของลิงก์: scrypt + salt สุ่มต่อลิงก์ เก็บเป็น `scrypt$salt(hex)$hash(hex)`
// redirect-service มีโค้ดตรวจฝั่งเดียวกัน (services/redirect-service/src/password.ts) — ต้องเปลี่ยนคู่กัน
const KEY_LEN = 32;

const derive = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) => scrypt(password, salt, KEY_LEN, (err, key) => (err ? reject(err) : resolve(key))));

export async function hashLinkPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${(await derive(password, salt)).toString('hex')}`;
}

export async function verifyLinkPassword(password: string, stored: string): Promise<boolean> {
  const [alg, saltHex, hashHex] = stored.split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await derive(password, Buffer.from(saltHex, 'hex'));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
