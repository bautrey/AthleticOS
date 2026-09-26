// backend/src/modules/schools/routes.test.ts
//
// Uses a real database per the NO MOCKS policy.
//
// These exist because updating a school was impossible through the API and nothing
// caught it. The role check resolves a school from params.schoolId or
// params.seasonId (auth.ts:25); these routes named theirs ":id", so requireRole
// threw ForbiddenError before it ever looked at the caller's role. PATCH and DELETE
// returned 403 to everyone, an ADMIN of that very school included.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import { prisma } from '../../common/db.js';
import { config } from '../../config.js';
import { AppError } from '../../common/errors.js';
import { schoolsRoutes } from './routes.js';

let app: FastifyInstance;
let schoolId: string;
let adminToken: string;
let athleteToken: string;

async function makeUser(role: 'ADMIN' | 'ATHLETE'): Promise<string> {
  const user = await prisma.user.create({
    data: { email: `schools-routes-${role}-${Date.now()}@test.com`, passwordHash: 'x' },
  });
  await prisma.schoolUser.create({ data: { schoolId, userId: user.id, role } });
  return app.jwt.sign({ userId: user.id });
}

describe('schools routes', () => {
  beforeAll(async () => {
    await prisma.$connect();

    app = Fastify();
    await app.register(jwt, { secret: config.JWT_SECRET });
    app.setErrorHandler((error, _request, reply) => {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: { message: error.message } });
      }
      return reply.status(500).send({ error: { message: 'boom' } });
    });
    await app.register(schoolsRoutes);
    await app.ready();

    const school = await prisma.school.create({
      data: { name: `Schools Routes Test ${Date.now()}`, timezone: 'America/Chicago' },
    });
    schoolId = school.id;

    adminToken = await makeUser('ADMIN');
    athleteToken = await makeUser('ATHLETE');
  });

  afterAll(async () => {
    const members = await prisma.schoolUser.findMany({ where: { schoolId } });
    await prisma.schoolUser.deleteMany({ where: { schoolId } });
    await prisma.user.deleteMany({ where: { id: { in: members.map((m) => m.userId) } } });
    await prisma.school.deleteMany({ where: { id: schoolId } });
    await app.close();
    await prisma.$disconnect();
  });

  it('lets an admin update the school', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/schools/${schoolId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Renamed By Admin' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Renamed By Admin');
  });

  it('saves the weather policy and reads it back', async () => {
    const weather = {
      thresholdF: 82,
      measure: 'WBGT',
      lookaheadDays: 3,
      practiceWindow: { start: '15:00', end: '18:30' },
    };
    const saved = await app.inject({
      method: 'PATCH',
      url: `/schools/${schoolId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { settings: { weather }, latitude: 32.9668, longitude: -96.8236 },
    });
    expect(saved.statusCode).toBe(200);

    const read = await app.inject({
      method: 'GET',
      url: `/schools/${schoolId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(read.statusCode).toBe(200);
    expect(read.json().data).toMatchObject({ latitude: 32.9668, longitude: -96.8236 });
    expect(read.json().data.settings.weather).toMatchObject(weather);
  });

  it('clears the cached gridpoint when the school moves', async () => {
    // The gridpoint is NWS's answer for a specific place. Keeping it after the
    // coordinates change would forecast for where the school used to be.
    await prisma.school.update({
      where: { id: schoolId },
      data: { weatherGridpoint: 'FWD/88,112' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/schools/${schoolId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { latitude: 41.8781, longitude: -87.6298 },
    });
    const after = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
    expect(after.weatherGridpoint).toBeNull();
  });

  it('rejects a weather policy it cannot act on, rather than storing it', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/schools/${schoolId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { settings: { weather: { thresholdF: 'very hot' } } },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);

    const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
    expect((school.settings as { weather?: { thresholdF?: unknown } }).weather?.thresholdF).not.toBe(
      'very hot'
    );
  });

  it('NEVER returns the inbound mailbox token in a school payload', async () => {
    // The token is a bearer credential for the school's import mailbox: whoever
    // holds it can mail a file into that school's review queue from anywhere,
    // through the one path with no session. The endpoint that reveals it is
    // gated to MANAGEMENT, so the ordinary school payload must not hand it to
    // every coach, parent and athlete.
    await prisma.school.update({
      where: { id: schoolId },
      data: { inboundToken: 'abcdefghjkmnpqrstvwx' },
    });

    for (const token of [adminToken, athleteToken]) {
      const one = await app.inject({
        method: 'GET',
        url: `/schools/${schoolId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(one.statusCode).toBe(200);
      expect(one.body).not.toContain('abcdefghjkmnpqrstvwx');
      expect(one.json().data).not.toHaveProperty('inboundToken');

      const many = await app.inject({
        method: 'GET',
        url: '/schools',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(many.body).not.toContain('abcdefghjkmnpqrstvwx');
    }

    // And the field still round-trips on a write, so this is a response filter
    // rather than the column having been lost.
    const stored = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
    expect(stored.inboundToken).toBe('abcdefghjkmnpqrstvwx');
  });

  it('still refuses a member who is not management', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/schools/${schoolId}`,
      headers: { authorization: `Bearer ${athleteToken}` },
      payload: { name: 'Renamed By Athlete' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('leaves DELETE unreachable, as it has always been', async () => {
    // Renaming this route's param alongside PATCH would have switched on a hard
    // delete cascading across 11 relations, for the first time and without
    // anyone deciding to. It stays on ':id' so requireRole cannot resolve a
    // school and answers 403 to everyone, exactly as before. Issue #14 decides
    // whether a school should be deletable at all.
    const res = await app.inject({
      method: 'DELETE',
      url: `/schools/${schoolId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(403);

    // And the school is still there.
    expect(await prisma.school.findUnique({ where: { id: schoolId } })).not.toBeNull();
  });

  it('refuses an unauthenticated caller', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/schools/${schoolId}`, payload: {} });
    expect(res.statusCode).toBe(401);
  });
});
