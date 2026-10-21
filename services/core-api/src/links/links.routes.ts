import { LinkStatus, Prisma } from '@prisma/client';
import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { config } from '../common/config';
import { HttpError } from '../common/http-error';
import { rateLimit } from '../common/rate-limit';
import { parseQrStyle } from '../qr/qr-style';
import { qrMatrix, renderQr, type QrFormat } from '../qr/qr.service';
import { prisma } from '../prisma/client';
import { toLinkDto } from './link.dto';
import { AnalyticsNotFound, fetchLinkStats } from './stats.client';
import { createLink, deleteLink, getOwnedLink, listLinks, updateLink } from './links.service';

// ผู้ใช้ที่ยังไม่ล็อกอิน: ย่อได้แต่ลิงก์สั้นล้วน (สุ่มรหัส ไม่มีชื่อเอง ไม่มี QR/สถิติ/ประวัติ) และลิงก์หมดอายุใน 7 วัน
export const guestRouter = Router();
const GUEST_LINK_DAYS = 7;

guestRouter.post('/links', rateLimit('guest-link-create', 10, 60), async (req, res) => {
  const b = bodyOf(req.body);
  if (!isString(b.url)) throw new HttpError(400, 'กรุณากรอกลิงก์');
  const expiresAt = new Date(Date.now() + GUEST_LINK_DAYS * 24 * 3600 * 1000).toISOString();
  const link = await createLink(null, { url: b.url, expiresAt });
  res.status(201).json({ shortUrl: toLinkDto(link).shortUrl, originalUrl: link.originalUrl, expiresAt: link.expiresAt });
});

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

// ฟิลด์ป้องกันลิงก์: ไม่ส่ง = ไม่เปลี่ยน, null = ยกเลิก; ตรวจรูปแบบละเอียดใน links.service
function protectionOf(b: Record<string, unknown>) {
  if (b.password !== undefined && b.password !== null && !isString(b.password)) throw new HttpError(400, 'รหัสผ่านของลิงก์ไม่ถูกต้อง');
  if (b.startsAt !== undefined && b.startsAt !== null && !isString(b.startsAt)) throw new HttpError(400, 'วันเริ่มใช้งานไม่ถูกต้อง');
  if (b.maxClicks !== undefined && b.maxClicks !== null && typeof b.maxClicks !== 'number') throw new HttpError(400, 'จำนวนคลิกสูงสุดไม่ถูกต้อง');
  return {
    password: b.password as string | null | undefined,
    startsAt: b.startsAt as string | null | undefined,
    maxClicks: b.maxClicks as number | null | undefined,
  };
}

linksRouter.post('/', rateLimit('link-create', 30, 60), async (req, res) => {
  const b = bodyOf(req.body);
  if (!isString(b.url)) throw new HttpError(400, 'กรุณากรอกลิงก์');
  if (b.alias !== undefined && b.alias !== null && !isString(b.alias)) throw new HttpError(400, 'ชื่อลิงก์ไม่ถูกต้อง');
  if (b.expiresAt !== undefined && b.expiresAt !== null && !isString(b.expiresAt)) throw new HttpError(400, 'วันหมดอายุไม่ถูกต้อง');

  const link = await createLink(req.user!.id, {
    url: b.url,
    alias: (b.alias as string | null | undefined) || undefined,
    expiresAt: b.expiresAt as string | null | undefined,
    ...protectionOf(b),
  });
  res.status(201).json(toLinkDto(link));
});

linksRouter.get('/', async (req, res) => {
  const q = isString(req.query.q) ? req.query.q.replace(/\u0000/g, '').trim().slice(0, 100) : ''; // ตัด NUL: Postgres รับใน text ไม่ได้
  const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(req.query.pageSize)) || 20));
  const { items, total } = await listLinks(req.user!.id, { q: q || undefined, page, pageSize });
  res.json({ items: items.map(toLinkDto), total, page, pageSize });
});

// ตัวเลขรวมของเจ้าของบัญชี (ทุกหน้า ไม่ใช่เฉพาะหน้าที่เปิดอยู่) สำหรับการ์ดสรุปบน dashboard
linksRouter.get('/summary', async (req, res) => {
  const userId = req.user!.id;
  const [total, active, clicks] = await prisma.$transaction([
    prisma.link.count({ where: { userId } }),
    prisma.link.count({ where: { userId, status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
    prisma.link.aggregate({ where: { userId }, _sum: { clickCount: true } }),
  ]);
  res.json({ total, active, clicks: clicks._sum.clickCount ?? 0 });
});

linksRouter.get('/:id', async (req, res) => {
  res.json(toLinkDto(await getOwnedLink(req.user!.id, parseId(req.params.id))));
});

linksRouter.patch('/:id', async (req, res) => {
  const b = bodyOf(req.body);
  if ('alias' in b) throw new HttpError(400, 'ไม่สามารถเปลี่ยนชื่อลิงก์หลังสร้างได้ (QR Code ที่แจกไปแล้วจะใช้ไม่ได้)');
  if (b.url !== undefined && !isString(b.url)) throw new HttpError(400, 'ลิงก์ไม่ถูกต้อง');
  if (b.expiresAt !== undefined && b.expiresAt !== null && !isString(b.expiresAt)) throw new HttpError(400, 'วันหมดอายุไม่ถูกต้อง');
  if (b.status !== undefined && b.status !== 'ACTIVE' && b.status !== 'DISABLED') {
    throw new HttpError(400, 'สถานะต้องเป็น ACTIVE หรือ DISABLED');
  }
  const link = await updateLink(req.user!.id, parseId(req.params.id), {
    url: b.url as string | undefined,
    expiresAt: b.expiresAt as string | null | undefined,
    status: b.status as LinkStatus | undefined,
    ...protectionOf(b),
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
// บันทึก/ล้างสไตล์ QR ของลิงก์ (body: {style: {...}} หรือ {style: null} = กลับเป็นค่าเริ่มต้น)
linksRouter.put('/:id/qr-style', async (req, res) => {
  const link = await getOwnedLink(req.user!.id, parseId(req.params.id));
  const b = bodyOf(req.body);
  if (!('style' in b)) throw new HttpError(400, 'ไม่มีข้อมูลสไตล์');
  const style = b.style === null ? null : parseQrStyle(b.style);
  await prisma.link.update({ where: { id: link.id }, data: { qrStyle: style === null ? Prisma.DbNull : (style as unknown as Prisma.InputJsonValue) } });
  res.json({ style });
});

linksRouter.get('/:id/qr', async (req, res) => {
  const link = await getOwnedLink(req.user!.id, parseId(req.params.id));

  const format = req.query.format ?? 'png';
  // matrix = ข้อมูลโมดูลให้หน้าเว็บวาด QR ตามสไตล์เอง (แสดงตัวอย่างสด + ดาวน์โหลด)
  if (format === 'matrix') return void res.json({ ...qrMatrix(`${config.publicBaseUrl}/${link.shortCode}`), style: link.qrStyle ?? null });
  if (format !== 'png' && format !== 'svg') throw new HttpError(400, 'format ต้องเป็น png, svg หรือ matrix');
  const scale = req.query.scale === undefined ? 10 : Number(req.query.scale);
  if (!Number.isInteger(scale) || scale < 1 || scale > 20) throw new HttpError(400, 'scale ต้องเป็นจำนวนเต็ม 1–20');

  const body = await renderQr(`${config.publicBaseUrl}/${link.shortCode}`, format as QrFormat, scale);
  res.type(format === 'png' ? 'image/png' : 'image/svg+xml');
  if (req.query.download === '1') res.attachment(`qr-${link.shortCode}.${format}`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.send(body);
});
