'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n, type MsgKey } from '@/lib/i18n';
import { ProfileMenu } from './ProfileMenu';
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

  const items: NavItem[] = [...NAV];

  // จอเล็ก: เมนูยาวเกินจอจนเลื่อนได้ → เลื่อนให้รายการที่เปิดอยู่โผล่มากลางแถบ
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    const cur = nav?.querySelector<HTMLElement>('[aria-current=page]');
    if (nav && cur && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = cur.offsetLeft - (nav.clientWidth - cur.offsetWidth) / 2;
  }, [pathname, status, user]);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2.5 px-4 py-3 sm:px-6 md:grid-cols-[1fr_auto_1fr]">
        <div className="col-start-1 row-start-1">
          <Logo />
        </div>

        <nav ref={navRef} aria-label={t('nav.menu')} className="col-span-2 row-start-2 min-w-0 overflow-x-auto md:col-span-1 md:col-start-2 md:row-start-1 md:justify-self-center md:overflow-visible">
          <ul className="mx-auto flex w-max items-center gap-1 rounded-full border border-line bg-surface p-1 shadow-sm">
            {items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`block whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors sm:px-5 ${active ? 'bg-accent text-on-accent' : 'text-ink/80 hover:bg-ink/[0.06] hover:text-ink'}`}
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
          {status === 'anon' && (
            <button type="button" onClick={openLogin} className="btn-primary whitespace-nowrap px-4 py-2 text-sm">
              {t('nav.login')}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
