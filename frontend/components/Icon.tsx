import type { ReactNode } from 'react';

// ไอคอนเส้นชุดเดียวของทั้งระบบ (ใช้กับปุ่ม action, เมนู, หน้าต่าง)
export type AdminIconName = 'overview' | 'users' | 'links' | 'domains' | 'audit' | 'clicks' | 'ban' | 'home' | 'mylinks' | 'logout' | 'panel' | 'chevron' | 'plus' | 'check' | 'userCheck' | 'linkOff' | 'unlock' | 'chevronDown' | 'x' | 'copy' | 'qr' | 'edit' | 'trash' | 'download' | 'power';

const svg = { viewBox: '0 0 24 24', className: 'h-[18px] w-[18px] shrink-0', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
const PATHS: Record<AdminIconName, ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20a6.5 6.5 0 0 0-4-6" />
    </>
  ),
  links: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  domains: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </>
  ),
  audit: (
    <>
      <path d="M7 3h8l4 4v14H7z" />
      <path d="M15 3v4h4M10 12h6M10 16h6" />
    </>
  ),
  clicks: <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
  ban: (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3 20a7 7 0 0 1 11-5.7M17 15l5 5M22 15l-5 5" />
    </>
  ),
  home: <path d="m3 11 9-8 9 8M5 10v10h14V10" />,
  mylinks: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="18" r="1" />
    </>
  ),
  logout: <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10" />,
  panel: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9 4v16" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  userCheck: (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3 20a7 7 0 0 1 10.5-6M15.5 17.5l2.5 2.5 4-4.5" />
    </>
  ),
  linkOff: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
      <path d="m3 3 18 18" />
    </>
  ),
  unlock: (
    <>
      <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 7.5-2" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h8" />
    </>
  ),
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
    </>
  ),
  edit: <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  download: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
  power: <path d="M12 3v9M6.3 6.8a8 8 0 1 0 11.4 0" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
};

export function AdminIcon({ name, className }: { name: AdminIconName; className?: string }) {
  return (
    <svg {...svg} className={className ?? svg.className}>
      {PATHS[name]}
    </svg>
  );
}

