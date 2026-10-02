import { Queue } from 'bullmq';
import { getRedisClient, getRedisStatus } from '../config/redis';
import { logger } from '../utils/logger';

let webhookQueue: Queue | null = null;

interface WebhookJobData {
  eventId: string;
  paymentId: string;
  status: string;
}

export function getWebhookQueue(): Queue | null {
  if (!getRedisStatus()) return null;
  if (webhookQueue) return webhookQueue;

  const connection = getRedisClient();
  if (!connection) return null;

  webhookQueue = new Queue('webhook-processing', {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });

  return webhookQueue;
}

/**
 * Enqueue a webhook job. Uses eventId as the jobId for BullMQ-level dedup.
 */
export async function enqueueWebhookJob(data: WebhookJobData): Promise<void> {
  const queue = getWebhookQueue();
  if (!queue) throw new Error('Webhook queue not available');

  await queue.add('process-webhook', data, {
    jobId: data.eventId, // BullMQ dedup layer
  });

  logger.info({ eventId: data.eventId }, 'webhook_job_enqueued');
}

export async function closeWebhookQueue(): Promise<void> {
  if (webhookQueue) {
    await webhookQueue.close();
    webhookQueue = null;
  }
}
