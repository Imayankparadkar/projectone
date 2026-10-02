import { prisma } from '../config/prisma';
import { NotFoundError } from '../utils/errors';
import { parsePagination, buildPaginationMeta, PaginationInput } from '../utils/pagination';
import { cacheGet, cacheSet, cacheDelByPrefix, hashFilters } from './cache.service';
import { Prisma } from '@prisma/client';

const CACHE_PREFIX = 'v1:centres';

interface ListCentresInput extends PaginationInput {
  location?: string;
  search?: string;
}

export async function listCentres(input: ListCentresInput) {
  const { skip, take, page, limit } = parsePagination(input);

  // Build cache key
  const cacheKey = `${CACHE_PREFIX}:list:${page}:${limit}:${hashFilters({ location: input.location, search: input.search })}`;
  const cached = await cacheGet<{ data: unknown; total: number }>(cacheKey);
  if (cached) return { ...(cached.data as any), cacheHit: true };

  const where: Prisma.DiagnosticCentreWhereInput = {};
  if (input.location) {
    where.location = { contains: input.location, mode: 'insensitive' };
  }
  if (input.search) {
    where.OR = [
      { name: { contains: input.search, mode: 'insensitive' } },
      { location: { contains: input.search, mode: 'insensitive' } },
    ];
  }

  const [centres, total] = await Promise.all([
    prisma.diagnosticCentre.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.diagnosticCentre.count({ where }),
  ]);

  const pagination = buildPaginationMeta(page, limit, total);
  const result = { centres, pagination };

  await cacheSet(cacheKey, { data: result, total });

  return { ...result, cacheHit: false };
}

export async function getCentreById(id: string) {
  const cacheKey = `${CACHE_PREFIX}:${id}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return { centre: cached.data, cacheHit: true };

  const centre = await prisma.diagnosticCentre.findUnique({ where: { id } });
  if (!centre) throw new NotFoundError('Centre not found');

  await cacheSet(cacheKey, centre);
  return { centre, cacheHit: false };
}

export async function createCentre(data: { name: string; location: string }) {
  const centre = await prisma.diagnosticCentre.create({ data });
  await cacheDelByPrefix(CACHE_PREFIX);
  return centre;
}

export async function updateCentre(id: string, data: { name?: string; location?: string }) {
  const centre = await prisma.diagnosticCentre.findUnique({ where: { id } });
  if (!centre) throw new NotFoundError('Centre not found');

  const updated = await prisma.diagnosticCentre.update({ where: { id }, data });
  await cacheDelByPrefix(CACHE_PREFIX);
  return updated;
}

export async function deleteCentre(id: string) {
  const centre = await prisma.diagnosticCentre.findUnique({
    where: { id },
    include: { centreTests: { include: { bookings: { where: { status: { in: ['PENDING', 'CONFIRMED'] } } } } } },
  });
  if (!centre) throw new NotFoundError('Centre not found');

  // Check for active bookings via centre tests
  const hasActiveBookings = centre.centreTests.some((ct) => ct.bookings.length > 0);
  if (hasActiveBookings) {
    const { ConflictError: CE } = await import('../utils/errors');
    throw new CE('Cannot delete centre with active bookings');
  }

  await prisma.diagnosticCentre.delete({ where: { id } });
  await cacheDelByPrefix(CACHE_PREFIX);
}
