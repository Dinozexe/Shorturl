import Link from 'next/link';

// โลโก้ระบบ: แมวส้มหน้าจอ (ไฟล์ /logo-128.png) + ชื่อ "Shorturl" ตัวหนา และ "By Kittamet" ตัวเล็ก
export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Shorturl By Kittamet">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-128.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full" />
      <span className="flex flex-col leading-tight sm:flex-row sm:items-baseline sm:gap-2">
        <span className="text-lg font-bold tracking-tight sm:text-xl">Shorturl</span>
        <span className="text-[11px] font-medium text-muted sm:text-xs">By Kittamet</span>
      </span>
    </Link>
  );
}
