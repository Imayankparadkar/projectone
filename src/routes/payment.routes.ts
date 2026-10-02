import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller';
import { validate } from '../middleware/validate';
import { authenticate, authorize } from '../middleware/auth';
import { createPaymentSchema, webhookSchema } from '../schemas/payment.schema';
import { paymentRateLimit, webhookRateLimit } from '../middleware/rateLimit';

const router = Router();

// Create payment (auth required, owner only checked in service)
router.post('/', authenticate, paymentRateLimit, validate(createPaymentSchema), paymentController.create);

// Webhook (secret verified in controller, no JWT)
router.post('/webhook', webhookRateLimit, validate(webhookSchema), paymentController.webhook);

export default router;
