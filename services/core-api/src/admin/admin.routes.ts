import { AuditAction, LinkStatus, Prisma, Role } from '@prisma/client';
import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import { revokeAllSessions } from '../auth/auth.service';
import { audit } from '../audit/audit.service';
import { HttpError } from '../common/http-error';
import { rateLimit } from '../common/rate-limit';
import { clearLinkCache, syncLinkCache } from '../links/link.cache';
import { toLinkDto } from '../links/link.dto';
import { AnalyticsNotFound, fetchLinkStats } from '../links/stats.client';
import { prisma } from '../prisma/client';

// เมทริกซ์สิทธิ์ (ตาม PRD): MODERATOR = ภาพรวม/ลิงก์/โดเมนบล็อก · ADMIN = ทั้งหมด + ผู้ใช้ (ระงับ/เปลี่ยนบทบาท) + audit log
export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('MODERATOR', 'ADMIN'), rateLimit('admin', 120, 60));

const isString = (v: unknown): v is string => typeof v === 'string';
const bodyOf = (body: unknown): Record<string, unknown> =>
  body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
const pageOf = (q: Record<string, unknown>) => ({
  page: Math.max(1, Math.floor(Number(q.page)) || 1),
  pageSize: Math.min(100, Math.max(1, Math.floor(Number(q.pageSize)) || 20)),
});
const qOf = (q: Record<string, unknown>) => (isString(q.q) ? q.q.trim().slice(0, 100) : '');
// ตัวกรองช่วงเวลา: days=1|7|30|90 → createdAt ≥ เวลานั้น (ค่าอื่น = ไม่กรอง)
const sinceOf = (q: Record<string, unknown>): Date | undefined => {
  const d = Number(q.days);
  return [1, 7, 30, 90].includes(d) ? new Date(Date.now() - d * 24 * 3600 * 1000) : undefined;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseLinkId(raw: unknown): number {
  const id = Number(String(raw));
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) throw new HttpError(404, 'ไม่พบลิงก์');
  return id;
}

// ---- ภาพรวม ----
adminRouter.get('/overview', async (_req, res) => {
  const [users, banned, links, adminDisabled, blockedDomains, clicks] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.link.count(),
    prisma.link.count({ where: { status: 'ADMIN_DISABLED' } }),
    prisma.blockedDomain.count(),
    prisma.link.aggregate({ _sum: { clickCount: true } }),
  ]);
  res.json({ users, bannedUsers: banned, links, adminDisabledLinks: adminDisabled, blockedDomains, clicks: clicks._sum.clickCount ?? 0 });
});

// ---- ผู้ใช้ ----
const adminOnly = requireRole('ADMIN');

adminRouter.get('/users', adminOnly, async (req, res) => {
  const { page, pageSize } = pageOf(req.query);
  const q = qOf(req.query);
  const role = isString(req.query.role) && (['USER', 'MODERATOR', 'ADMIN'] as const).includes(req.query.role as Role) ? (req.query.role as Role) : undefined;
  const banned = req.query.banned === '1' ? true : req.query.banned === '0' ? false : undefined;
  const since = sinceOf(req.query);
  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(banned !== undefined ? { isBanned: banned } : {}),
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] } : {}),
  };
  const orderBy: Prisma.UserOrderByWithRelationInput = req.query.sort === 'login' ? { lastLoginAt: { sort: 'desc', nulls: 'last' } } : req.query.sort === 'links' ? { links: { _count: 'desc' } } : { createdAt: 'desc' };
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { links: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  res.json({
    items: items.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isBanned: u.isBanned,
      linkCount: u._count.links,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    })),
    total,
    page,
    pageSize,
  });
});

adminRouter.patch('/users/:id', adminOnly, async (req, res) => {
  const actor = req.user!;
  const id = String(req.params.id);
  if (!UUID.test(id)) throw new HttpError(404, 'ไม่พบผู้ใช้');
  const b = bodyOf(req.body);
  if (b.isBanned !== undefined && typeof b.isBanned !== 'boolean') throw new HttpError(400, 'ค่าการระงับไม่ถูกต้อง');
  if (b.role !== undefined && !(['USER', 'MODERATOR', 'ADMIN'] as const).includes(b.role as Role)) throw new HttpError(400, 'บทบาทไม่ถูกต้อง');
  if (b.isBanned === undefined && b.role === undefined) throw new HttpError(400, 'ไม่มีข้อมูลที่จะแก้ไข');
  if (id === actor.id) throw new HttpError(400, 'ไม่สามารถแก้ไขบัญชีของตัวเองได้');

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new HttpError(404, 'ไม่พบผู้ใช้');
  // MODERATOR จัดการได้เฉพาะผู้ใช้ทั่วไป
  if (actor.role !== 'ADMIN' && target.role !== 'USER') throw new HttpError(403, 'คุณไม่มีสิทธิ์จัดการบัญชีนี้');
  if (b.role !== undefined && actor.role !== 'ADMIN') throw new HttpError(403, 'เฉพาะผู้ดูแลระบบสูงสุดที่เปลี่ยนบทบาทได้');

  const data: Prisma.UserUpdateInput = {};
  if (typeof b.isBanned === 'boolean' && b.isBanned !== target.isBanned) data.isBanned = b.isBanned;
  if (b.role !== undefined && b.role !== target.role) data.role = b.role as Role;
  if (Object.keys(data).length === 0) return void res.json({ id: target.id, role: target.role, isBanned: target.isBanned });

  const updated = await prisma.user.update({ where: { id }, data });
  if (data.isBanned === true) await revokeAllSessions(id); // ระงับแล้ว session เดิมใช้ต่อไม่ได้ทันที
  if (data.isBanned !== undefined) await audit(data.isBanned ? AuditAction.USER_BAN : AuditAction.USER_UNBAN, { actorId: actor.id, targetType: 'USER', targetId: id, detail: target.email });
  if (data.role !== undefined) {
    await revokeAllSessions(id); // สิทธิ์เปลี่ยน ให้ล็อกอินใหม่
    await audit(AuditAction.USER_ROLE_CHANGE, { actorId: actor.id, targetType: 'USER', targetId: id, detail: `${target.email}: ${target.role} → ${updated.role}` });
  }
  res.json({ id: updated.id, role: updated.role, isBanned: updated.isBanned });
});

// ---- ลิงก์ทั้งหมด ----
adminRouter.get('/links', async (req, res) => {
  const { page, pageSize } = pageOf(req.query);
  const q = qOf(req.query);
  const status = isString(req.query.status) && (['ACTIVE', 'DISABLED', 'ADMIN_DISABLED'] as const).includes(req.query.status as LinkStatus) ? (req.query.status as LinkStatus) : undefined;
  const owner = req.query.owner === 'guest' ? { userId: null } : req.query.owner === 'member' ? { userId: { not: null } } : {};
  const since = sinceOf(req.query);
  const where: Prisma.LinkWhereInput = {
    ...(status ? { status } : {}),
    ...owner,
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(q
      ? {
          OR: [
            { shortCode: { contains: q, mode: 'insensitive' } },
            { originalUrl: { contains: q, mode: 'insensitive' } },
            { user: { email: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.link.findMany({ where, orderBy: req.query.sort === 'clicks' ? [{ clickCount: 'desc' }, { createdAt: 'desc' }] : { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { user: { select: { email: true } } } }),
    prisma.link.count({ where }),
  ]);
  res.json({ items: items.map((l) => ({ ...toLinkDto(l), ownerEmail: l.user?.email ?? null })), total, page, pageSize });
});

// สถิติการเปิดของลิงก์ใดก็ได้ (อุปกรณ์/ระบบปฏิบัติการ/เบราว์เซอร์/ประเทศ/เว็บที่พามา) — รูปแบบเดียวกับของเจ้าของลิงก์
adminRouter.get('/links/:id/stats', async (req, res) => {
  const link = await prisma.link.findUnique({ where: { id: parseLinkId(req.params.id) } });
  if (!link) throw new HttpError(404, 'ไม่พบลิงก์');
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

adminRouter.patch('/links/:id', async (req, res) => {
  const b = bodyOf(req.body);
  if (b.status !== 'ADMIN_DISABLED' && b.status !== 'ACTIVE') throw new HttpError(400, 'สถานะต้องเป็น ADMIN_DISABLED หรือ ACTIVE');
  const link = await prisma.link.findUnique({ where: { id: parseLinkId(req.params.id) } });
  if (!link) throw new HttpError(404, 'ไม่พบลิงก์');

  if (b.status === 'ADMIN_DISABLED') {
    if (link.status === 'ADMIN_DISABLED') return void res.json(toLinkDto(link));
  } else {
    if (link.status !== 'ADMIN_DISABLED') throw new HttpError(400, 'ลิงก์นี้ไม่ได้ถูกปิดโดยผู้ดูแลระบบ');
    const blocked = await prisma.blockedDomain.findFirst({ where: { domain: { in: hostSuffixesOf(link.originalHost) } } });
    if (blocked) throw new HttpError(400, 'โดเมนของลิงก์นี้ยังถูกบล็อกอยู่ ต้องปลดบล็อกโดเมนก่อน');
  }
  const updated = await prisma.link.update({ where: { id: link.id }, data: { status: b.status as LinkStatus } });
  await syncLinkCache(updated);
  await audit(b.status === 'ADMIN_DISABLED' ? AuditAction.LINK_DISABLE : AuditAction.LINK_ENABLE, { actorId: req.user!.id, targetType: 'LINK', targetId: String(link.id), detail: link.shortCode });
  res.json(toLinkDto(updated));
});

function hostSuffixesOf(host: string) {
  const labels = host.split('.');
  return labels.map((_, i) => labels.slice(i).join('.'));
}

// ---- โดเมนที่ถูกบล็อก ----
const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function normaliseDomain(raw: string): string {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split(/[/?#]/)[0].replace(/:\d+$/, '').replace(/\.$/, '');
  if (!DOMAIN_RE.test(d)) throw new HttpError(400, 'โดเมนไม่ถูกต้อง เช่น example.com');
  return d;
}

const hostMatch = (domain: string): Prisma.LinkWhereInput => ({ OR: [{ originalHost: domain }, { originalHost: { endsWith: `.${domain}` } }] });
async function countLinksOf(domain: string) {
  const [linkCount, disabledCount] = await Promise.all([
    prisma.link.count({ where: hostMatch(domain) }),
    prisma.link.count({ where: { AND: [hostMatch(domain), { status: 'ADMIN_DISABLED' }] } }),
  ]);
  return { linkCount, disabledCount };
}

// ดูผลกระทบก่อนบล็อก: มีลิงก์ที่ยังเปิดอยู่กี่รายการที่จะถูกปิด (ไม่เขียนอะไร)
adminRouter.get('/blocked-domains/preview', async (req, res) => {
  if (!isString(req.query.domain)) throw new HttpError(400, 'กรุณากรอกโดเมน');
  const domain = normaliseDomain(req.query.domain);
  const [already, willDisable, total] = await Promise.all([
    prisma.blockedDomain.findUnique({ where: { domain } }),
    prisma.link.count({ where: { AND: [hostMatch(domain), { status: { in: ['ACTIVE', 'DISABLED'] } }] } }),
    prisma.link.count({ where: hostMatch(domain) }),
  ]);
  res.json({ domain, alreadyBlocked: !!already, willDisable, totalLinks: total });
});

adminRouter.get('/blocked-domains', async (req, res) => {
  const { page, pageSize } = pageOf(req.query);
  const q = qOf(req.query);
  const since = sinceOf(req.query);
  const where: Prisma.BlockedDomainWhereInput = { ...(q ? { domain: { contains: q.toLowerCase() } } : {}), ...(since ? { createdAt: { gte: since } } : {}) };
  const [items, total] = await prisma.$transaction([
    prisma.blockedDomain.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { createdBy: { select: { email: true } } } }),
    prisma.blockedDomain.count({ where }),
  ]);
  // จำนวนลิงก์ในระบบที่ชี้มาโดเมนนี้ (รวมโดเมนย่อย) และที่ถูกผู้ดูแลปิดอยู่
  const counts = await Promise.all(items.map((d) => countLinksOf(d.domain)));
  res.json({
    items: items.map((d, i) => ({ id: d.id, domain: d.domain, reason: d.reason, createdAt: d.createdAt, createdByEmail: d.createdBy?.email ?? null, ...counts[i] })),
    total,
    page,
    pageSize,
  });
});

adminRouter.post('/blocked-domains', async (req, res) => {
  const b = bodyOf(req.body);
  if (!isString(b.domain)) throw new HttpError(400, 'กรุณากรอกโดเมน');
  const reason = isString(b.reason) && b.reason.trim() ? b.reason.trim().slice(0, 200) : null;
  const domain = normaliseDomain(b.domain);
  if (await prisma.blockedDomain.findUnique({ where: { domain } })) throw new HttpError(409, 'โดเมนนี้ถูกบล็อกอยู่แล้ว');

  const row = await prisma.blockedDomain.create({ data: { domain, reason, createdById: req.user!.id } });
  // ปิดลิงก์เดิมที่ชี้ไปโดเมนนี้ (รวม subdomain) ที่ยังเปิดอยู่
  const affected = await prisma.link.findMany({
    where: { status: { in: ['ACTIVE', 'DISABLED'] }, OR: [{ originalHost: domain }, { originalHost: { endsWith: `.${domain}` } }] },
  });
  if (affected.length > 0) {
    await prisma.link.updateMany({ where: { id: { in: affected.map((l) => l.id) } }, data: { status: 'ADMIN_DISABLED' } });
    await Promise.all(affected.map((l) => clearLinkCache(l.shortCode)));
  }
  await audit(AuditAction.DOMAIN_BLOCK, { actorId: req.user!.id, targetType: 'DOMAIN', targetId: String(row.id), detail: `${domain}${reason ? ` (${reason})` : ''} — ปิดลิงก์เดิม ${affected.length} รายการ` });
  res.status(201).json({ id: row.id, domain: row.domain, reason: row.reason, createdAt: row.createdAt, disabledLinks: affected.length });
});

adminRouter.delete('/blocked-domains/:id', async (req, res) => {
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) throw new HttpError(404, 'ไม่พบโดเมน');
  const row = await prisma.blockedDomain.findUnique({ where: { id } });
  if (!row) throw new HttpError(404, 'ไม่พบโดเมน');
  await prisma.blockedDomain.delete({ where: { id } });
  await audit(AuditAction.DOMAIN_UNBLOCK, { actorId: req.user!.id, targetType: 'DOMAIN', targetId: String(id), detail: row.domain });
  res.status(204).end(); // ลิงก์ที่เคยถูกปิดเพราะโดเมนนี้ไม่เปิดคืนอัตโนมัติ (ผู้ดูแลเปิดเองทีละลิงก์)
});

// ---- audit log ----
adminRouter.get('/audit', adminOnly, async (req, res) => {
  const { page, pageSize } = pageOf(req.query);
  const action = isString(req.query.action) && req.query.action in AuditAction ? (req.query.action as AuditAction) : undefined;
  const q = qOf(req.query);
  const since = sinceOf(req.query);
  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(q ? { OR: [{ detail: { contains: q, mode: 'insensitive' } }, { actor: { email: { contains: q, mode: 'insensitive' } } }] } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { actor: { select: { email: true } } } }),
    prisma.auditLog.count({ where }),
  ]);
  res.json({
    items: items.map((a) => ({ id: a.id, action: a.action, targetType: a.targetType, targetId: a.targetId, detail: a.detail, actorEmail: a.actor?.email ?? null, createdAt: a.createdAt })),
    total,
    page,
    pageSize,
  });
});
