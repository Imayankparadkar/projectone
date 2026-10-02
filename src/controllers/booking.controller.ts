import { Request, Response, NextFunction } from 'express';
import * as bookingService from '../services/booking.service';
import { successResponse } from '../utils/response';

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const booking = await bookingService.createBooking({
      userId: req.userId!,
      centreId: req.body.centreId,
      testId: req.body.testId,
      appointmentAt: req.body.appointmentAt,
    });
    successResponse(res, booking, 201);
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { bookings, pagination } = await bookingService.listBookings(
      req.userId!,
      req.query as any
    );
    successResponse(res, bookings, 200, pagination);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const booking = await bookingService.getBookingById(req.params.id as string, req.userId!);
    successResponse(res, booking);
  } catch (err) {
    next(err);
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    const booking = await bookingService.cancelBooking(req.params.id as string, req.userId!);
    successResponse(res, booking);
  } catch (err) {
    next(err);
  }
}
