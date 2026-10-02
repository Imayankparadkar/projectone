import { prisma } from '../config/prisma';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors';
import { parsePagination, buildPaginationMeta, PaginationInput } from '../utils/pagination';
import { canTransitionBooking, isTerminalBookingStatus } from '../utils/stateMachine';
import { BookingStatus } from '@prisma/client';
import { logger } from '../utils/logger';

const MAX_BOOKING_DAYS_AHEAD = 90;

interface CreateBookingInput {
  userId: string;
  centreId: string;
  testId: string;
  appointmentAt: string;
}

interface ListBookingsInput extends PaginationInput {
  status?: BookingStatus;
}

export async function createBooking(input: CreateBookingInput) {
  const appointmentAt = new Date(input.appointmentAt);

  // Must be in the future
  if (appointmentAt <= new Date()) {
    throw new BadRequestError('Appointment must be in the future');
  }

  // Must be within 90-day window
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + MAX_BOOKING_DAYS_AHEAD);
  if (appointmentAt > maxDate) {
    throw new BadRequestError(`Appointment must be within ${MAX_BOOKING_DAYS_AHEAD} days`);
  }

  // Find the CentreTest to get the price
  const centreTest = await prisma.centreTest.findUnique({
    where: { centreId_testId: { centreId: input.centreId, testId: input.testId } },
  });
  if (!centreTest) {
    throw new NotFoundError('This test is not available at this centre');
  }

  // The slot uniqueness is enforced by a partial unique index in the DB.
  // If a PENDING or CONFIRMED booking already exists for this centreTest + time, Prisma throws P2002.
  try {
    const booking = await prisma.booking.create({
      data: {
        userId: input.userId,
        centreTestId: centreTest.id,
        appointmentAt,
        amount: centreTest.price,
        status: BookingStatus.PENDING,
      },
      include: {
        centreTest: { include: { centre: true, test: true } },
      },
    });

    logger.info({ bookingId: booking.id, userId: input.userId }, 'booking_created');
    return booking;
  } catch (err: unknown) {
    // Prisma unique constraint violation on the partial index = double-booked slot
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
      throw new ConflictError('This time slot is already booked for this test at this centre');
    }
    throw err;
  }
}

export async function listBookings(userId: string, input: ListBookingsInput) {
  const { skip, take, page, limit } = parsePagination(input);

  const where: { userId: string; status?: BookingStatus } = { userId };
  if (input.status) where.status = input.status;

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        centreTest: { include: { centre: true, test: true } },
        payment: true,
      },
    }),
    prisma.booking.count({ where }),
  ]);

  return { bookings, pagination: buildPaginationMeta(page, limit, total) };
}

export async function getBookingById(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      centreTest: { include: { centre: true, test: true } },
      payment: true,
    },
  });

  // Return 404 for non-existent OR another user's booking (no info leak)
  if (!booking || booking.userId !== userId) {
    throw new NotFoundError('Booking not found');
  }

  return booking;
}

export async function cancelBooking(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

  // No info leak
  if (!booking || booking.userId !== userId) {
    throw new NotFoundError('Booking not found');
  }

  if (!canTransitionBooking(booking.status, BookingStatus.CANCELLED)) {
    throw new ConflictError(
      `Cannot cancel booking in ${booking.status} state`
    );
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.CANCELLED },
    include: {
      centreTest: { include: { centre: true, test: true } },
      payment: true,
    },
  });

  logger.info({ bookingId, userId }, 'booking_cancelled');
  return updated;
}

/**
 * Used by the maintenance worker to cancel stale PENDING bookings.
 */
export async function cancelStalePendingBookings(pendingTtlMinutes: number): Promise<number> {
  const cutoff = new Date(Date.now() - pendingTtlMinutes * 60 * 1000);

  // Find stale pending bookings that have no successful payment
  const staleBookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.PENDING,
      createdAt: { lt: cutoff },
      payment: { is: null }, // no payment at all
    },
    select: { id: true },
  });

  if (staleBookings.length === 0) return 0;

  // Also check bookings whose payment exists but isn't successful
  const staleWithFailedPayment = await prisma.booking.findMany({
    where: {
      status: BookingStatus.PENDING,
      createdAt: { lt: cutoff },
      payment: { status: { not: 'SUCCESS' } },
    },
    select: { id: true },
  });

  const allStaleIds = [...new Set([
    ...staleBookings.map((b) => b.id),
    ...staleWithFailedPayment.map((b) => b.id),
  ])];

  // Update in a transaction. Safe to run concurrently because the WHERE filters
  // on status=PENDING — a concurrent run that already moved it won't match.
  const result = await prisma.booking.updateMany({
    where: {
      id: { in: allStaleIds },
      status: BookingStatus.PENDING, // guard against concurrent updates
    },
    data: { status: BookingStatus.CANCELLED },
  });

  logger.info({ count: result.count, cutoff: cutoff.toISOString() }, 'stale_bookings_cancelled');
  return result.count;
}
