import { LinkStatus } from '@prisma/client';
import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { config } from '../common/config';
import { HttpError } from '../common/http-error';
import { rateLimit } from '../common/rate-limit';
import { renderQr, type QrFormat } from '../qr/qr.service';
import { toLinkDto } from './link.dto';
import { AnalyticsNotFound, fetchLinkStats } from './stats.client';
import { createLink, deleteLink, getOwnedLink, listLinks, updateLink } from './links.service';

export const linksRouter = Router();
linksRouter.use(requireAuth);

function parseId(raw: unknown): number {
  const id = Number(String(raw));
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) throw new HttpError(404, 'ไม่พบลิงก์');
  return id;
}

const isString = (v: unknown): v is string => typeof v === 'string';
const bodyOf = (body: unknown): Record<string, unknown> =>
  body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

linksRouter.post('/', rateLimit('link-create', 30, 60), async (req, res) => {
  const b = bodyOf(req.body);
  if (!isString(b.url)) throw new HttpError(400, 'กรุณากรอก URL');
  if (b.alias !== undefined && b.alias !== null && !isString(b.alias)) throw new HttpError(400, 'alias ไม่ถูกต้อง');
  if (b.expiresAt !== undefined && b.expiresAt !== null && !isString(b.expiresAt)) throw new HttpError(400, 'วันหมดอายุไม่ถูกต้อง');

  const link = await createLink(req.user!.id, {
    url: b.url,
    alias: (b.alias as string | null | undefined) || undefined,
    expiresAt: b.expiresAt as string | null | undefined,
  });
  res.status(201).json(toLinkDto(link));
});

linksRouter.get('/', async (req, res) => {
  const q = isString(req.query.q) ? req.query.q.trim().slice(0, 100) : '';
  const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(req.query.pageSize)) || 20));
  const { items, total } = await listLinks(req.user!.id, { q: q || undefined, page, pageSize });
  res.json({ items: items.map(toLinkDto), total, page, pageSize });
});

linksRouter.get('/:id', async (req, res) => {
  res.json(toLinkDto(await getOwnedLink(req.user!.id, parseId(req.params.id))));
});

linksRouter.patch('/:id', async (req, res) => {
  const b = bodyOf(req.body);
  if ('alias' in b) throw new HttpError(400, 'ไม่สามารถเปลี่ยน alias หลังสร้างได้ (QR ที่แจกไปแล้วจะใช้ไม่ได้)');
  if (b.url !== undefined && !isString(b.url)) throw new HttpError(400, 'URL ไม่ถูกต้อง');
  if (b.expiresAt !== undefined && b.expiresAt !== null && !isString(b.expiresAt)) throw new HttpError(400, 'วันหมดอายุไม่ถูกต้อง');
  if (b.status !== undefined && b.status !== 'ACTIVE' && b.status !== 'DISABLED') {
    throw new HttpError(400, 'สถานะต้องเป็น ACTIVE หรือ DISABLED');
  }
  const link = await updateLink(req.user!.id, parseId(req.params.id), {
    url: b.url as string | undefined,
    expiresAt: b.expiresAt as string | null | undefined,
    status: b.status as LinkStatus | undefined,
  });
  res.json(toLinkDto(link));
});

linksRouter.delete('/:id', async (req, res) => {
  await deleteLink(req.user!.id, parseId(req.params.id));
  res.status(204).end();
});

// สถิติการคลิก (?days=1..365 ค่าเริ่มต้น 30) — ดึงจาก analytics-service; ล่มแล้วตอบ unavailable: true แทน error
linksRouter.get('/:id/stats', async (req, res) => {
  const link = await getOwnedLink(req.user!.id, parseId(req.params.id));
  const days = req.query.days === undefined ? 30 : Number(req.query.days);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new HttpError(400, 'days ต้องเป็นจำนวนเต็ม 1–365');

  try {
    const stats = await fetchLinkStats(link.id, days);
    if (stats) return void res.json(stats);
  } catch (e) {
    if (!(e instanceof AnalyticsNotFound)) throw e;
  }
  res.json({ unavailable: true, linkId: link.id, total: link.clickCount });
});

// รูปแบบ ?format=png|svg&scale=1..20 (PNG: พิกเซลต่อโมดูล)&download=1
linksRouter.get('/:id/qr', async (req, res) => {
  const link = await getOwnedLink(req.user!.id, parseId(req.params.id));

  const format = req.query.format ?? 'png';
  if (format !== 'png' && format !== 'svg') throw new HttpError(400, 'format ต้องเป็น png หรือ svg');
  const scale = req.query.scale === undefined ? 10 : Number(req.query.scale);
  if (!Number.isInteger(scale) || scale < 1 || scale > 20) throw new HttpError(400, 'scale ต้องเป็นจำนวนเต็ม 1–20');

  const body = await renderQr(`${config.publicBaseUrl}/${link.shortCode}`, format as QrFormat, scale);
  res.type(format === 'png' ? 'image/png' : 'image/svg+xml');
  if (req.query.download === '1') res.attachment(`qr-${link.shortCode}.${format}`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.send(body);
});
