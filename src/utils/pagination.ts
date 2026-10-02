/**
 * Pagination helper. Returns offset, limit, and metadata for list responses.
 */

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function parsePagination(input: PaginationInput): { skip: number; take: number; page: number; limit: number } {
  const page = Math.max(1, input.page || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, input.limit || DEFAULT_LIMIT));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
