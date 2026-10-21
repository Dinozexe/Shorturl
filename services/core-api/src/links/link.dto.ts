import { Link } from '@prisma/client';
import { config } from '../common/config';

export function toLinkDto(link: Link) {
  return {
    id: link.id,
    shortCode: link.shortCode,
    shortUrl: `${config.publicBaseUrl}/${link.shortCode}`,
    originalUrl: link.originalUrl,
    originalHost: link.originalHost,
    status: link.status,
    expiresAt: link.expiresAt,
    expired: link.expiresAt !== null && link.expiresAt.getTime() <= Date.now(),
    clickCount: link.clickCount,
    startsAt: link.startsAt,
    notStarted: link.startsAt !== null && link.startsAt.getTime() > Date.now(),
    maxClicks: link.maxClicks,
    limitReached: link.maxClicks !== null && link.clickCount >= link.maxClicks,
    hasPassword: link.passwordHash !== null,
    qrStyle: link.qrStyle ?? null,
    createdAt: link.createdAt,
  };
}
