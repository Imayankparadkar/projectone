import { Worker, Job } from 'bullmq';
import { getRedisClient, getRedisStatus } from '../config/redis';
import { processWebhookEvent } from '../services/payment.service';
import { markInboxProcessed, markInboxFailed, incrementInboxAttempt } from '../services/webhook.service';
import { cancelStalePendingBookings } from '../services/booking.service';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { NotFoundError } from '../utils/errors';

let webhookWorker: Worker | null = null;
let maintenanceWorker: Worker | null = null;

// Transient error codes from Postgres worth retrying
const TRANSIENT_PG_CODES = ['40001', '40P01', '08006', '08001', '57P01'];

function isTransientError(err: unknown): boolean {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: string }).code;
    return TRANSIENT_PG_CODES.includes(code);
  }
  return false;
}

export function startWorkers(): void {
  if (!getRedisStatus()) {
    logger.warn('redis_not_available — workers not started');
    return;
  }

  const connection = getRedisClient();
  if (!connection) return;

  // ── Webhook Worker ──
  webhookWorker = new Worker(
    'webhook-processing',
    async (job: Job) => {
      const { eventId, paymentId, status } = job.data;
      logger.info({ eventId, attempt: job.attemptsMade + 1 }, 'job_started');

      await incrementInboxAttempt(eventId);

      try {
        const result = await processWebhookEvent(eventId, paymentId, status);
        await markInboxProcessed(eventId);
        logger.info({ eventId, result }, 'job_completed');
        return result;
      } catch (err) {
        // Permanent errors: don't retry
        if (err instanceof NotFoundError || !isTransientError(err)) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          await markInboxFailed(eventId, errorMsg, job.attemptsMade + 1);
          logger.error({ eventId, err: errorMsg, attempt: job.attemptsMade + 1 }, 'job_failed_permanent');
          // Don't rethrow — marks the job as completed (prevents retry)
          return { failed: true, reason: errorMsg };
        }

        // Transient error — rethrow to trigger BullMQ retry
        logger.warn(
          { eventId, err: (err as Error).message, attempt: job.attemptsMade + 1 },
          'job_failed_transient — will retry'
        );
        throw err;
      }
    },
    {
      connection,
      concurrency: env.WORKER_CONCURRENCY,
    }
  );

  webhookWorker.on('error', (err) => {
    logger.error({ err: err.message }, 'webhook_worker_error');
  });

  // ── Maintenance Worker ──
  maintenanceWorker = new Worker(
    'booking-maintenance',
    async (job: Job) => {
      logger.info({ jobId: job.id }, 'maintenance_job_started');
      const cancelled = await cancelStalePendingBookings(env.BOOKING_PENDING_TTL_MINUTES);
      logger.info({ cancelled, jobId: job.id }, 'maintenance_job_completed');
      return { cancelled };
    },
    {
      connection,
      concurrency: 1, // only one maintenance job at a time
    }
  );

  maintenanceWorker.on('error', (err) => {
    logger.error({ err: err.message }, 'maintenance_worker_error');
  });

  logger.info('workers_started');
}

export async function stopWorkers(): Promise<void> {
  const closers: Promise<void>[] = [];
  if (webhookWorker) closers.push(webhookWorker.close());
  if (maintenanceWorker) closers.push(maintenanceWorker.close());
  await Promise.all(closers);
  webhookWorker = null;
  maintenanceWorker = null;
  logger.info('workers_stopped');
}
