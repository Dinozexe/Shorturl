'use client';

/** กำลังโหลด: วงหมุนเล็กๆ + ข้อความ (ผู้ใช้ที่ลดการเคลื่อนไหวเห็นวงนิ่ง) */
export function LoadingState({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-3 px-6 py-10 text-sm text-muted ${className}`}>
      <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent motion-reduce:animate-none" />
      {text}
    </div>
  );
}
