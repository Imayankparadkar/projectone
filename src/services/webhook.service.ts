import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';
import { processWebhookEvent } from './payment.service';
import { parsePagination, buildPaginationMeta, PaginationInput } from '../utils/pagination';
import { WebhookInboxStatus } from '@prisma/client';

interface WebhookPayload {
  eventId: string;
  paymentId: string;
  status: string;
}

/**
 * Record a webhook event in the inbox table.
 * Returns { duplicate: true } if eventId already exists (P2002).
 * Otherwise returns the inbox row for downstream processing.
 */
export async function recordWebhookInbox(payload: WebhookPayload) {
  try {
    const inbox = await prisma.webhookInbox.create({
      data: {
        eventId: payload.eventId,
        payload: payload as object,
        status: WebhookInboxStatus.RECEIVED,
        attempts: 0,
      },
    });
    return { duplicate: false, inbox };
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
      logger.info({ eventId: payload.eventId }, 'webhook_inbox_duplicate');
      return { duplicate: true, inbox: null };
    }
    throw err;
  }
}

/**
 * Mark an inbox row as PROCESSED.
 */
export async function markInboxProcessed(eventId: string): Promise<void> {
  await prisma.webhookInbox.updateMany({
    where: { eventId },
    data: { status: WebhookInboxStatus.PROCESSED },
  });
}

/**
 * Mark an inbox row as FAILED with an error reason.
 */
export async function markInboxFailed(eventId: string, error: string, attempts: number): Promise<void> {
  await prisma.webhookInbox.updateMany({
    where: { eventId },
    data: {
      status: WebhookInboxStatus.FAILED,
      lastError: error,
      attempts,
    },
  });
}

/**
 * Increment attempt count on inbox row.
 */
export async function incrementInboxAttempt(eventId: string): Promise<void> {
  await prisma.webhookInbox.updateMany({
    where: { eventId },
    data: { attempts: { increment: 1 } },
  });
}

/**
 * Process webhook inline (fallback when Redis/BullMQ is unavailable).
 */
export async function processWebhookInline(payload: WebhookPayload) {
  try {
    const result = await processWebhookEvent(payload.eventId, payload.paymentId, payload.status);
    await markInboxProcessed(payload.eventId);
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    await markInboxFailed(payload.eventId, errorMsg, 1);
    throw err;
  }
}

/**
 * Admin: list webhook events with optional status filter.
 */
export async function listWebhookEvents(input: PaginationInput & { status?: string }) {
  const { skip, take, page, limit } = parsePagination(input);

  const where: { status?: WebhookInboxStatus } = {};
  if (input.status) {
    where.status = input.status as WebhookInboxStatus;
  }

  const [events, total] = await Promise.all([
    prisma.webhookInbox.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.webhookInbox.count({ where }),
  ]);

  return { events, pagination: buildPaginationMeta(page, limit, total) };
}

/**
 * Admin: get a specific webhook event by eventId.
 */
export async function getWebhookEvent(eventId: string) {
  const event = await prisma.webhookInbox.findUnique({ where: { eventId } });
  return event;
}
