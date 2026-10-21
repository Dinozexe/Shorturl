import type { Config } from 'tailwindcss';

// สีทั้งหมดเป็น CSS variable (สว่าง/มืดสลับใน globals.css) เพื่อให้ธีมเปลี่ยนที่เดียว
const c = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: c('paper'), // พื้นหลังหน้า
        surface: c('surface'), // พื้นของช่องกรอก/กล่อง
        ink: c('ink'), // ตัวอักษรหลัก
        accent: c('accent'), // สีธีมหลัก (ฟ้า)
        'on-accent': c('on-accent'),
        muted: c('muted'), // ตัวอักษรรอง
        line: c('line'), // เส้นแบ่ง
        danger: c('danger'),
        ok: c('ok'),
      },
      fontFamily: {
        sans: ['var(--font-sans-latin)', 'var(--font-sans-thai)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
