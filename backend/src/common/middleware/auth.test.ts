// backend/src/common/middleware/auth.test.ts
// Integration tests for the auth middleware (JWT verification + role checks).
// Uses real DB and a real Fastify instance per NO MOCKS policy.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import { prisma } from '../db.js';
import { config } from '../../config.js';
import { AppError } from '../errors.js';
import { authenticate, requireRole, requireInternalRole } from './auth.js';
import { Role } from '@prisma/client';

const EMAIL_NS = `mw-auth-${Date.now()}`;

let app: FastifyInstance;
let schoolId: string;
let otherSchoolId: string;
let teamId: string;
let seasonId: string;

let adminUserId: string;
let adminToken: string;
let coachUserId: string;
let coachToken: string;
let parentUserId: string;
let parentToken: string;
let outsiderUserId: string;
let outsiderToken: string;

describe('auth middleware', () => {
  beforeAll(async () => {
    await prisma.$connect();

    app = Fastify({ logger: false });
    app.setErrorHandler((error, _req, reply) => {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          error: { code: error.code, message: error.message },
        });
      }
      return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: 'oops' } });
    });
    await app.register(jwt, { secret: config.JWT_SECRET });

    // Public route — gated by authenticate() only.
    app.get(
      '/me',
      { preHandler: [authenticate] },
      async (req) => ({ userId: (req.user as { userId: string }).userId })
    );

    // School-scoped route — gated by requireRole.
    app.get(
      '/schools/:schoolId/staff-only',
      { preHandler: [authenticate, requireRole(Role.ADMIN, Role.ATHLETIC_DIRECTOR, Role.COACH)] },
      async (req) => ({ schoolUser: (req as { schoolUser?: unknown }).schoolUser })
    );

    // Season-scoped route — schoolId is resolved via season → team → school.
    app.get(
      '/seasons/:seasonId/staff-only',
      { preHandler: [authenticate, requireRole(Role.ADMIN, Role.COACH)] },
      async () => ({ ok: true })
    );

    // Route with neither :schoolId nor :seasonId — should be a server bug.
    app.get(
      '/no-school-param',
      { preHandler: [authenticate, requireRole(Role.ADMIN)] },
      async () => ({ ok: true })
    );

    // User-scoped route — gated by requireInternalRole (any school).
    app.get(
      '/internal-only',
      { preHandler: [authenticate, requireInternalRole()] },
      async () => ({ ok: true })
    );

    await app.ready();

    // Schools
    const school = await prisma.school.create({
      data: { name: 'MW Test School', timezone: 'America/New_York' },
    });
    schoolId = school.id;
    const other = await prisma.school.create({
      data: { name: 'Other School', timezone: 'America/New_York' },
    });
    otherSchoolId = other.id;

    // Team + season (for seasonId → schoolId resolution)
    const team = await prisma.team.create({
      data: { schoolId, name: 'MW Team', sport: 'Basketball', level: 'VARSITY' },
    });
    teamId = team.id;
    const season = await prisma.season.create({
      data: {
        teamId,
        name: 'MW Season 2026',
        year: 2026,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    });
    seasonId = season.id;

    // Users: admin, coach, parent, outsider (no membership at schoolId)
    const admin = await prisma.user.create({
      data: { email: `${EMAIL_NS}-admin@test.com`, passwordHash: 'x' },
    });
    adminUserId = admin.id;
    await prisma.schoolUser.create({
      data: { userId: admin.id, schoolId, role: Role.ADMIN },
    });
    adminToken = app.jwt.sign({ userId: admin.id });

    const coach = await prisma.user.create({
      data: { email: `${EMAIL_NS}-coach@test.com`, passwordHash: 'x' },
    });
    coachUserId = coach.id;
    await prisma.schoolUser.create({
      data: { userId: coach.id, schoolId, role: Role.COACH },
    });
    coachToken = app.jwt.sign({ userId: coach.id });

    const parent = await prisma.user.create({
      data: { email: `${EMAIL_NS}-parent@test.com`, passwordHash: 'x' },
    });
    parentUserId = parent.id;
    await prisma.schoolUser.create({
      data: { userId: parent.id, schoolId, role: Role.PARENT },
    });
    parentToken = app.jwt.sign({ userId: parent.id });

    const outsider = await prisma.user.create({
      data: { email: `${EMAIL_NS}-outsider@test.com`, passwordHash: 'x' },
    });
    outsiderUserId = outsider.id;
    // Outsider has membership at otherSchoolId (so requireInternalRole at any school passes)
    await prisma.schoolUser.create({
      data: { userId: outsider.id, schoolId: otherSchoolId, role: Role.COMMUNITY },
    });
    outsiderToken = app.jwt.sign({ userId: outsider.id });
  });

  afterAll(async () => {
    await prisma.season.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { schoolId } });
    await prisma.schoolUser.deleteMany({
      where: { schoolId: { in: [schoolId, otherSchoolId] } },
    });
    await prisma.school.deleteMany({ where: { id: { in: [schoolId, otherSchoolId] } } });
    await prisma.user.deleteMany({
      where: { email: { startsWith: EMAIL_NS } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  describe('authenticate', () => {
    it('401s when Authorization header is missing', async () => {
      const res = await app.inject({ method: 'GET', url: '/me' });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('UNAUTHORIZED');
    });

    it('401s when Authorization header has wrong scheme', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/me',
        headers: { authorization: `Basic ${adminToken}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('401s when bearer token is malformed', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/me',
        headers: { authorization: 'Bearer not-a-real-jwt' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('401s when token signature is invalid (signed with a different key)', async () => {
      // Build a token with a different secret — should fail verify against config.JWT_SECRET.
      const otherApp = Fastify({ logger: false });
      await otherApp.register(jwt, { secret: 'a-completely-different-secret-key-here' });
      await otherApp.ready();
      const tampered = otherApp.jwt.sign({ userId: adminUserId });
      await otherApp.close();

      const res = await app.inject({
        method: 'GET',
        url: '/me',
        headers: { authorization: `Bearer ${tampered}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('401s when token is expired', async () => {
      // Sign with an `exp` claim in the past to bypass the signer's positive-only expiresIn guard.
      const pastExp = Math.floor(Date.now() / 1000) - 60;
      const expired = app.jwt.sign({ userId: adminUserId, exp: pastExp });
      const res = await app.inject({
        method: 'GET',
        url: '/me',
        headers: { authorization: `Bearer ${expired}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('passes through with a valid token and exposes userId on request', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/me',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ userId: adminUserId });
    });
  });

  describe('requireRole (schoolId param)', () => {
    it('allows a user whose role is in the allowed set', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/schools/${schoolId}/staff-only`,
        headers: { authorization: `Bearer ${coachToken}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('403s a user whose role is NOT in the allowed set', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/schools/${schoolId}/staff-only`,
        headers: { authorization: `Bearer ${parentToken}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('403s a user with no membership at the school', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/schools/${schoolId}/staff-only`,
        headers: { authorization: `Bearer ${outsiderToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('does NOT grant access at one school based on a role at another', async () => {
      // outsider is COMMUNITY at otherSchoolId, nothing at schoolId.
      const res = await app.inject({
        method: 'GET',
        url: `/schools/${schoolId}/staff-only`,
        headers: { authorization: `Bearer ${outsiderToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('attaches the schoolUser record to the request', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/schools/${schoolId}/staff-only`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body = res.json();
      expect(body.schoolUser).toMatchObject({
        userId: adminUserId,
        schoolId,
        role: Role.ADMIN,
      });
    });
  });

  describe('requireRole (seasonId param)', () => {
    it('resolves schoolId via season → team → school', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/seasons/${seasonId}/staff-only`,
        headers: { authorization: `Bearer ${coachToken}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('404s when the season does not exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/seasons/00000000-0000-0000-0000-000000000000/staff-only',
        headers: { authorization: `Bearer ${coachToken}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('requireRole (no schoolId/seasonId)', () => {
    it('403s with a clear server-config message', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/no-school-param',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.message).toMatch(/schoolId or seasonId/i);
    });
  });

  describe('requireInternalRole', () => {
    it('allows a user with an internal role at any school', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/internal-only',
        headers: { authorization: `Bearer ${coachToken}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('allows a PARENT (internal) at their school', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/internal-only',
        headers: { authorization: `Bearer ${parentToken}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('403s a COMMUNITY-only user (no internal role anywhere)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/internal-only',
        headers: { authorization: `Bearer ${outsiderToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('401s before reaching the role check when no token is supplied', async () => {
      const res = await app.inject({ method: 'GET', url: '/internal-only' });
      expect(res.statusCode).toBe(401);
    });
  });

  // Reference these so TS doesn't complain about unused vars when test bodies grow.
  it('test setup created all expected users', () => {
    expect(adminUserId && coachUserId && parentUserId && outsiderUserId).toBeTruthy();
  });
});
