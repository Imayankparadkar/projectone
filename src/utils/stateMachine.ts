import { BookingStatus, PaymentStatus } from '@prisma/client';

/**
 * Single source of truth for booking state transitions.
 * Keys are current states; values are the set of allowed next states.
 * CONFIRMED, FAILED, CANCELLED are terminal — no outgoing transitions.
 */
const BOOKING_TRANSITIONS: Record<BookingStatus, Set<BookingStatus>> = {
  PENDING: new Set([BookingStatus.CONFIRMED, BookingStatus.FAILED, BookingStatus.CANCELLED]),
  CONFIRMED: new Set(),
  FAILED: new Set(),
  CANCELLED: new Set(),
};

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from]?.has(to) ?? false;
}

export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[status]?.size === 0;
}

/**
 * Single source of truth for payment state transitions.
 * PENDING → SUCCESS or FAILED. Both are terminal.
 */
const PAYMENT_TRANSITIONS: Record<PaymentStatus, Set<PaymentStatus>> = {
  PENDING: new Set([PaymentStatus.SUCCESS, PaymentStatus.FAILED]),
  SUCCESS: new Set(),
  FAILED: new Set(),
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from]?.has(to) ?? false;
}

export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[status]?.size === 0;
}

/**
 * Maps a payment outcome to a booking status.
 */
export function paymentStatusToBookingStatus(paymentStatus: PaymentStatus): BookingStatus | null {
  switch (paymentStatus) {
    case PaymentStatus.SUCCESS:
      return BookingStatus.CONFIRMED;
    case PaymentStatus.FAILED:
      return BookingStatus.FAILED;
    default:
      return null;
  }
}
