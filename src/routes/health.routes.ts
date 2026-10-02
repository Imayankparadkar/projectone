import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { getRedisClient, getRedisStatus } from '../config/redis';

const router = Router();

// Basic liveness check
router.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness check: verifies DB and Redis connectivity
router.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {};

  // Check PostgreSQL
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  // Check Redis (only if enabled)
  if (getRedisStatus()) {
    try {
      const client = getRedisClient();
      if (client) {
        await client.ping();
        checks.redis = 'ok';
      } else {
        checks.redis = 'not_connected';
      }
    } catch {
      checks.redis = 'error';
    }
  } else {
    checks.redis = 'disabled';
  }

  const allOk = checks.database === 'ok' && (checks.redis === 'ok' || checks.redis === 'disabled');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});

export default router;
