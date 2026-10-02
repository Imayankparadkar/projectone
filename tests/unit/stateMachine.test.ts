import { describe, it, expect } from 'vitest';
import { canTransitionBooking, canTransitionPayment, paymentStatusToBookingStatus } from '../../src/utils/stateMachine';
import { BookingStatus, PaymentStatus } from '@prisma/client';

describe('State Machine', () => {
  describe('Booking Transitions', () => {
    it('allows transition from PENDING to CONFIRMED', () => {
      expect(canTransitionBooking(BookingStatus.PENDING, BookingStatus.CONFIRMED)).toBe(true);
    });

    it('allows transition from PENDING to FAILED', () => {
      expect(canTransitionBooking(BookingStatus.PENDING, BookingStatus.FAILED)).toBe(true);
    });

    it('allows transition from PENDING to CANCELLED', () => {
      expect(canTransitionBooking(BookingStatus.PENDING, BookingStatus.CANCELLED)).toBe(true);
    });

    it('prevents transition out of CONFIRMED', () => {
      expect(canTransitionBooking(BookingStatus.CONFIRMED, BookingStatus.CANCELLED)).toBe(false);
      expect(canTransitionBooking(BookingStatus.CONFIRMED, BookingStatus.FAILED)).toBe(false);
    });

    it('prevents transition out of CANCELLED', () => {
      expect(canTransitionBooking(BookingStatus.CANCELLED, BookingStatus.PENDING)).toBe(false);
    });
  });

  describe('Payment Transitions', () => {
    it('allows transition from PENDING to SUCCESS', () => {
      expect(canTransitionPayment(PaymentStatus.PENDING, PaymentStatus.SUCCESS)).toBe(true);
    });

    it('allows transition from PENDING to FAILED', () => {
      expect(canTransitionPayment(PaymentStatus.PENDING, PaymentStatus.FAILED)).toBe(true);
    });

    it('prevents transition out of SUCCESS', () => {
      expect(canTransitionPayment(PaymentStatus.SUCCESS, PaymentStatus.FAILED)).toBe(false);
    });
  });

  describe('paymentStatusToBookingStatus', () => {
    it('maps SUCCESS to CONFIRMED', () => {
      expect(paymentStatusToBookingStatus(PaymentStatus.SUCCESS)).toBe(BookingStatus.CONFIRMED);
    });

    it('maps FAILED to FAILED', () => {
      expect(paymentStatusToBookingStatus(PaymentStatus.FAILED)).toBe(BookingStatus.FAILED);
    });
    
    it('returns null for PENDING', () => {
        expect(paymentStatusToBookingStatus(PaymentStatus.PENDING)).toBeNull();
    });
  });
});
