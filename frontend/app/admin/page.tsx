'use client';

import { ErrorState } from '@/components/ui/ErrorState';
import { PageLoading } from '@/components/ui/PageLoading';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminShell, allowedTabs, tabMeta, type AdminTab } from '@/components/admin/AdminShell';
import { AuditPanel } from '@/components/admin/AuditPanel';
import { DomainsPanel } from '@/components/admin/DomainsPanel';
import { LinksPanel } from '@/components/admin/LinksPanel';
import { OverviewPanel } from '@/components/admin/OverviewPanel';
import { UsersPanel } from '@/components/admin/UsersPanel';
import { useLoginModal } from '@/components/LoginModal';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

export default function AdminPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { status, user, signedOut, retry } = useAuth();
  const { openLogin } = useLoginModal();
  const [tab, setTab] = useState<AdminTab>('overview');

  // จำแท็บไว้ใน #hash (รีเฟรชแล้วอยู่หน้าเดิม)
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (['overview', 'users', 'links', 'domains', 'audit'].includes(h)) setTab(h as AdminTab);
  }, []);
  const navigate = (next: AdminTab) => {
    setTab(next);
    window.history.replaceState(null, '', `#${next}`);
  };

  useEffect(() => {
    if (status === 'anon' && !signedOut) {
      router.replace('/');
      openLogin();
    } else if (status === 'authed' && user?.role === 'USER') {
      router.replace('/dashboard'); // ไม่มีสิทธิ์ผู้ดูแล
    }
  }, [status, user, signedOut, router, openLogin]);

  if (status === 'offline') {
    return (
      <main className="flex min-h-svh items-center justify-center px-4">
        <ErrorState title={t('wake.offlineTitle')} message={t('wake.offlineBody')} onRetry={retry} />
      </main>
    );
  }

  if (status !== 'authed' || !user || user.role === 'USER') {
    return (
      <PageLoading text={t('dash.checking')} full />
    );
  }

  // แท็บที่ไม่มีสิทธิ์ (เช่น MODERATOR เปิด #users) ตกกลับไปภาพรวม
  const active = allowedTabs(user.role).some((i) => i.id === tab) ? tab : 'overview';

  return (
    <AdminShell tab={active} onNav={navigate} role={user.role}>
      <h1 className="sr-only">{t(tabMeta(active).label)}</h1>
      {active === 'overview' && <OverviewPanel onTab={navigate} />}
      {active === 'users' && <UsersPanel />}
      {active === 'links' && <LinksPanel />}
      {active === 'domains' && <DomainsPanel />}
      {active === 'audit' && <AuditPanel />}
    </AdminShell>
  );
}
