/** @type {import('next').NextConfig} */
const nextConfig = {
  // static export: ไม่มี server ฝั่ง Next (deploy บน Cloudflare Pages) → ห้ามใช้ dynamic route `[id]` / API route / SSR
  output: 'export',
  // dev (.next) กับ build (dist) ต้องใช้โฟลเดอร์คนละที่ ไม่งั้นรัน `npm run build` ตอน dev server เปิดอยู่จะทับไฟล์ของกันและกัน
  // (error "Cannot find module './948.js'"); กำหนดผ่าน NEXT_DIST_DIR (ตั้งในสคริปต์ build) ไม่ใช้ NODE_ENV เพราะค่านั้นยังไม่นิ่งตอนอ่าน config
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
