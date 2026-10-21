import type { ReactNode } from 'react';

// ไอคอนเส้นชุดเดียวของทั้งระบบ (ใช้กับปุ่ม action, เมนู, หน้าต่าง)
export type AdminIconName = 'overview' | 'users' | 'links' | 'domains' | 'audit' | 'clicks' | 'ban' | 'home' | 'mylinks' | 'logout' | 'panel' | 'chevron' | 'plus' | 'check' | 'userCheck' | 'linkOff' | 'unlock' | 'chevronDown' | 'x' | 'copy' | 'qr' | 'edit' | 'trash' | 'download' | 'power' | 'eye' | 'alert' | 'refresh' | 'globe' | 'user' | 'calendar' | 'clock' | 'info' | 'device' | 'monitor' | 'browser' | 'inbox' | 'search' | 'lock' | 'palette' | 'image' | 'type';

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
  lock: (
    <>
      <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="9.5" cy="7" r="1" />
      <circle cx="14.5" cy="7" r="1" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m21 16-5-5-8 9" />
    </>
  ),
  type: <path d="M5 7V5h14v2M12 5v14M9 19h6" />,
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
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  device: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  browser: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M6.5 6.5h.1M9 6.5h.1" />
    </>
  ),
  inbox: <path d="M3 13l2.6-7.2A2 2 0 0 1 7.5 4.5h9a2 2 0 0 1 1.9 1.3L21 13M3 13v5a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 18v-5M3 13h5l1 2.5h6l1-2.5h5" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8v.1" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5 2.8 19.5h18.4z" />
      <path d="M12 10v4.5M12 17.4v.1" />
    </>
  ),
  refresh: <path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" />,
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
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

