/**
 * Standalone worker entrypoint.
 * Run with: npm run worker
 * Can also be started in the API process for local dev.
 */
import { env } from '../config/env';
import { connectRedis, disconnectRedis } from '../config/redis';
import { startWorkers, stopWorkers } from './worker';
import { scheduleMaintenanceJob } from '../queues/maintenance.queue';
import { closeWebhookQueue } from '../queues/webhook.queue';
import { closeMaintenanceQueue } from '../queues/maintenance.queue';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';

async function main() {
  logger.info('Starting worker process…');

  await connectRedis();
  startWorkers();
  await scheduleMaintenanceJob();

  logger.info('Worker process running. Press Ctrl+C to stop.');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'worker_shutdown_signal');
    await stopWorkers();
    await closeWebhookQueue();
    await closeMaintenanceQueue();
    await disconnectRedis();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'worker_fatal_error');
  process.exit(1);
});
