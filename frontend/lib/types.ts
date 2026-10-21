export type Role = 'USER' | 'MODERATOR' | 'ADMIN';
export type LinkStatus = 'ACTIVE' | 'DISABLED' | 'ADMIN_DISABLED';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

export interface Link {
  id: number;
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
  originalHost: string;
  status: LinkStatus;
  expiresAt: string | null;
  expired: boolean;
  clickCount: number;
  startsAt: string | null;
  notStarted: boolean;
  maxClicks: number | null;
  limitReached: boolean;
  hasPassword: boolean;
  qrStyle?: Partial<import('./qrRender').QrStyle> | null;
  createdAt: string;
}

export interface LinkPage {
  items: Link[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Bucket {
  key: string | null;
  clicks: number;
}

export interface Stats {
  linkId: number;
  days: number;
  total: number;
  windowClicks: number;
  uniqueVisitors: number;
  daily: Array<{ day: string; clicks: number }>;
  referers: Bucket[];
  countries: Bucket[];
  devices: Bucket[];
  os: Bucket[];
  browsers: Bucket[];
}

export type StatsResponse = Stats | { unavailable: true; linkId: number; total: number };

export interface Provider {
  id: 'google' | 'microsoft';
  label: string;
}

// ---- ผู้ดูแลระบบ ----
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminOverview {
  users: number;
  bannedUsers: number;
  links: number;
  adminDisabledLinks: number;
  blockedDomains: number;
  clicks: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isBanned: boolean;
  linkCount: number;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminLink extends Link {
  ownerEmail: string | null;
}

export interface BlockedDomain {
  id: number;
  domain: string;
  reason: string | null;
  createdAt: string;
  createdByEmail: string | null;
  linkCount: number;
  disabledCount: number;
}

export interface DomainPreview {
  domain: string;
  alreadyBlocked: boolean;
  willDisable: number;
  totalLinks: number;
}

export type AuditActionName =
  | 'USER_REGISTER'
  | 'USER_LOGIN'
  | 'USER_LOGIN_BLOCKED'
  | 'USER_BAN'
  | 'USER_UNBAN'
  | 'USER_ROLE_CHANGE'
  | 'LINK_DISABLE'
  | 'LINK_ENABLE'
  | 'DOMAIN_BLOCK'
  | 'DOMAIN_UNBLOCK'
  | 'API_KEY_CREATE'
  | 'API_KEY_REVOKE';

export interface AuditEntry {
  id: number;
  action: AuditActionName;
  targetType: string | null;
  targetId: string | null;
  detail: string | null;
  actorEmail: string | null;
  createdAt: string;
}
