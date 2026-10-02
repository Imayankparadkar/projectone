import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// Try to use the Redis store if available; otherwise fall back to memory
let RedisStore: any = null;

async function getStore() {
  if (!env.REDIS_ENABLED) return undefined; // memory store
  try {
    const { default: RateLimitRedisStore } = await import('rate-limit-redis');
    const { getRedisClient, getRedisStatus } = await import('../config/redis');
    if (!getRedisStatus()) return undefined;
    const client = getRedisClient();
    if (!client) return undefined;

    return new RateLimitRedisStore({
      // Use `ioredis` sendCommand
      sendCommand: (...args: string[]) => (client as any).call(...args),
    });
  } catch (err) {
    logger.warn('rate_limit_redis_unavailable — using memory store');
    return undefined;
  }
}

function rateLimitHandler(_req: any, res: any) {
  res.status(429).json({
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests, please try again later',
    },
  });
}

const skipRateLimitInTest = () => env.NODE_ENV === 'test';

// Strict: auth endpoints (per IP)
export const authRateLimit = rateLimit({
  skip: skipRateLimitInTest,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  // Default keyGenerator uses IP safely
});

// Moderate: payment endpoints (per user)
export const paymentRateLimit = rateLimit({
  skip: skipRateLimitInTest,
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  // Authenticated route: always use userId
  keyGenerator: (req) => (req as any).userId,
});

// Generous: webhook endpoint (per IP)
export const webhookRateLimit = rateLimit({
  skip: skipRateLimitInTest,
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  // Default keyGenerator uses IP safely
});

// General API rate limit
export const generalRateLimit = rateLimit({
  skip: skipRateLimitInTest,
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
