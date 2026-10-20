import type { ErrorRequestHandler, RequestHandler } from 'express';

// ข้อผิดพลาดที่ตอบกลับผู้ใช้ได้ตรงๆ (ข้อความภาษาไทย)
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ statusCode: 404, message: 'ไม่พบเส้นทางนี้' });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ statusCode: err.status, message: err.message });
    return;
  }
  // body-parser (JSON พัง/ใหญ่เกิน) ส่ง status 4xx มาเอง
  const status = (err as { status?: unknown })?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ statusCode: status, message: status === 413 ? 'ข้อมูลใหญ่เกินไป' : 'รูปแบบข้อมูลไม่ถูกต้อง' });
    return;
  }
  console.error(err);
  res.status(500).json({ statusCode: 500, message: 'เกิดข้อผิดพลาดภายในระบบ' });
};
