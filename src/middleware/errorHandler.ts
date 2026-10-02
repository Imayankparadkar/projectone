import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { env } from '../config/env';

/**
 * Uniform error response shape: { success: false, error: { code, message } }
 */
function errorResponse(res: Response, statusCode: number, code: string, message: string): void {
  res.status(statusCode).json({
    success: false,
    error: { code, message },
  });
}

/**
 * Central error handling middleware.
 * Maps known error types to consistent HTTP responses.
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId || 'unknown';

  // Zod validation errors → 422
  if (err instanceof ZodError || err.name === 'ZodError') {
    const zodErr = err as any;
    const issues = zodErr.errors || zodErr.issues || [];
    const messages = issues.map((e: any) => `${e.path?.join('.') || 'field'}: ${e.message}`).join('; ');
    errorResponse(res, 422, 'VALIDATION_ERROR', messages);
    return;
  }

  // Our own application errors
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error({ err, requestId }, 'non_operational_error');
    }
    errorResponse(res, err.statusCode, err.code, err.message);
    return;
  }

  // Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        // Unique constraint violation
        const target = (err.meta?.target as string[])?.join(', ') || 'field';
        errorResponse(res, 409, 'CONFLICT', `Duplicate value for: ${target}`);
        return;
      }
      case 'P2025': {
        // Record not found
        errorResponse(res, 404, 'NOT_FOUND', 'Resource not found');
        return;
      }
      case 'P2003': {
        // Foreign key constraint failed
        errorResponse(res, 409, 'CONFLICT', 'Cannot delete: resource is referenced by other records');
        return;
      }
      default:
        break;
    }
  }

  // Unknown errors — hide internals in production
  logger.error({ err, requestId }, 'unhandled_error');
  const message = env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  errorResponse(res, 500, 'INTERNAL_ERROR', message);
}
