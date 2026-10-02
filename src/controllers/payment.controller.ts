import { Request, Response, NextFunction } from 'express';
import * as paymentService from '../services/payment.service';
import * as webhookService from '../services/webhook.service';
import { env } from '../config/env';
import { UnauthorizedError, NotFoundError } from '../utils/errors';
import { successResponse } from '../utils/response';
import { logger } from '../utils/logger';
import { getRedisStatus } from '../config/redis';
import { enqueueWebhookJob } from '../queues/webhook.queue';

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { payment, existing } = await paymentService.createPayment(
      req.body.bookingId,
      req.userId!,
      req.headers['x-test-payment-outcome'] as string | undefined
    );
    successResponse(res, { ...payment, existing }, existing ? 200 : 201);
  } catch (err) {
    next(err);
  }
}

export async function webhook(req: Request, res: Response, next: NextFunction) {
  try {
    // Verify webhook secret
    const secret = req.headers['x-webhook-secret'] as string;
    if (!secret || secret !== env.WEBHOOK_SECRET) {
      throw new UnauthorizedError('Invalid webhook secret');
    }

    const { eventId, paymentId, status } = req.body;

    // 1. Record in webhook inbox (duplicate detection via unique eventId)
    const { duplicate, inbox } = await webhookService.recordWebhookInbox({
      eventId,
      paymentId,
      status,
    });

    if (duplicate) {
      res.status(200).json({ success: true, data: { duplicate: true } });
      return;
    }

    // 2. Try to enqueue via BullMQ; fall back to inline processing
    const redisAvailable = getRedisStatus();
    if (redisAvailable) {
      try {
        await enqueueWebhookJob({ eventId, paymentId, status });
        // Return 202 — event will be processed asynchronously
        res.status(202).json({
          success: true,
          data: { message: 'Event accepted for processing', eventId },
        });
        return;
      } catch (err) {
        logger.warn({ err, eventId }, 'webhook_enqueue_failed — falling back to inline');
        // Fall through to inline processing
      }
    }

    // 3. Inline fallback: process synchronously
    const result = await webhookService.processWebhookInline({ eventId, paymentId, status });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ── Admin endpoints for webhook management ──

export async function listWebhookEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const { events, pagination } = await webhookService.listWebhookEvents(req.query as any);
    successResponse(res, events, 200, pagination);
  } catch (err) {
    next(err);
  }
}

export async function retryWebhookEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const { eventId } = req.params;
    const event = await webhookService.getWebhookEvent(eventId as string);
    if (!event) throw new NotFoundError('Webhook event not found');

    const payload = event.payload as { eventId: string; paymentId: string; status: string };

    // Re-enqueue or process inline
    const redisAvailable = getRedisStatus();
    if (redisAvailable) {
      try {
        await enqueueWebhookJob(payload);
        successResponse(res, { message: 'Event re-enqueued for processing', eventId });
        return;
      } catch {
        // fall through
      }
    }

    const result = await webhookService.processWebhookInline(payload);
    successResponse(res, result);
  } catch (err) {
    next(err);
  }
}
