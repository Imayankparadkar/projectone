import { Router } from 'express';
import * as testController from '../controllers/test.controller';
import { validate } from '../middleware/validate';
import { authenticate, authorize } from '../middleware/auth';
import {
  createTestSchema,
  updateTestSchema,
  testIdParamSchema,
  listTestsSchema,
} from '../schemas/test.schema';

const router = Router();

// Public
router.get('/', validate(listTestsSchema), testController.list);
router.get('/:id', validate(testIdParamSchema), testController.getById);

// Admin only
router.post('/', authenticate, authorize('ADMIN'), validate(createTestSchema), testController.create);
router.patch('/:id', authenticate, authorize('ADMIN'), validate(updateTestSchema), testController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), validate(testIdParamSchema), testController.remove);

export default router;
