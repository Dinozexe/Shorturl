'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useLoginModal } from './LoginModal';
import { HeaderControls } from './HeaderControls';
import { Logo } from './Logo';

const NAV = [
  { href: '/', key: 'nav.home' },
  { href: '/features', key: 'nav.features' },
  { href: '/plans', key: 'nav.plans' },
] as const;

// แถบบนเต็มความกว้างติดขอบบน (ไม่มีเส้นล่าง): โลโก้ซ้าย · แท่งเมนูมนกลาง (รายการที่เปิดอยู่เป็นปุ่มสีฟ้า) · ตัวสลับภาษา/ธีมและปุ่มบัญชีขวา
// จอเล็ก: แถวบน = โลโก้ + ปุ่มบัญชี, แถวล่าง = เมนู + ตัวสลับภาษา/ธีม
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

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto grid max-w-5xl grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2.5 px-4 py-3 sm:px-6 md:grid-cols-[1fr_auto_1fr]">
        <div className="col-start-1 row-start-1">
          <Logo />
        </div>

        <nav aria-label={t('nav.menu')} className="col-start-1 row-start-2 md:col-start-2 md:row-start-1 md:justify-self-center">
          <ul className="flex items-center gap-1 rounded-full border border-line bg-surface p-1 shadow-sm">
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`block rounded-full px-4 py-1.5 text-sm font-medium transition-colors sm:px-5 ${active ? 'bg-accent text-on-accent' : 'text-ink/80 hover:bg-ink/[0.06] hover:text-ink'}`}
                  >
                    {t(item.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* จอเล็กให้ลูกสองตัวนี้ไปอยู่คนละแถวของ grid; จอกลางขึ้นไปรวมเป็นกลุ่มเดียวชิดขวา */}
        <div className="contents md:col-start-3 md:row-start-1 md:flex md:items-center md:justify-self-end md:gap-2">
          <div className="col-start-2 row-start-2 justify-self-end md:col-auto md:row-auto">
            <HeaderControls />
          </div>
          <div className="col-start-2 row-start-1 flex items-center justify-self-end gap-1.5 text-sm md:col-auto md:row-auto md:gap-2">
            {status === 'authed' && user && (
              <>
                <Link href="/dashboard" className="btn-primary px-4 py-2 text-sm" aria-current={pathname.startsWith('/dashboard') ? 'page' : undefined}>
                  {t('dash.myLinks')}
                </Link>
                <button type="button" onClick={onLogout} className="btn" title={user.email}>
                  {t('nav.logout')}
                </button>
              </>
            )}
            {status === 'anon' && (
              <button type="button" onClick={openLogin} className="btn-primary px-4 py-2 text-sm">
                {t('nav.login')}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
