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
    createdAt: link.createdAt,
  };
}
