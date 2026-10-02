/**
 * Uniform response helpers.
 * success: { success: true, data, pagination? }
 * error:   { success: false, error: { code, message } }
 */
import { Response } from 'express';
import { PaginationMeta } from './pagination';

export function successResponse<T>(res: Response, data: T, statusCode = 200, pagination?: PaginationMeta): void {
  const body: Record<string, unknown> = { success: true, data };
  if (pagination) body.pagination = pagination;
  res.status(statusCode).json(body);
}
