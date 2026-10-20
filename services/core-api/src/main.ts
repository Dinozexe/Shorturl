import { createApp } from './app';
import { config } from './common/config';
import { prisma } from './prisma/client';
import { redis } from './redis/client';

const server = createApp().listen(config.port, '0.0.0.0', () => {
  console.log(`core-api listening on :${config.port}`);
});

function shutdown() {
  server.close(async () => {
    await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
