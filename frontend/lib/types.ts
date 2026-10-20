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
