import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { request, clearDatabase } from './setup';
import { prisma } from '../../src/config/prisma';

describe('Auth API', () => {
  beforeEach(async () => {
    await clearDatabase();
  });
  
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const validUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
  };

  describe('POST /api/v1/auth/signup', () => {
    it('creates a new user', async () => {
      const res = await request.post('/api/v1/auth/signup').send(validUser);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(validUser.email);
      expect(res.body.data.token).toBeDefined();
    });

    it('prevents duplicate emails', async () => {
      await request.post('/api/v1/auth/signup').send(validUser);
      const res = await request.post('/api/v1/auth/signup').send({
        name: 'Another Name',
        email: 'TEST@example.com', // Case variant
        password: 'password123',
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('validates weak passwords', async () => {
      const res = await request.post('/api/v1/auth/signup').send({
        ...validUser,
        password: 'weak',
      });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request.post('/api/v1/auth/signup').send(validUser);
    });

    it('logs in with correct credentials', async () => {
      const res = await request.post('/api/v1/auth/login').send({
        email: validUser.email,
        password: validUser.password,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
    });

    it('rejects incorrect password', async () => {
      const res = await request.post('/api/v1/auth/login').send({
        email: validUser.email,
        password: 'wrongpassword',
      });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
