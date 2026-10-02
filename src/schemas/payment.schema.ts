import { z } from 'zod';

export const createPaymentSchema = z.object({
  body: z.object({
    bookingId: z.string().uuid('Invalid booking ID'),
  }).strict(), // Amount comes from the booking, not the client
});

export const webhookSchema = z.object({
  body: z.object({
    eventId: z.string().min(1, 'eventId is required'),
    paymentId: z.string().uuid('Invalid payment ID'),
    status: z.enum(['SUCCESS', 'FAILED'], { message: 'status must be SUCCESS or FAILED' }),
  }).strict(),
});
