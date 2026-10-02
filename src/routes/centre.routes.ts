import { Router } from 'express';
import * as centreController from '../controllers/centre.controller';
import * as testController from '../controllers/test.controller';
import { validate } from '../middleware/validate';
import { authenticate, authorize } from '../middleware/auth';
import {
  createCentreSchema,
  updateCentreSchema,
  centreIdParamSchema,
  listCentresSchema,
} from '../schemas/centre.schema';
import {
  addCentreTestSchema,
  updateCentreTestSchema,
  centreTestParamsSchema,
  listCentreTestsSchema,
} from '../schemas/test.schema';

const router = Router();

// Public
router.get('/', validate(listCentresSchema), centreController.list);
router.get('/:id', validate(centreIdParamSchema), centreController.getById);

// Admin only
router.post('/', authenticate, authorize('ADMIN'), validate(createCentreSchema), centreController.create);
router.patch('/:id', authenticate, authorize('ADMIN'), validate(updateCentreSchema), centreController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), validate(centreIdParamSchema), centreController.remove);

// Centre-Test associations
router.get('/:id/tests', validate(listCentreTestsSchema), testController.listCentreTests);
router.post(
  '/:id/tests',
  authenticate,
  authorize('ADMIN'),
  validate(addCentreTestSchema),
  testController.addCentreTest
);
router.patch(
  '/:id/tests/:testId',
  authenticate,
  authorize('ADMIN'),
  validate(updateCentreTestSchema),
  testController.updateCentreTest
);
router.delete(
  '/:id/tests/:testId',
  authenticate,
  authorize('ADMIN'),
  validate(centreTestParamsSchema),
  testController.removeCentreTest
);

export default router;
