import Link from 'next/link';

// ชื่อเว็บ: "Shorturl" ตัวหนา + "By Kittamet" ตัวเล็ก — มือถือจัดซ้อนสองบรรทัด จอใหญ่อยู่บรรทัดเดียว
export function Logo() {
  return (
    <Link href="/" className="flex flex-col leading-tight sm:flex-row sm:items-baseline sm:gap-2" aria-label="Shorturl By Kittamet">
      <span className="text-lg font-bold tracking-tight sm:text-xl">Shorturl</span>
      <span className="text-[11px] font-medium text-muted sm:text-xs">By Kittamet</span>
    </Link>
  );
}
