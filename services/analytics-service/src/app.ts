import express from 'express';
import { requireInternalKey } from './auth';
import { flush, flushBeforeRead } from './flush';
import { getLinkStats } from './stats';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // ---- internal เท่านั้น (header x-internal-key) ----
  app.use('/internal', requireInternalKey);

  // redirect-service เรียกหลังมีคลิก (≤ 1 ครั้ง/CLICK_FLUSH_SECONDS)
  app.post('/internal/flush', async (_req, res) => {
    res.json(await flush());
  });

  // core-api เรียกตอนผู้ใช้เปิดหน้าสถิติ: flush ก่อนเพื่อให้ตัวเลขล่าสุด แล้วค่อยอ่าน
  app.get('/internal/links/:id/stats', async (req, res) => {
    const id = Number(String(req.params.id));
    const days = req.query.days === undefined ? 30 : Number(req.query.days);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) return void res.status(404).json({ statusCode: 404, message: 'ไม่พบลิงก์' });
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return void res.status(400).json({ statusCode: 400, message: 'days ต้องเป็นจำนวนเต็ม 1–365' });
    }
    await flushBeforeRead();
    const stats = await getLinkStats(id, days);
    if (!stats) return void res.status(404).json({ statusCode: 404, message: 'ไม่พบลิงก์' });
    res.json(stats);
  });

  app.use((_req, res) => {
    res.status(404).json({ statusCode: 404, message: 'ไม่พบเส้นทางนี้' });
  });
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ statusCode: 500, message: 'เกิดข้อผิดพลาดภายในระบบ' });
  });
  return app;
}
