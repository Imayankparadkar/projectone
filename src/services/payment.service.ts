import { prisma } from '../config/prisma';
import { NotFoundError, ConflictError } from '../utils/errors';
import {
  canTransitionBooking,
  canTransitionPayment,
  paymentStatusToBookingStatus,
  isTerminalPaymentStatus,
} from '../utils/stateMachine';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Simulate a payment outcome.
 * In test mode (PAYMENT_TEST_OUTCOME set), returns a deterministic result.
 * Otherwise, randomly succeeds ~70% of the time.
 * The X-Test-Payment-Outcome header can also override (test mode only).
 */
function simulatePaymentOutcome(headerOverride?: string): PaymentStatus {
  // Header override only works when test outcome env is set (test mode)
  if (env.PAYMENT_TEST_OUTCOME) {
    if (headerOverride === 'SUCCESS' || headerOverride === 'FAILED') {
      return headerOverride as PaymentStatus;
    }
    return env.PAYMENT_TEST_OUTCOME as PaymentStatus;
  }
  return Math.random() < 0.7 ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;
}

export async function createPayment(bookingId: string, userId: string, headerOverride?: string) {
  // Fetch the booking
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payment: true },
  });

  // Ownership check — return 404 for non-existent or another user's booking
  if (!booking || booking.userId !== userId) {
    throw new NotFoundError('Booking not found');
  }

  // If a payment already exists, return it (idempotent)
  if (booking.payment) {
    logger.info({ bookingId, paymentId: booking.payment.id }, 'payment_already_exists');
    return { payment: booking.payment, existing: true };
  }

  // Only PENDING bookings can receive a payment
  if (booking.status !== BookingStatus.PENDING) {
    throw new ConflictError(`Cannot create payment for booking in ${booking.status} state`);
  }

  const simulatedStatus = simulatePaymentOutcome(headerOverride);
  const bookingNewStatus = paymentStatusToBookingStatus(simulatedStatus);

  // Create payment + update booking in ONE transaction
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        bookingId,
        amount: booking.amount,
        status: simulatedStatus,
        providerReference: `sim_${uuidv4().slice(0, 8)}`,
      },
    });

    if (bookingNewStatus && canTransitionBooking(booking.status, bookingNewStatus)) {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: bookingNewStatus },
      });
    }

    return payment;
  });

  logger.info(
    { bookingId, paymentId: result.id, status: result.status },
    'payment_processed'
  );

  return { payment: result, existing: false };
}

/**
 * Process a webhook event. This is the core logic shared by both the
 * BullMQ worker and the inline fallback.
 *
 * Inside ONE transaction:
 * 1. INSERT PaymentEvent (eventId UNIQUE). P2002 = duplicate → return early.
 * 2. Lock the Payment row (SELECT ... FOR UPDATE) to prevent concurrent modifications.
 * 3. If payment is already terminal, record the event but don't change state.
 * 4. Otherwise, transition payment + booking via the state machine.
 */
export async function processWebhookEvent(eventId: string, paymentId: string, statusStr: string) {
  const status = statusStr as PaymentStatus;

  return await prisma.$transaction(async (tx) => {
    // 1. Try to insert PaymentEvent — duplicate eventId raises P2002
    try {
      await tx.paymentEvent.create({
        data: {
          eventId,
          paymentId,
          status: statusStr,
          processedAt: new Date(),
        },
      });
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
        logger.info({ eventId }, 'webhook_duplicate_ignored');
        return { duplicate: true, applied: false };
      }
      throw err;
    }

    // 2. Lock the payment row. We use a raw query for SELECT ... FOR UPDATE.
    const payments = await tx.$queryRawUnsafe<Array<{
      id: string;
      booking_id: string;
      status: string;
    }>>(
      `SELECT id, booking_id, status FROM payments WHERE id = $1 FOR UPDATE`,
      paymentId
    );

    if (payments.length === 0) {
      throw new NotFoundError('Payment not found');
    }

    const payment = payments[0];
    const currentPaymentStatus = payment.status as PaymentStatus;

    // 3. If payment is already terminal, record event but don't change anything
    if (isTerminalPaymentStatus(currentPaymentStatus)) {
      logger.info(
        { eventId, paymentId, currentStatus: currentPaymentStatus, incomingStatus: status },
        'webhook_terminal_state_ignored'
      );
      return { duplicate: false, applied: false, reason: 'payment_already_terminal' };
    }

    // 4. Apply the transition if valid
    if (!canTransitionPayment(currentPaymentStatus, status)) {
      logger.warn(
        { eventId, paymentId, from: currentPaymentStatus, to: status },
        'webhook_invalid_transition'
      );
      return { duplicate: false, applied: false, reason: 'invalid_transition' };
    }

    await tx.payment.update({
      where: { id: paymentId },
      data: { status },
    });

    // Also update the booking
    const bookingNewStatus = paymentStatusToBookingStatus(status);
    if (bookingNewStatus) {
      // Use conditional update so a cancelled booking won't be overwritten
      await tx.booking.updateMany({
        where: {
          id: payment.booking_id,
          status: BookingStatus.PENDING, // only transition from PENDING
        },
        data: { status: bookingNewStatus },
      });
    }

    logger.info(
      { eventId, paymentId, status, bookingId: payment.booking_id },
      'webhook_event_applied'
    );

    return { duplicate: false, applied: true };
  });
}
