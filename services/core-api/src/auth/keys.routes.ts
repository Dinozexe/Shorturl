import { randomBytes } from 'crypto';
import { Router } from 'express';
import { audit } from '../audit/audit.service';
import { HttpError } from '../common/http-error';
import { rateLimit } from '../common/rate-limit';
import { prisma } from '../prisma/client';
import { API_KEY_PREFIX, hashApiKey, requireAuth, webSessionOnly } from './auth.middleware';

// API key สำหรับ CLI (`surl`): สร้าง/ดู/เพิกถอนได้จากหน้าเว็บเท่านั้น (ต้องล็อกอินด้วย session ไม่ใช่ key)
export const keysRouter = Router();
keysRouter.use(requireAuth, webSessionOnly);

const MAX_KEYS = 10;
const NAME_MAX = 40;
const MAX_EXPIRY_DAYS = 365;
const PREFIX_SHOWN = API_KEY_PREFIX.length + 6; // ส่วนต้นของ key ที่โชว์ไว้ให้จำได้ว่าเป็นอันไหน

const toDto = (k: { id: number; name: string; prefix: string; lastUsedAt: Date | null; expiresAt: Date | null; createdAt: Date }) => ({
  id: k.id,
  name: k.name,
  prefix: k.prefix,
  lastUsedAt: k.lastUsedAt,
  expiresAt: k.expiresAt,
  expired: k.expiresAt !== null && k.expiresAt.getTime() <= Date.now(),
  createdAt: k.createdAt,
});

keysRouter.get('/', async (req, res) => {
  const keys = await prisma.apiKey.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' } });
  res.json({ items: keys.map(toDto), max: MAX_KEYS });
});

keysRouter.post('/', rateLimit('key-create', 10, 60), async (req, res) => {
  const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : {};
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name || name.length > NAME_MAX) throw new HttpError(400, `ชื่อ key ต้องยาว 1–${NAME_MAX} ตัวอักษร`);
  let expiresAt: Date | null = null;
  if (b.expiresInDays !== undefined && b.expiresInDays !== null) {
    const d = b.expiresInDays;
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 1 || d > MAX_EXPIRY_DAYS) throw new HttpError(400, `อายุ key ต้องเป็น 1–${MAX_EXPIRY_DAYS} วัน`);
    expiresAt = new Date(Date.now() + d * 24 * 3600 * 1000);
  }
  const userId = req.user!.id;
  if ((await prisma.apiKey.count({ where: { userId } })) >= MAX_KEYS) throw new HttpError(400, `สร้าง API key ได้สูงสุด ${MAX_KEYS} อัน ลบอันที่ไม่ใช้ก่อน`);

  const raw = API_KEY_PREFIX + randomBytes(24).toString('base64url'); // 192 บิต
  const key = await prisma.apiKey.create({ data: { userId, name, prefix: raw.slice(0, PREFIX_SHOWN), keyHash: hashApiKey(raw), expiresAt } });
  await audit('API_KEY_CREATE', { actorId: userId, targetType: 'API_KEY', targetId: String(key.id), detail: name });
  // key เต็มส่งกลับครั้งเดียวตอนสร้าง — หลังจากนี้ในระบบมีแต่ hash
  res.status(201).json({ ...toDto(key), key: raw });
});

keysRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const key = Number.isInteger(id) && id > 0 && id <= 2147483647 ? await prisma.apiKey.findFirst({ where: { id, userId: req.user!.id } }) : null;
  if (!key) throw new HttpError(404, 'ไม่พบ API key');
  await prisma.apiKey.delete({ where: { id } });
  await audit('API_KEY_REVOKE', { actorId: req.user!.id, targetType: 'API_KEY', targetId: String(id), detail: key.name });
  res.status(204).end();
});
