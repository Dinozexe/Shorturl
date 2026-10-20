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
  console.error(err);
  res.status(500).json({ statusCode: 500, message: 'เกิดข้อผิดพลาดภายในระบบ' });
};
