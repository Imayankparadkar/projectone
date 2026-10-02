import { z } from 'zod';

export const createTestSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(200),
    code: z.string().min(1, 'Code is required').max(50),
    description: z.string().max(1000).optional(),
  }).strict(),
});

export const updateTestSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    code: z.string().min(1).max(50).optional(),
    description: z.string().max(1000).optional(),
  }).strict(),
  params: z.object({ id: z.string().uuid('Invalid test ID') }),
});

export const testIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid test ID') }),
});

export const listTestsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().optional(),
  }),
});

// Centre-Test association (price at this centre)
export const addCentreTestSchema = z.object({
  body: z.object({
    testId: z.string().uuid('Invalid test ID'),
    price: z.number().positive('Price must be greater than 0'),
  }).strict(),
  params: z.object({ id: z.string().uuid('Invalid centre ID') }),
});

export const updateCentreTestSchema = z.object({
  body: z.object({
    price: z.number().positive('Price must be greater than 0'),
  }).strict(),
  params: z.object({
    id: z.string().uuid('Invalid centre ID'),
    testId: z.string().uuid('Invalid test ID'),
  }),
});

export const centreTestParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid centre ID'),
    testId: z.string().uuid('Invalid test ID'),
  }),
});

export const listCentreTestsSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid centre ID') }),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});
