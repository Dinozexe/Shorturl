'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useLoginModal } from '@/components/LoginModal';

// ไม่มีหน้าเข้าสู่ระบบแยกแล้ว: ที่อยู่นี้เหลือไว้ให้ SSO เด้งกลับมา → เปิดหน้าต่างเข้าสู่ระบบทับหน้าแรก
export default function LoginRedirect() {
  const router = useRouter();
  const { openLogin } = useLoginModal();
  useEffect(() => {
    openLogin();
    router.replace('/');
  }, [openLogin, router]);
  return null;
}
