// backend/src/modules/conflicts/routes.test.ts
// Integration tests using real database per NO MOCKS policy.
//
// Covers the response contract of GET /schools/:schoolId/conflicts, specifically
// the `types` parameter. The frontend reads `facilityConflicts` off this response,
// so its presence and shape is an API contract, not an implementation detail.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import { prisma } from '../../common/db.js';
import { conflictsRoutes } from './routes.js';
import { config } from '../../config.js';
import { AppError } from '../../common/errors.js';
import { ZodError } from 'zod';

let app: FastifyInstance;
let schoolId: string;
let userId: string;
let fieldId: string;
let seasonAId: string;
let seasonBId: string;
let authToken: string;

async function get(url: string) {
  return app.inject({
    method: 'GET',
    url,
    headers: { authorization: `Bearer ${authToken}` },
  });
}

describe('GET /schools/:schoolId/conflicts', () => {
  beforeAll(async () => {
    await prisma.$connect();

    app = Fastify({ logger: false });
    app.setErrorHandler((error, _request, reply) => {
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
    await app.register(conflictsRoutes);

    const user = await prisma.user.create({
      data: { email: `conflicts-routes-${Date.now()}@test.com`, passwordHash: 'test-hash' },
    });
    userId = user.id;

    const school = await prisma.school.create({
      data: { name: 'Conflicts Routes Test School', timezone: 'America/Chicago' },
    });
    schoolId = school.id;

    await prisma.schoolUser.create({ data: { schoolId, userId, role: 'ADMIN' } });

    const field = await prisma.facility.create({
      data: { schoolId, name: 'Shared Field', type: 'FIELD' },
    });
    fieldId = field.id;

    for (const name of ['Alpha', 'Beta']) {
      const team = await prisma.team.create({
        data: { schoolId, name, sport: 'Soccer', level: 'VARSITY' },
      });
      const season = await prisma.season.create({
        data: {
          teamId: team.id,
          name: `${name} 2026`,
          year: 2026,
          startDate: new Date(Date.now() - 86400000),
          endDate: new Date(Date.now() + 200 * 86400000),
        },
      });
      if (name === 'Alpha') seasonAId = season.id;
      else seasonBId = season.id;
    }

    authToken = app.jwt.sign({ userId });
  });

  beforeEach(async () => {
    await prisma.practice.deleteMany({ where: { season: { team: { schoolId } } } });
  });

  afterAll(async () => {
    await prisma.practice.deleteMany({ where: { season: { team: { schoolId } } } });
    await prisma.season.deleteMany({ where: { team: { schoolId } } });
    await prisma.team.deleteMany({ where: { schoolId } });
    await prisma.facility.deleteMany({ where: { schoolId } });
    await prisma.notification.deleteMany({ where: { schoolId } });
    await prisma.schoolUser.deleteMany({ where: { schoolId } });
    await prisma.school.delete({ where: { id: schoolId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
    await app.close();
  });

  /** Two teams on the shared field, overlapping by 30 minutes, a week out. */
  async function seedDoubleBooking() {
    const base = new Date(Date.now() + 7 * 86400000);
    base.setUTCHours(21, 0, 0, 0);
    await prisma.practice.create({
      data: { seasonId: seasonAId, facilityId: fieldId, datetime: base, durationMinutes: 90 },
    });
    await prisma.practice.create({
      data: {
        seasonId: seasonBId,
        facilityId: fieldId,
        datetime: new Date(base.getTime() + 60 * 60000),
        durationMinutes: 60,
      },
    });
  }

  it('returns facility double-bookings by default, without the caller asking', async () => {
    await seedDoubleBooking();

    const res = await get(`/schools/${schoolId}/conflicts`);
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(Array.isArray(body.facilityConflicts)).toBe(true);
    expect(body.facilityConflicts).toHaveLength(1);
    expect(body.facilityConflicts[0].type).toBe('FACILITY');
    expect(body.facilityConflicts[0].overlapMinutes).toBe(30);
    expect(body.summary.facilityConflictCount).toBe(1);
  });

  it('omits them entirely when the caller narrows to blockers', async () => {
    await seedDoubleBooking();

    const body = (await get(`/schools/${schoolId}/conflicts?types=blocker`)).json();
    expect(body.facilityConflicts).toBeUndefined();
    expect(body.summary.facilityConflictCount).toBeUndefined();
  });

  it('returns an empty blocker list when the caller narrows to facility', async () => {
    await seedDoubleBooking();

    // Narrowing to facility used to still return every blocker conflict in `data`,
    // which made the UI filter look like it did nothing.
    const body = (await get(`/schools/${schoolId}/conflicts?types=facility`)).json();
    expect(body.data).toEqual([]);
    expect(body.summary.total).toBe(0);
    expect(body.facilityConflicts).toHaveLength(1);
  });

  it('treats types=all as both checks', async () => {
    await seedDoubleBooking();

    const body = (await get(`/schools/${schoolId}/conflicts?types=all`)).json();
    expect(body.facilityConflicts).toHaveLength(1);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('reports no double-booking when the field is not shared', async () => {
    const base = new Date(Date.now() + 8 * 86400000);
    base.setUTCHours(21, 0, 0, 0);
    await prisma.practice.create({
      data: { seasonId: seasonAId, facilityId: fieldId, datetime: base, durationMinutes: 90 },
    });

    const body = (await get(`/schools/${schoolId}/conflicts`)).json();
    expect(body.facilityConflicts).toEqual([]);
    expect(body.summary.facilityConflictCount).toBe(0);
  });

  it('keeps pagination meta intact so the page can still render', async () => {
    await seedDoubleBooking();

    const body = (await get(`/schools/${schoolId}/conflicts`)).json();
    expect(body.meta).toMatchObject({ page: 1, limit: 25 });
    expect(typeof body.meta.total).toBe('number');
    expect(typeof body.meta.totalPages).toBe('number');
  });
});
