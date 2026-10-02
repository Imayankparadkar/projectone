import { z } from 'zod';

export const createBookingSchema = z.object({
  body: z.object({
    centreId: z.string().uuid('Invalid centre ID'),
    testId: z.string().uuid('Invalid test ID'),
    appointmentAt: z.string().datetime({ message: 'appointmentAt must be a valid ISO 8601 datetime' }),
  }).strict(), // Reject unknown fields — amount, status etc. come from the server
});

export const bookingIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid booking ID') }),
});

export const listBookingsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: z.enum(['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED']).optional(),
  }),
});
