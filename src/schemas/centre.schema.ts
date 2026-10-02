import { z } from 'zod';

export const createCentreSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(200),
    location: z.string().min(1, 'Location is required').max(500),
  }).strict(),
});

export const updateCentreSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    location: z.string().min(1).max(500).optional(),
  }).strict(),
  params: z.object({ id: z.string().uuid('Invalid centre ID') }),
});

export const centreIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid centre ID') }),
});

export const listCentresSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    location: z.string().optional(),
    search: z.string().optional(),
  }),
});
