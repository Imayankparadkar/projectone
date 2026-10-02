import { describe, it, expect } from 'vitest';
import { parsePagination, buildPaginationMeta } from '../../src/utils/pagination';

describe('Pagination Utility', () => {
  it('parses empty input with defaults', () => {
    const res = parsePagination({});
    expect(res).toEqual({ skip: 0, take: 20, page: 1, limit: 20 });
  });

  it('respects provided page and limit', () => {
    const res = parsePagination({ page: 3, limit: 10 });
    expect(res).toEqual({ skip: 20, take: 10, page: 3, limit: 10 });
  });

  it('caps limit at 100', () => {
    const res = parsePagination({ limit: 500 });
    expect(res.take).toBe(100);
    expect(res.limit).toBe(100);
  });

  it('builds pagination metadata', () => {
    const meta = buildPaginationMeta(2, 10, 25);
    expect(meta).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
  });
  
  it('builds metadata for empty results', () => {
    const meta = buildPaginationMeta(1, 10, 0);
    expect(meta).toEqual({ page: 1, limit: 10, total: 0, totalPages: 1 });
  });
});
