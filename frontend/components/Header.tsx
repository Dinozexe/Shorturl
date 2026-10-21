'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useI18n, type MsgKey } from '@/lib/i18n';
import { ProfileMenu } from './ProfileMenu';
import { AdminIcon } from '@/components/Icon';
import { HeaderControls } from './HeaderControls';
import { Logo } from './Logo';
import { useLoginModal } from './LoginModal';

interface NavItem {
  href: string;
  key: MsgKey;
}

const NAV: NavItem[] = [
  { href: '/', key: 'nav.home' },
  { href: '/features', key: 'nav.features' },
  { href: '/plans', key: 'nav.plans' },
];

// แถบบนเต็มความกว้างติดขอบบน (ไม่มีเส้นล่าง): โลโก้ซ้าย · แท่งเมนูมนกลาง (รายการที่เปิดอยู่เป็นปุ่มสีฟ้า) · ตัวสลับภาษา/ธีมและปุ่มบัญชีขวา
// จอเล็ก: แถวบน = โลโก้ + ตัวสลับภาษา/ธีม + ปุ่มบัญชี, แถวล่าง = เมนู (เลื่อนซ้ายขวาได้ถ้ายาวเกิน)
export function Header() {
  const { status, user, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { openLogin } = useLoginModal();
  const pathname = usePathname();

  const onLogout = async () => {
    await logout();
    router.replace('/');
  };

  // ล็อกอินแล้วมี "ลิงก์ของฉัน" ในแท่งเมนูเลย (กดเข้ารายการลิงก์ได้ทันที)
  const items: NavItem[] = status === 'authed' ? [...NAV, { href: '/dashboard', key: 'dash.myLinks' }] : [...NAV];

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2.5 px-4 py-3 sm:px-6 md:grid-cols-[1fr_auto_1fr]">
        <div className="col-start-1 row-start-1">
          <Logo />
        </div>

        <nav aria-label={t('nav.menu')} className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1 md:justify-self-center">
          <ul className="flex w-full items-center gap-0.5 rounded-full border border-line bg-surface p-1 shadow-sm md:mx-auto md:w-max md:gap-1">
            {items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href} className="min-w-0 flex-1 md:flex-none">
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`block whitespace-nowrap rounded-full px-1 py-2 text-center text-[13px] font-medium transition-colors sm:px-5 sm:py-1.5 sm:text-sm ${active ? 'bg-accent text-on-accent' : 'text-ink/80 hover:bg-ink/[0.06] hover:text-ink'}`}
                  >
                    {t(item.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="col-start-2 row-start-1 flex items-center justify-self-end gap-1.5 text-sm md:col-start-3 md:gap-2">
          <HeaderControls />
          {status === 'authed' && user && <ProfileMenu onLogout={onLogout} />}
          {(status === 'anon' || status === 'offline') && (
            <button type="button" onClick={openLogin} aria-label={t('nav.login')} title={t('nav.login')} className="btn-primary whitespace-nowrap px-2.5 py-2 text-sm min-[400px]:px-4">
              <AdminIcon name="user" className="h-5 w-5 min-[400px]:hidden" />
              <span className="hidden min-[400px]:inline">{t('nav.login')}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
