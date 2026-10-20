import { LinkStatus, Prisma } from '@prisma/client';
import { config } from '../common/config';
import { HttpError } from '../common/http-error';
import { generateShortCode, hostSuffixes, validateAlias, validateTargetUrl } from '../common/url-validator';
import { prisma } from '../prisma/client';
import { clearLinkCache, syncLinkCache } from './link.cache';

const MAX_EXPIRY_YEARS = 10;
const COLLISION_TRIES_PER_LENGTH = 3;
const MAX_SHORT_CODE_LENGTH = 12;

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

/** ตรวจ URL ปลายทาง + โดเมนต้องห้าม (รวม subdomain) */
async function checkTarget(url: string) {
  const target = validateTargetUrl(url);
  const blocked = await prisma.blockedDomain.findFirst({ where: { domain: { in: hostSuffixes(target.host) } } });
  if (blocked) throw new HttpError(400, 'โดเมนนี้ถูกบล็อก ไม่สามารถย่อลิงก์ได้');
  return target;
}

function parseExpiry(value: unknown): Date {
  const d = typeof value === 'string' ? new Date(value) : new Date(NaN);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, 'วันหมดอายุไม่ถูกต้อง');
  const now = Date.now();
  if (d.getTime() <= now) throw new HttpError(400, 'วันหมดอายุต้องเป็นเวลาในอนาคต');
  if (d.getTime() > now + MAX_EXPIRY_YEARS * 365 * 24 * 3600 * 1000) {
    throw new HttpError(400, `วันหมดอายุต้องไม่เกิน ${MAX_EXPIRY_YEARS} ปี`);
  }
  return d;
}

export async function createLink(userId: string, input: { url: string; alias?: string; expiresAt?: string | null }) {
  const target = await checkTarget(input.url);
  const expiresAt = input.expiresAt ? parseExpiry(input.expiresAt) : null;
  const data = { userId, originalUrl: target.href, originalHost: target.host, expiresAt };

  let link;
  if (input.alias) {
    try {
      link = await prisma.link.create({ data: { ...data, shortCode: validateAlias(input.alias) } });
    } catch (e) {
      if (isUniqueViolation(e)) throw new HttpError(409, 'alias นี้ถูกใช้แล้ว กรุณาใช้ชื่ออื่น');
      throw e;
    }
  } else {
    // สุ่มรหัสสั้น ชนแล้วลองใหม่ ชนบ่อยก็ขยายความยาวทีละ 1 ตัว
    for (let len = config.shortCodeLength; len <= Math.min(MAX_SHORT_CODE_LENGTH, config.shortCodeLength + 4) && !link; len++) {
      for (let i = 0; i < COLLISION_TRIES_PER_LENGTH && !link; i++) {
        try {
          link = await prisma.link.create({ data: { ...data, shortCode: generateShortCode(len) } });
        } catch (e) {
          if (!isUniqueViolation(e)) throw e;
        }
      }
    }
    if (!link) throw new HttpError(503, 'สร้างลิงก์ไม่สำเร็จ กรุณาลองใหม่');
  }

  await syncLinkCache(link);
  return link;
}

export async function getOwnedLink(userId: string, id: number) {
  // ไม่ใช่ของตัวเอง = ไม่พบ (ไม่เปิดเผยว่ามีลิงก์นี้อยู่)
  const link = await prisma.link.findFirst({ where: { id, userId } });
  if (!link) throw new HttpError(404, 'ไม่พบลิงก์');
  return link;
}

export async function listLinks(userId: string, opts: { q?: string; page: number; pageSize: number }) {
  const where: Prisma.LinkWhereInput = {
    userId,
    ...(opts.q
      ? {
          OR: [
            { shortCode: { contains: opts.q, mode: 'insensitive' } },
            { originalUrl: { contains: opts.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.link.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
    prisma.link.count({ where }),
  ]);
  return { items, total };
}

export async function updateLink(
  userId: string,
  id: number,
  input: { url?: string; expiresAt?: string | null; status?: LinkStatus },
) {
  const current = await getOwnedLink(userId, id);
  const data: Prisma.LinkUpdateInput = {};

  if (input.url !== undefined) {
    const target = await checkTarget(input.url);
    data.originalUrl = target.href;
    data.originalHost = target.host; // ต้องตั้งทุกครั้งที่แก้ URL (ใช้บล็อกโดเมน)
  }
  if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt === null ? null : parseExpiry(input.expiresAt);
  if (input.status !== undefined) {
    // ADMIN_DISABLED เจ้าของเปิดเองไม่ได้
    if (current.status === 'ADMIN_DISABLED') throw new HttpError(403, 'ลิงก์นี้ถูกปิดโดยผู้ดูแลระบบ ไม่สามารถเปิดเองได้');
    data.status = input.status;
  }

  const link = await prisma.link.update({ where: { id }, data });
  await syncLinkCache(link);
  return link;
}

export async function deleteLink(userId: string, id: number) {
  const link = await getOwnedLink(userId, id);
  await prisma.link.delete({ where: { id } });
  await clearLinkCache(link.shortCode);
}
