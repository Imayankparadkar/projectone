import { Queue } from 'bullmq';
import { getRedisClient, getRedisStatus } from '../config/redis';
import { logger } from '../utils/logger';

let maintenanceQueue: Queue | null = null;

export function getMaintenanceQueue(): Queue | null {
  if (!getRedisStatus()) return null;
  if (maintenanceQueue) return maintenanceQueue;

  const connection = getRedisClient();
  if (!connection) return null;

  maintenanceQueue = new Queue('booking-maintenance', {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    },
  });

  return maintenanceQueue;
}

/**
 * Add the repeatable maintenance job (every 5 minutes).
 */
export async function scheduleMaintenanceJob(): Promise<void> {
  const queue = getMaintenanceQueue();
  if (!queue) {
    logger.warn('maintenance_queue_not_available — skipping schedule');
    return;
  }

  await queue.add('cancel-stale-bookings', {}, {
    repeat: { every: 5 * 60 * 1000 },
    jobId: 'stale-booking-maintenance',
  } as any);

  logger.info('maintenance_job_scheduled — every 5 minutes');
}

export async function closeMaintenanceQueue(): Promise<void> {
  if (maintenanceQueue) {
    await maintenanceQueue.close();
    maintenanceQueue = null;
  }
}
