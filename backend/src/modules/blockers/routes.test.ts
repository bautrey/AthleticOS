// backend/src/modules/blockers/routes.test.ts
// Integration tests using real database per NO MOCKS policy
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import { prisma } from '../../common/db.js';
import { blockersRoutes } from './routes.js';
import { config } from '../../config.js';
import { AppError } from '../../common/errors.js';
import { ZodError } from 'zod';

let app: FastifyInstance;
let schoolId: string;
let teamId: string;
let facilityId: string;
let userId: string;
let authToken: string;

describe('Blockers Routes', () => {
  beforeAll(async () => {
    await prisma.$connect();

    // Create test Fastify app
    app = Fastify({ logger: false });

    // Add error handler (same as server.ts)
    app.setErrorHandler((error, request, reply) => {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          error: { code: error.code, message: error.message, details: error.details },
        });
      }
      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.flatten() },
        });
      }
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    });

    await app.register(jwt, { secret: config.JWT_SECRET });
    await app.register(blockersRoutes);

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `routes-test-${Date.now()}@test.com`,
        passwordHash: 'test-hash',
      },
    });
    userId = user.id;

    // Create test school
    const school = await prisma.school.create({
      data: {
        name: 'Routes Test School',
        timezone: 'America/New_York',
      },
    });
    schoolId = school.id;

    // Create school user association as ADMIN
    await prisma.schoolUser.create({
      data: {
        schoolId: school.id,
        userId: user.id,
        role: 'ADMIN',
      },
    });

    // Create test team
    const team = await prisma.team.create({
      data: {
        schoolId: school.id,
        name: 'Test Team',
        sport: 'Soccer',
        level: 'VARSITY',
      },
    });
    teamId = team.id;

    // Create test facility
    const facility = await prisma.facility.create({
      data: {
        schoolId: school.id,
        name: 'Test Field',
        type: 'FIELD',
      },
    });
    facilityId = facility.id;

    // Generate auth token
    authToken = app.jwt.sign({ userId });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.blocker.deleteMany({ where: { schoolId } });
    await prisma.facility.deleteMany({ where: { schoolId } });
    await prisma.team.deleteMany({ where: { schoolId } });
    await prisma.schoolUser.deleteMany({ where: { schoolId } });
    await prisma.school.delete({ where: { id: schoolId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await prisma.blocker.deleteMany({ where: { schoolId } });
  });

  describe('GET /schools/:schoolId/blockers', () => {
    it('returns empty list when no blockers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/schools/${schoolId}/blockers`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
    });

    it('returns blockers for school', async () => {
      // Create a blocker directly in DB
      await prisma.blocker.create({
        data: {
          schoolId,
          type: 'EXAM',
          name: 'Test Blocker',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-05-01T00:00:00Z'),
          endDatetime: new Date('2026-05-07T23:59:59Z'),
          createdBy: userId,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/schools/${schoolId}/blockers`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe('Test Blocker');
    });

    it('requires authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/schools/${schoolId}/blockers`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('supports query filters', async () => {
      await prisma.blocker.create({
        data: {
          schoolId,
          type: 'EXAM',
          name: 'Exam Blocker',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-03-01T00:00:00Z'),
          endDatetime: new Date('2026-03-07T23:59:59Z'),
          createdBy: userId,
        },
      });

      await prisma.blocker.create({
        data: {
          schoolId,
          type: 'HOLIDAY',
          name: 'Holiday Blocker',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-12-20T00:00:00Z'),
          endDatetime: new Date('2026-12-31T23:59:59Z'),
          createdBy: userId,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/schools/${schoolId}/blockers?type=EXAM`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].type).toBe('EXAM');
    });
  });

  describe('GET /schools/:schoolId/blockers/:id', () => {
    it('returns blocker by id', async () => {
      const blocker = await prisma.blocker.create({
        data: {
          schoolId,
          type: 'EVENT',
          name: 'Single Blocker',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-09-01T08:00:00Z'),
          endDatetime: new Date('2026-09-01T18:00:00Z'),
          createdBy: userId,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/schools/${schoolId}/blockers/${blocker.id}`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(blocker.id);
      expect(body.data.name).toBe('Single Blocker');
    });

    it('returns 404 for nonexistent blocker', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/schools/${schoolId}/blockers/nonexistent-id`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /schools/:schoolId/blockers', () => {
    it('creates a school-wide blocker', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/schools/${schoolId}/blockers`,
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        payload: {
          type: 'EXAM',
          name: 'New Blocker',
          scope: 'SCHOOL_WIDE',
          startDatetime: '2026-05-15T08:00:00Z',
          endDatetime: '2026-05-22T17:00:00Z',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe('New Blocker');
      expect(body.data.createdBy).toBe(userId);
      expect(body.meta.conflictingEvents).toBeDefined();
    });

    it('creates a team-specific blocker', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/schools/${schoolId}/blockers`,
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        payload: {
          type: 'TRAVEL',
          name: 'Team Trip',
          scope: 'TEAM',
          teamId,
          startDatetime: '2026-04-01T08:00:00Z',
          endDatetime: '2026-04-03T18:00:00Z',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.scope).toBe('TEAM');
      expect(body.data.teamId).toBe(teamId);
    });

    it('returns 400 for invalid input', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/schools/${schoolId}/blockers`,
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        payload: {
          type: 'INVALID_TYPE',
          name: 'Bad Blocker',
          scope: 'SCHOOL_WIDE',
          startDatetime: '2026-05-15T08:00:00Z',
          endDatetime: '2026-05-22T17:00:00Z',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 400 when TEAM scope missing teamId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/schools/${schoolId}/blockers`,
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        payload: {
          type: 'TRAVEL',
          name: 'Missing TeamId',
          scope: 'TEAM',
          startDatetime: '2026-04-01T08:00:00Z',
          endDatetime: '2026-04-03T18:00:00Z',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PATCH /schools/:schoolId/blockers/:id', () => {
    it('updates blocker name', async () => {
      const blocker = await prisma.blocker.create({
        data: {
          schoolId,
          type: 'EVENT',
          name: 'Original Name',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-10-01T08:00:00Z'),
          endDatetime: new Date('2026-10-01T18:00:00Z'),
          createdBy: userId,
        },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/schools/${schoolId}/blockers/${blocker.id}`,
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        payload: { name: 'Updated Name' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe('Updated Name');
    });

    it('returns 404 for nonexistent blocker', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/schools/${schoolId}/blockers/nonexistent-id`,
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        payload: { name: 'New Name' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /schools/:schoolId/blockers/:id', () => {
    it('deletes a blocker', async () => {
      const blocker = await prisma.blocker.create({
        data: {
          schoolId,
          type: 'CUSTOM',
          name: 'To Delete',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-08-01T08:00:00Z'),
          endDatetime: new Date('2026-08-01T18:00:00Z'),
          createdBy: userId,
        },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/schools/${schoolId}/blockers/${blocker.id}`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(204);

      // Verify deleted
      const deleted = await prisma.blocker.findUnique({
        where: { id: blocker.id },
      });
      expect(deleted).toBeNull();
    });

    it('returns 404 for nonexistent blocker', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/schools/${schoolId}/blockers/nonexistent-id`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
