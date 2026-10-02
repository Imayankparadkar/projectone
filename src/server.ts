import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { connectRedis, disconnectRedis } from './config/redis';
import { startWorkers, stopWorkers } from './workers/worker';
import { scheduleMaintenanceJob } from './queues/maintenance.queue';
import { closeWebhookQueue } from './queues/webhook.queue';
import { closeMaintenanceQueue } from './queues/maintenance.queue';
import { logger } from './utils/logger';
import http from 'http';

const server = http.createServer(app);

async function start() {
  // Connect Redis (optional)
  await connectRedis();

  // In development, start workers in-process for convenience
  if (env.NODE_ENV === 'development') {
    startWorkers();
    await scheduleMaintenanceJob();
  }

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, `🚀 Server running on port ${env.PORT}`);
    logger.info(`📖 API docs: http://localhost:${env.PORT}/api-docs`);
  });
}

// ── Graceful shutdown ──
async function shutdown(signal: string) {
  logger.info({ signal }, 'shutdown_signal_received');

  server.close(async () => {
    logger.info('http_server_closed');

    try {
      await stopWorkers();
      await closeWebhookQueue();
      await closeMaintenanceQueue();
      await disconnectRedis();
      await prisma.$disconnect();
      logger.info('graceful_shutdown_complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'shutdown_error');
      process.exit(1);
    }
  });

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    logger.error('forced_shutdown — timeout exceeded');
    process.exit(1);
  }, 10_000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((err) => {
  logger.error({ err }, 'startup_error');
  process.exit(1);
});
