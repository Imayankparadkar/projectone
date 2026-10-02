import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All admin routes require ADMIN role
router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/webhook-events', paymentController.listWebhookEvents);
router.post('/webhook-events/:eventId/retry', paymentController.retryWebhookEvent);

export default router;
