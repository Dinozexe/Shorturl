import type { Metadata } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { LoginModalProvider } from '@/components/LoginModal';
import { ToastProvider } from '@/components/Toast';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/theme';
import './globals.css';

// ฟอนต์ฝังในโปรเจกต์ (app/fonts/*.woff2, variable font) — ไม่เรียกเซิร์ฟเวอร์ภายนอกทั้งตอน build และตอนผู้ใช้เปิดเว็บ
// Noto Sans Thai แบ่งเป็น 2 ไฟล์ตามชุดอักษร (ละติน + ไทย) เรียงต่อกันใน font stack: ตัวอักษรไหนไม่มีในไฟล์แรก เบราว์เซอร์ใช้ไฟล์ถัดไปเอง
const sansLatin = localFont({ src: './fonts/noto-sans-thai-latin.woff2', weight: '400 700', style: 'normal', variable: '--font-sans-latin', display: 'swap' });
const sansThai = localFont({ src: './fonts/noto-sans-thai-thai.woff2', weight: '400 700', style: 'normal', variable: '--font-sans-thai', display: 'swap' });
const mono = localFont({ src: './fonts/jetbrains-mono-latin.woff2', weight: '400 600', style: 'normal', variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Short URL By Kittamet',
  description: 'ทำลิงก์ยาวให้สั้น สร้าง QR Code และดูสถิติว่ามีคนเปิดกี่ครั้ง จากอุปกรณ์และเว็บไหน',
};

// ตั้งธีมและภาษา "ก่อนวาดหน้า" กันหน้ากะพริบ (ขาว→มืด): ใช้ค่าที่ผู้ใช้เคยเลือก ถ้ายังไม่เคยเลือกให้ตามค่าของเครื่อง; ค่าเก็บใน localStorage ของเบราว์เซอร์นี้เท่านั้น
const INIT_SCRIPT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem('surl:theme'),l=localStorage.getItem('surl:lang');if(t!=='light'&&t!=='dark')t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';d.setAttribute('data-theme',t);if(l==='en'||l==='th')d.lang=l;}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: สคริปต์ด้านบนแก้ attribute ของ <html> ก่อน React เริ่มทำงาน
    <html lang="th" className={`${sansLatin.variable} ${sansThai.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />
      </head>
      <body>
        <I18nProvider>
          <ThemeProvider>
            <AuthProvider>
              <ToastProvider>
                <LoginModalProvider>{children}</LoginModalProvider>
              </ToastProvider>
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
