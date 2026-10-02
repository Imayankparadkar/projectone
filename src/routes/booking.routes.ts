import { Router } from 'express';
import * as bookingController from '../controllers/booking.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import {
  createBookingSchema,
  bookingIdParamSchema,
  listBookingsSchema,
} from '../schemas/booking.schema';

const router = Router();

// All booking routes require authentication
router.use(authenticate);

router.post('/', validate(createBookingSchema), bookingController.create);
router.get('/', validate(listBookingsSchema), bookingController.list);
router.get('/:id', validate(bookingIdParamSchema), bookingController.getById);
router.post('/:id/cancel', validate(bookingIdParamSchema), bookingController.cancel);

export default router;
