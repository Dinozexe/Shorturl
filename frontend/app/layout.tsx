import type { Metadata } from 'next';
import { JetBrains_Mono, Noto_Sans_Thai } from 'next/font/google';
import type { ReactNode } from 'react';
import { LoginModalProvider } from '@/components/LoginModal';
import { ToastProvider } from '@/components/Toast';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/theme';
import './globals.css';

const sans = Noto_Sans_Thai({ subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Shorturl By Kittamet',
  description: 'ทำลิงก์ยาวให้สั้น สร้าง QR Code และดูสถิติว่ามีคนเปิดกี่ครั้ง จากอุปกรณ์และเว็บไหน',
};

// ตั้งธีมและภาษา "ก่อนวาดหน้า" กันหน้ากะพริบ (ขาว→มืด): ใช้ค่าที่ผู้ใช้เคยเลือก ถ้ายังไม่เคยเลือกให้ตามค่าของเครื่อง; ค่าเก็บใน localStorage ของเบราว์เซอร์นี้เท่านั้น
const INIT_SCRIPT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem('surl:theme'),l=localStorage.getItem('surl:lang');if(t!=='light'&&t!=='dark')t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';d.setAttribute('data-theme',t);if(l==='en'||l==='th')d.lang=l;}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: สคริปต์ด้านบนแก้ attribute ของ <html> ก่อน React เริ่มทำงาน
    <html lang="th" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
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
