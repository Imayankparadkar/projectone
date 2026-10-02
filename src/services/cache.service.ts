import { getRedisClient, getRedisStatus } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import crypto from 'crypto';

/**
 * Cache-aside service backed by Redis.
 * If Redis is disabled or unreachable, all operations are no-ops.
 * NEVER cache user-specific data (bookings, payments) or auth data.
 */

function jitteredTtl(): number {
  // Add ±10% jitter to avoid cache stampedes
  const base = env.CACHE_TTL_SECONDS;
  const jitter = Math.floor(base * 0.1 * (Math.random() * 2 - 1));
  return base + jitter;
}

export function hashFilters(filters: Record<string, unknown>): string {
  const sorted = JSON.stringify(filters, Object.keys(filters).sort());
  return crypto.createHash('md5').update(sorted).digest('hex').slice(0, 12);
}

export async function cacheGet<T>(key: string): Promise<{ data: T; hit: boolean } | null> {
  if (!getRedisStatus()) return null;
  const client = getRedisClient();
  if (!client) return null;

  try {
    const raw = await client.get(key);
    if (raw) {
      logger.debug({ key }, 'cache_hit');
      return { data: JSON.parse(raw) as T, hit: true };
    }
    logger.debug({ key }, 'cache_miss');
    return null;
  } catch (err) {
    logger.warn({ err, key }, 'cache_get_error');
    return null;
  }
}

export async function cacheSet(key: string, data: unknown): Promise<void> {
  if (!getRedisStatus()) return;
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.setex(key, jitteredTtl(), JSON.stringify(data));
  } catch (err) {
    logger.warn({ err, key }, 'cache_set_error');
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!getRedisStatus()) return;
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.del(key);
  } catch (err) {
    logger.warn({ err, key }, 'cache_del_error');
  }
}

/**
 * Invalidate all keys matching a prefix using SCAN (never KEYS).
 */
export async function cacheDelByPrefix(prefix: string): Promise<void> {
  if (!getRedisStatus()) return;
  const client = getRedisClient();
  if (!client) return;

  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } while (cursor !== '0');
    logger.debug({ prefix }, 'cache_invalidated_by_prefix');
  } catch (err) {
    logger.warn({ err, prefix }, 'cache_del_prefix_error');
  }
}
