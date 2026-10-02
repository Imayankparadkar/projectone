import { prisma } from '../config/prisma';
import { NotFoundError, ConflictError } from '../utils/errors';
import { parsePagination, buildPaginationMeta, PaginationInput } from '../utils/pagination';
import { cacheGet, cacheSet, cacheDelByPrefix, hashFilters } from './cache.service';
import { Prisma } from '@prisma/client';

const TEST_CACHE_PREFIX = 'v1:tests';
const CENTRE_TEST_CACHE_PREFIX = 'v1:centre-tests';

// ── Diagnostic Tests ──

interface ListTestsInput extends PaginationInput {
  search?: string;
}

export async function listTests(input: ListTestsInput) {
  const { skip, take, page, limit } = parsePagination(input);

  const cacheKey = `${TEST_CACHE_PREFIX}:list:${page}:${limit}:${hashFilters({ search: input.search })}`;
  const cached = await cacheGet<{ data: unknown }>(cacheKey);
  if (cached) return { ...(cached.data as any), cacheHit: true };

  const where: Prisma.DiagnosticTestWhereInput = {};
  if (input.search) {
    where.OR = [
      { name: { contains: input.search, mode: 'insensitive' } },
      { code: { contains: input.search, mode: 'insensitive' } },
    ];
  }

  const [tests, total] = await Promise.all([
    prisma.diagnosticTest.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.diagnosticTest.count({ where }),
  ]);

  const pagination = buildPaginationMeta(page, limit, total);
  const result = { tests, pagination };
  await cacheSet(cacheKey, { data: result });

  return { ...result, cacheHit: false };
}

export async function getTestById(id: string) {
  const cacheKey = `${TEST_CACHE_PREFIX}:${id}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return { test: cached.data, cacheHit: true };

  const test = await prisma.diagnosticTest.findUnique({ where: { id } });
  if (!test) throw new NotFoundError('Test not found');

  await cacheSet(cacheKey, test);
  return { test, cacheHit: false };
}

export async function createTest(data: { name: string; code: string; description?: string }) {
  const test = await prisma.diagnosticTest.create({ data });
  await cacheDelByPrefix(TEST_CACHE_PREFIX);
  return test;
}

export async function updateTest(id: string, data: { name?: string; code?: string; description?: string }) {
  const test = await prisma.diagnosticTest.findUnique({ where: { id } });
  if (!test) throw new NotFoundError('Test not found');

  const updated = await prisma.diagnosticTest.update({ where: { id }, data });
  await cacheDelByPrefix(TEST_CACHE_PREFIX);
  await cacheDelByPrefix(CENTRE_TEST_CACHE_PREFIX);
  return updated;
}

export async function deleteTest(id: string) {
  const test = await prisma.diagnosticTest.findUnique({
    where: { id },
    include: { centreTests: { include: { bookings: { where: { status: { in: ['PENDING', 'CONFIRMED'] } } } } } },
  });
  if (!test) throw new NotFoundError('Test not found');

  const hasActiveBookings = test.centreTests.some((ct) => ct.bookings.length > 0);
  if (hasActiveBookings) throw new ConflictError('Cannot delete test with active bookings');

  await prisma.diagnosticTest.delete({ where: { id } });
  await cacheDelByPrefix(TEST_CACHE_PREFIX);
  await cacheDelByPrefix(CENTRE_TEST_CACHE_PREFIX);
}

// ── Centre-Test Associations ──

export async function listCentreTests(centreId: string, input: PaginationInput) {
  const { skip, take, page, limit } = parsePagination(input);

  const cacheKey = `${CENTRE_TEST_CACHE_PREFIX}:${centreId}:${page}:${limit}`;
  const cached = await cacheGet<{ data: unknown }>(cacheKey);
  if (cached) return { ...(cached.data as any), cacheHit: true };

  const centre = await prisma.diagnosticCentre.findUnique({ where: { id: centreId } });
  if (!centre) throw new NotFoundError('Centre not found');

  const where = { centreId };
  const [centreTests, total] = await Promise.all([
    prisma.centreTest.findMany({
      where,
      skip,
      take,
      include: { test: true },
      orderBy: { test: { name: 'asc' } },
    }),
    prisma.centreTest.count({ where }),
  ]);

  const pagination = buildPaginationMeta(page, limit, total);
  const result = { centreTests, pagination };
  await cacheSet(cacheKey, { data: result });

  return { ...result, cacheHit: false };
}

export async function addCentreTest(centreId: string, testId: string, price: number) {
  // Verify both exist
  const [centre, test] = await Promise.all([
    prisma.diagnosticCentre.findUnique({ where: { id: centreId } }),
    prisma.diagnosticTest.findUnique({ where: { id: testId } }),
  ]);
  if (!centre) throw new NotFoundError('Centre not found');
  if (!test) throw new NotFoundError('Test not found');

  const centreTest = await prisma.centreTest.create({
    data: { centreId, testId, price },
    include: { test: true },
  });

  await cacheDelByPrefix(CENTRE_TEST_CACHE_PREFIX);
  return centreTest;
}

export async function updateCentreTest(centreId: string, testId: string, price: number) {
  const centreTest = await prisma.centreTest.findUnique({
    where: { centreId_testId: { centreId, testId } },
  });
  if (!centreTest) throw new NotFoundError('Centre-test association not found');

  const updated = await prisma.centreTest.update({
    where: { id: centreTest.id },
    data: { price },
    include: { test: true },
  });

  await cacheDelByPrefix(CENTRE_TEST_CACHE_PREFIX);
  return updated;
}

export async function deleteCentreTest(centreId: string, testId: string) {
  const centreTest = await prisma.centreTest.findUnique({
    where: { centreId_testId: { centreId, testId } },
    include: { bookings: { where: { status: { in: ['PENDING', 'CONFIRMED'] } } } },
  });
  if (!centreTest) throw new NotFoundError('Centre-test association not found');

  if (centreTest.bookings.length > 0) {
    throw new ConflictError('Cannot delete centre-test association with active bookings');
  }

  await prisma.centreTest.delete({ where: { id: centreTest.id } });
  await cacheDelByPrefix(CENTRE_TEST_CACHE_PREFIX);
}
