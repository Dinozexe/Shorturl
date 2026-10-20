/** @type {import('next').NextConfig} */
const nextConfig = {
  // static export: ไม่มี server ฝั่ง Next (deploy บน Cloudflare Pages) → ห้ามใช้ dynamic route `[id]` / API route / SSR
  output: 'export',
  // dev ใช้โฟลเดอร์ของตัวเอง (.next-dev ตั้งในสคริปต์ dev) แยกจาก build (.next → ส่งออกที่ out/)
  // เพราะ `next build` เขียนลง .next จริงๆ — ถ้า dev ใช้โฟลเดอร์เดียวกัน การ build ตอน dev เปิดอยู่จะทำให้ dev พัง
  // (error "Cannot find module './948.js'")
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
