import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { authRouter } from './auth/auth.routes';
import { config } from './common/config';
import { errorHandler, notFoundHandler } from './common/http-error';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // หลัง proxy ของ Render
  app.use(cors({ origin: config.frontendOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // router ทุกตัวประกาศ prefix `/api/...` เอง (ไม่ใช้ global prefix)
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/auth', authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
