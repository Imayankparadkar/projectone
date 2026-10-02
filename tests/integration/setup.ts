import { vitest } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/config/prisma';

export const request = supertest(app);

// Mock Redis to prevent real connection attempts during tests
vitest.mock('../../src/config/redis', () => ({
  getRedisClient: vitest.fn(() => null),
  getRedisStatus: vitest.fn(() => false),
  connectRedis: vitest.fn(async () => null),
  disconnectRedis: vitest.fn(async () => {}),
}));

export async function clearDatabase() {
  // Order matters due to foreign keys
  await prisma.webhookInbox.deleteMany();
  await prisma.paymentEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.centreTest.deleteMany();
  await prisma.diagnosticTest.deleteMany();
  await prisma.diagnosticCentre.deleteMany();
  await prisma.user.deleteMany();
}
