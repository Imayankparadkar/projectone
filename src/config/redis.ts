import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;
let isRedisAvailable = false;

/**
 * Initialises the Redis connection if REDIS_ENABLED=true.
 * Returns null if Redis is disabled or unreachable — the app still works.
 */
export function getRedisClient(): Redis | null {
  if (!env.REDIS_ENABLED) return null;
  if (redisClient) return isRedisAvailable ? redisClient : null;

  redisClient = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 5) {
        logger.warn('redis_retry_exhausted — falling back to in-memory');
        isRedisAvailable = false;
        return null; // stop retrying
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });

  redisClient.on('connect', () => {
    isRedisAvailable = true;
    logger.info('redis_connected');
  });

  redisClient.on('error', (err) => {
    isRedisAvailable = false;
    logger.warn({ err: err.message }, 'redis_error — cache/queue bypassed');
  });

  redisClient.on('close', () => {
    isRedisAvailable = false;
  });

  // Attempt to connect but don't crash if it fails
  redisClient.connect().catch((err) => {
    isRedisAvailable = false;
    logger.warn({ err: err.message }, 'redis_connect_failed — running without Redis');
  });

  return isRedisAvailable ? redisClient : null;
}

export function getRedisStatus(): boolean {
  return isRedisAvailable;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      // ignore errors during shutdown
    }
    redisClient = null;
    isRedisAvailable = false;
  }
}

/**
 * Raw Redis getter — returns null on any failure so callers never crash.
 */
export async function connectRedis(): Promise<Redis | null> {
  if (!env.REDIS_ENABLED) return null;
  const client = getRedisClient();
  if (!client || !isRedisAvailable) return null;
  return client;
}
