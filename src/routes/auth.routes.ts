import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { signupSchema, loginSchema } from '../schemas/auth.schema';
import { authRateLimit } from '../middleware/rateLimit';

const router = Router();

router.post('/signup', authRateLimit, validate(signupSchema), authController.signup);
router.post('/login', authRateLimit, validate(loginSchema), authController.login);

export default router;
