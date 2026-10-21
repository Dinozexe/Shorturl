import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

// ใส่ "คลิกตัวอย่าง" ให้ลิงก์ของผู้ใช้คนหนึ่ง เพื่อดูหน้าสถิติตอนมีข้อมูลจริง (กราฟ/สัดส่วนอุปกรณ์/ประเทศ ฯลฯ)
//   ใส่:   npx tsx prisma/demo-clicks.ts <อีเมล> [จำนวนคลิกของลิงก์แรก=420]   (ลิงก์ถัดไปได้ ~1/6 ของลิงก์แรก)
//   ลบ:   npx tsx prisma/demo-clicks.ts <อีเมล> --remove
// คลิกตัวอย่างทุกแถวมี user_agent = 'demo-seed' จึงลบออกได้หมดโดยไม่แตะคลิกจริง
const MARK = 'demo-seed';
const prisma = new PrismaClient();

const pick = <T>(rows: Array<[T, number]>): T => {
  let r = Math.random() * rows.reduce((a, [, w]) => a + w, 0);
  for (const [v, w] of rows) if ((r -= w) <= 0) return v;
  return rows[rows.length - 1][0];
};

const COUNTRIES: Array<[string | null, number]> = [['TH', 70], ['US', 8], ['JP', 5], ['SG', 4], ['GB', 3], ['DE', 2], [null, 8]];
const REFERERS: Array<[string | null, number]> = [[null, 38], ['https://www.facebook.com', 20], ['https://line.me', 16], ['https://www.google.com', 12], ['https://t.co', 7], ['https://www.instagram.com', 7]];
const DEVICES: Array<['mobile' | 'desktop' | 'tablet' | 'bot', number]> = [['mobile', 62], ['desktop', 32], ['tablet', 4], ['bot', 2]];
const OS: Record<string, Array<[string | null, number]>> = {
  mobile: [['Android', 58], ['iOS', 42]],
  tablet: [['iOS', 70], ['Android', 30]],
  desktop: [['Windows', 55], ['macOS', 38], ['Linux', 7]],
  bot: [[null, 1]],
};
const BROWSERS: Record<string, Array<[string | null, number]>> = {
  mobile: [['Chrome', 52], ['Safari', 38], ['Samsung Internet', 7], ['Firefox', 3]],
  tablet: [['Safari', 70], ['Chrome', 30]],
  desktop: [['Chrome', 62], ['Edge', 16], ['Safari', 14], ['Firefox', 8]],
  bot: [[null, 1]],
};
// ชั่วโมง (เวลาไทย) ที่คนเปิดมาก: เที่ยง และช่วงเย็น–ค่ำ
const HOUR_W = [1, 1, 1, 1, 1, 2, 3, 5, 6, 6, 7, 8, 11, 9, 7, 7, 8, 9, 11, 13, 14, 12, 6, 3];

function makeClicks(linkId: number, total: number, days: number) {
  const now = Date.now();
  // น้ำหนักรายวัน: ค่อยๆ โตขึ้น + วันสุดสัปดาห์เบาลงเล็กน้อย + มีวันพีค 2 วัน
  const dayW = Array.from({ length: days }, (_, i) => {
    const d = new Date(now - (days - 1 - i) * 86400e3);
    const weekend = [0, 6].includes(d.getUTCDay()) ? 0.7 : 1;
    return 0.35 + (i / (days - 1)) * 1.1 * weekend + (i === days - 9 || i === days - 3 ? 1.6 : 0) + Math.random() * 0.3;
  });
  const visitors = Math.max(8, Math.round(total * 0.62)); // คนเข้าซ้ำบ้าง
  const rows = [];
  for (let n = 0; n < total; n++) {
    const di = pick(dayW.map((w, i) => [i, w] as [number, number]));
    const hourTh = pick(HOUR_W.map((w, h) => [h, w] as [number, number]));
    const dayStart = new Date(now - (days - 1 - di) * 86400e3);
    dayStart.setUTCHours(0, 0, 0, 0);
    let at = dayStart.getTime() + ((hourTh - 7 + 24) % 24) * 3600e3 + Math.floor(Math.random() * 3600e3);
    if (at > now) at = now - Math.floor(Math.random() * 3600e3);
    const device = pick(DEVICES);
    rows.push({
      linkId,
      ipHash: createHash('sha256').update(`demo-${linkId}-${Math.floor(Math.random() * visitors)}`).digest('hex'),
      userAgent: MARK,
      referer: pick(REFERERS),
      country: pick(COUNTRIES),
      device,
      os: pick(OS[device]),
      browser: pick(BROWSERS[device]),
      clickedAt: new Date(at),
    });
  }
  return rows;
}

const dayOf = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

async function remove(userId: string) {
  const links = await prisma.link.findMany({ where: { userId }, select: { id: true } });
  let removed = 0;
  for (const { id } of links) {
    const rows = await prisma.click.findMany({ where: { linkId: id, userAgent: MARK }, select: { clickedAt: true } });
    if (!rows.length) continue;
    const perDay = new Map<number, number>();
    for (const r of rows) perDay.set(dayOf(r.clickedAt).getTime(), (perDay.get(dayOf(r.clickedAt).getTime()) ?? 0) + 1);
    await prisma.$transaction([
      prisma.click.deleteMany({ where: { linkId: id, userAgent: MARK } }),
      ...[...perDay].map(([t, n]) => prisma.linkDailyStat.updateMany({ where: { linkId: id, day: new Date(t) }, data: { clicks: { decrement: n } } })),
      prisma.linkDailyStat.deleteMany({ where: { linkId: id, clicks: { lte: 0 } } }),
      prisma.link.update({ where: { id }, data: { clickCount: { decrement: rows.length } } }),
    ]);
    removed += rows.length;
  }
  console.log(`ลบคลิกตัวอย่าง ${removed} แถว`);
}

async function add(userId: string, first: number) {
  const links = await prisma.link.findMany({ where: { userId }, orderBy: { id: 'asc' }, take: 5 });
  if (!links.length) throw new Error('ผู้ใช้นี้ยังไม่มีลิงก์ — สร้างลิงก์ก่อน');
  for (const [i, link] of links.entries()) {
    const total = i === 0 ? first : Math.max(12, Math.round(first / (4 + i * 2)));
    const rows = makeClicks(link.id, total, 30);
    const perDay = new Map<number, number>();
    for (const r of rows) perDay.set(dayOf(r.clickedAt).getTime(), (perDay.get(dayOf(r.clickedAt).getTime()) ?? 0) + 1);
    await prisma.$transaction([
      prisma.click.createMany({ data: rows }),
      ...[...perDay].map(([t, n]) =>
        prisma.linkDailyStat.upsert({ where: { linkId_day: { linkId: link.id, day: new Date(t) } }, update: { clicks: { increment: n } }, create: { linkId: link.id, day: new Date(t), clicks: n } }),
      ),
      prisma.link.update({ where: { id: link.id }, data: { clickCount: { increment: rows.length } } }),
    ]);
    console.log(`  ${link.shortCode}: +${rows.length} คลิก`);
  }
}

(async () => {
  const [email, arg] = process.argv.slice(2);
  if (!email) throw new Error('ใช้: npx tsx prisma/demo-clicks.ts <อีเมล> [จำนวน | --remove]');
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw new Error(`ไม่พบผู้ใช้ ${email}`);
  if (arg === '--remove') await remove(user.id);
  else await add(user.id, Math.min(5000, Math.max(20, Number(arg) || 420)));
})()
  .catch((e) => {
    console.error(`✗ ${e.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
