'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { AdminIcon } from './Icon';

// ไอคอนโปรไฟล์ที่มุมขวา: กดแล้วเปิดเมนู (ลิงก์ของฉัน · ผู้ดูแลระบบถ้ามีสิทธิ์ · ออกจากระบบ)
export function ProfileMenu({ onLogout, inAdmin, variant = 'avatar', side = 'below' }: { onLogout: () => void; inAdmin?: boolean; variant?: 'avatar' | 'row'; side?: 'below' | 'above' | 'right' }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  const initial = (user.name || user.email).slice(0, 1).toUpperCase();
  const item = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-ink/85 transition-colors hover:bg-ink/[0.06] hover:text-ink';

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('nav.profile')}
        title={user.email}
        className={
          variant === 'row'
            ? 'flex w-full items-center gap-3 rounded-2xl bg-ink/[0.04] p-2 text-left transition-colors hover:bg-ink/[0.07] focus-visible:ring-2 focus-visible:ring-accent/40'
            : 'flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-accent shadow-sm ring-2 ring-transparent transition-shadow hover:ring-accent/30 focus-visible:ring-accent/40'
        }
      >
        {variant === 'row' ? (
          <>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-bold text-on-accent">{initial}</span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-semibold">{user.name || user.email}</span>
              <span className="truncate text-xs text-muted">{t(`role.${user.role}` as 'role.ADMIN')}</span>
            </span>
            <AdminIcon name="chevronDown" className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? '' : 'rotate-180'}`} />
          </>
        ) : (
          initial
        )}
      </button>

      {open && (
        <div role="menu" className={`absolute z-50 w-64 rounded-2xl bg-surface p-1.5 shadow-[0_16px_48px_rgba(15,18,28,0.18)] ring-1 ring-line ${side === 'below' ? 'right-0 top-full mt-2' : side === 'above' ? 'bottom-full left-0 mb-2' : 'bottom-0 left-full ml-3'}`}>
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-semibold">{user.name || user.email}</p>
            <p className="truncate text-xs text-muted">{user.name ? user.email : t(`role.${user.role}` as 'role.ADMIN')}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          {inAdmin ? (
            <Link href="/" role="menuitem" className={item}>
              <AdminIcon name="home" />
              {t('login.back')}
            </Link>
          ) : (
            <>
              <Link href="/keys" role="menuitem" className={item}>
                <AdminIcon name="lock" />
                {t('nav.keys')}
              </Link>
              {user.role !== 'USER' && (
                <Link href="/admin" role="menuitem" className={item}>
                  <AdminIcon name="overview" />
                  {t('nav.admin')}
                </Link>
              )}
            </>
          )}
          <div className="my-1 h-px bg-line" />
          <button type="button" role="menuitem" onClick={onLogout} className={item}>
            <AdminIcon name="logout" />
            {t('nav.logout')}
          </button>
        </div>
      )}
    </div>
  );
}
