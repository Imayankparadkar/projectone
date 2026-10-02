import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default('24h'),

  CORS_ORIGIN: z.string().default('*'),

  WEBHOOK_SECRET: z.string().min(8),

  REDIS_ENABLED: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),

  BOOKING_PENDING_TTL_MINUTES: z.coerce.number().int().positive().default(30),

  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),

  // In test mode set to SUCCESS or FAILED for deterministic payment simulation
  PAYMENT_TEST_OUTCOME: z
    .enum(['SUCCESS', 'FAILED', ''])
    .default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
