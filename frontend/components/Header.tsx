'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { HeaderControls } from './HeaderControls';
import { Logo } from './Logo';

// แถบบนแบบแท่งมนลอยกลางหน้า: ติดบนเวลาเลื่อนและเบลอพื้นหลังด้านหลัง
// ชั้นนอกโปร่งใสและไม่รับคลิก (pointer-events-none) เพื่อไม่บังเนื้อหาที่อยู่ข้างๆ แท่ง
export function Header() {
  const { status, user, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  const onLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <header className="pointer-events-none sticky top-0 z-40 px-3 pt-3 sm:px-6">
      <div className="pointer-events-auto mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-full border border-line bg-surface/80 py-2 pl-5 pr-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md sm:pl-6">
        <Logo />
        <nav className="flex items-center gap-1.5 text-sm sm:gap-2">
          <HeaderControls />
          {status === 'authed' && user && (
            <>
              <span className="hidden max-w-[9rem] truncate text-muted lg:inline" title={user.email}>
                {user.name ?? user.email}
              </span>
              <button type="button" onClick={onLogout} className="btn rounded-full">
                {t('nav.logout')}
              </button>
            </>
          )}
          {status === 'anon' && !pathname.startsWith('/login') && (
            <Link href="/login" className="btn-primary rounded-full px-4 py-2 text-sm">
              {t('nav.login')}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
