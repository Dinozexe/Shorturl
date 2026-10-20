import { createApp } from './app';
import { config } from './config';
import { pool } from './db';
import { redis } from './redis';

const server = createApp().listen(config.port, '0.0.0.0', () => {
  console.log(`analytics-service listening on :${config.port}`);
});

function shutdown() {
  server.close(async () => {
    await Promise.allSettled([pool.end(), redis.quit()]);
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
