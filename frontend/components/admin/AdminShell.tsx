'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { HeaderControls } from '@/components/HeaderControls';
import { ProfileMenu } from '@/components/ProfileMenu';
import { SidebarSettings } from './SidebarSettings';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n, type MsgKey } from '@/lib/i18n';
import type { AdminOverview, Role } from '@/lib/types';

export type AdminTab = 'overview' | 'users' | 'links' | 'domains' | 'audit';
export { AdminIcon, type AdminIconName } from '@/components/Icon';
import { AdminIcon, type AdminIconName } from '@/components/Icon';

interface Item {
  id: AdminTab;
  label: MsgKey;
  icon: AdminIconName;
  adminOnly?: boolean; // ผู้ช่วยดูแล (MODERATOR) ไม่เห็นรายการนี้ และ API ก็ตอบ 403
  badge?: keyof AdminOverview; // ตัวเลขเตือนข้างเมนู (แสดงเมื่อ > 0)
}

const ITEMS: Item[] = [
  { id: 'overview', label: 'admin.tab.overview', icon: 'overview' },
  { id: 'users', label: 'admin.tab.users', icon: 'users', adminOnly: true, badge: 'bannedUsers' },
  { id: 'links', label: 'admin.tab.links', icon: 'links', badge: 'adminDisabledLinks' },
  { id: 'domains', label: 'admin.tab.domains', icon: 'domains', badge: 'blockedDomains' },
  { id: 'audit', label: 'admin.tab.audit', icon: 'audit', adminOnly: true },
];

export const allowedTabs = (role: Role) => ITEMS.filter((i) => !i.adminOnly || role === 'ADMIN');
export const tabMeta = (id: AdminTab) => ITEMS.find((i) => i.id === id)!;

const COLLAPSE_KEY = 'surl:admin-collapsed';

interface ShellProps {
  tab: AdminTab;
  onNav: (tab: AdminTab) => void;
  role: Role;
  children: ReactNode;
}

// แถบข้างแบบการ์ดลอย: โลโก้ · เมนู (บางเมนูมีเมนูย่อย + ตัวเลขเตือน) · ปุ่มพับที่ขอบ
// พับแล้วเหลือแต่ไอคอน: ชี้เมาส์ที่เมนูเห็นป้ายชื่อ, เมนูที่มีเมนูย่อยเด้งรายการย่อยออกมา · จอเล็กเป็นลิ้นชักเลื่อนเข้า
export function AdminShell({ tab, onNav, role, children }: ShellProps) {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const router = useRouter();
  const items = allowedTabs(role);
  const current = tabMeta(tab);
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [counts, setCounts] = useState<AdminOverview | null>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      /* ใช้ค่าเริ่มต้น */
    }
  }, []);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);
  // ตัวเลขเตือนข้างเมนู: โหลดใหม่ทุกครั้งที่เปลี่ยนหน้า
  useEffect(() => {
    let alive = true;
    api<AdminOverview>('/api/admin/overview')
      .then((d) => alive && setCounts(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [tab]);

  const toggleCollapse = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* ไม่จำค่า */
      }
      return !c;
    });

  const onLogout = async () => {
    await logout();
    router.replace('/');
  };

  const go = (id: AdminTab) => {
    onNav(id);
    setDrawer(false);
  };

  const lbl = collapsed ? 'md:hidden' : ''; // ข้อความ: ซ่อนเมื่อพับ (จอกลางขึ้นไป)
  const rowBase = `group/item relative flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors ${collapsed ? 'md:mx-auto md:w-11 md:justify-center md:px-0' : ''}`;
  const rowOn = 'bg-ink/[0.07] font-bold text-ink';
  const rowOff = 'font-medium text-muted hover:bg-ink/[0.05] hover:text-ink';

  const Badge = ({ n }: { n: number }) =>
    n > 0 ? (
      <>
        <span className={`ml-auto rounded-md bg-danger/15 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-danger ${lbl}`}>{n}</span>
        <span aria-hidden="true" className={`absolute right-1.5 top-1.5 hidden h-2 w-2 rounded-full bg-danger ${collapsed ? 'md:block' : ''}`} />
      </>
    ) : null;

  return (
    <div className="min-h-svh bg-ink/[0.035] md:flex">
      {drawer && <div className="fixed inset-0 z-40 bg-ink/40 md:hidden" onClick={() => setDrawer(false)} aria-hidden="true" />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transition-[transform,width] duration-200 ease-out md:sticky md:top-0 md:z-30 md:h-svh md:translate-x-0 ${drawer ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'md:w-[4.75rem]' : 'md:w-64'}`}
      >
        <div className="relative flex h-full flex-col rounded-r-3xl bg-surface p-3 shadow-[8px_0_40px_rgba(15,18,28,0.06)] ring-1 ring-line/60">
          {/* ปุ่มพับ/ขยายที่ขอบแถบ */}
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label={t('admin.toggleMenu')}
            title={t('admin.toggleMenu')}
            className="absolute -right-3.5 top-9 hidden h-7 w-7 items-center justify-center rounded-full bg-surface text-ink shadow-md ring-1 ring-line transition-colors hover:bg-ink/[0.05] md:flex"
          >
            <AdminIcon name="chevron" className={`h-3.5 w-3.5 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
          </button>

          <Link href="/" className={`flex h-14 shrink-0 items-center gap-3 px-1 ${collapsed ? 'md:justify-center' : ''}`} aria-label="Shorturl By Kittamet">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-128.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full shadow-md" />
            <span className={`flex min-w-0 flex-col leading-tight ${lbl}`}>
              <span className="truncate text-[15px] font-bold">Shorturl</span>
              <span className="truncate text-xs text-muted">By Kittamet</span>
            </span>
          </Link>

          <nav aria-label={t('admin.tabs')} className={`mt-3 flex-1 ${collapsed ? 'md:overflow-visible' : 'overflow-y-auto'}`}>
            <ul className="flex flex-col gap-1">
              {items.map((it) => {
                const active = it.id === tab;
                const count = it.badge && counts ? counts[it.badge] : 0;
                return (
                  <li key={it.id} className="group/item relative">
                    <button type="button" aria-label={t(it.label)} aria-current={active ? 'page' : undefined} onClick={() => go(it.id)} className={`${rowBase} ${active ? rowOn : rowOff}`}>
                      <AdminIcon name={it.icon} className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-accent' : ''}`} />
                      <span className={`truncate ${lbl}`}>{t(it.label)}</span>
                      <Badge n={count} />
                    </button>
                    {collapsed && (
                      <span role="tooltip" className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-paper opacity-0 shadow-lg transition-opacity md:block md:group-hover/item:opacity-100">
                        {t(it.label)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* บัญชีและการตั้งค่า: โปรไฟล์ · ภาษา · ธีม */}
          <div className="mt-3 flex shrink-0 flex-col gap-2 border-t border-line pt-3">
            {collapsed ? (
              <div className="hidden flex-col items-center gap-2 md:flex">
                <HeaderControls compact />
                {user && <ProfileMenu onLogout={onLogout} inAdmin side="right" />}
              </div>
            ) : null}
            <div className={collapsed ? 'md:hidden' : ''}>
              <div className="mb-2.5">
                <SidebarSettings />
              </div>
              {user && <ProfileMenu onLogout={onLogout} inAdmin variant="row" side="above" />}
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex h-14 items-center gap-2 px-4 sm:px-6">
          <button type="button" onClick={() => setDrawer(true)} aria-label={t('admin.toggleMenu')} className="flex h-9 w-9 items-center justify-center rounded-xl text-ink/80 transition-colors hover:bg-ink/[0.06] md:hidden">
            <AdminIcon name="panel" />
          </button>
          <nav aria-label="breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="hidden text-muted sm:inline">{t('nav.admin')}</span>
            <AdminIcon name="chevron" className="hidden h-3.5 w-3.5 text-muted sm:block" />
            <span className="truncate font-semibold" aria-current="page">
              {t(current.label)}
            </span>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-[90rem] px-4 pb-24 pt-2 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
