// backend/src/modules/practices/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole, STAFF, ALL_INTERNAL } from '../../common/middleware/auth.js';
import { createPracticeSchema, updatePracticeSchema } from './schemas.js';
import { practicesService } from './service.js';
import { conflictService } from '../conflicts/service.js';
import { notificationService } from '../notifications/service.js';
import { prisma } from '../../common/db.js';

export async function practicesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // List practices for season
  app.get('/seasons/:seasonId/practices', {
    preHandler: [requireRole(...ALL_INTERNAL)],
  }, async (request) => {
    const { seasonId } = request.params as { seasonId: string };
    const practices = await practicesService.findBySeason(seasonId);
    return { data: practices };
  });

  // Create practice
  app.post('/seasons/:seasonId/practices', {
    preHandler: [requireRole(...STAFF)],
  }, async (request, reply) => {
    const { seasonId } = request.params as { seasonId: string };
    const input = createPracticeSchema.parse(request.body);
    const practice = await practicesService.create(seasonId, input);

    // Check for conflicts
    const conflictResult = await conflictService.checkEventConflicts({
      datetime: practice.datetime,
      durationMinutes: practice.durationMinutes,
      seasonId: practice.seasonId,
      facilityId: practice.facilityId,
    });

    // Fire-and-forget notification
    const season = await prisma.season.findUnique({ where: { id: seasonId }, select: { team: { select: { schoolId: true } } } });
    if (season) {
      notificationService.emit({ trigger: 'SCHEDULE_CHANGE', schoolId: season.team.schoolId, eventType: 'PRACTICE', eventId: practice.id }).catch(err => request.log.error(err));
    }

    return reply.status(201).send({
      data: practice,
      meta: {
        conflicts: conflictResult.conflicts,
        hasConflicts: conflictResult.hasConflicts,
      },
    });
  });

  // Get practice by ID
  app.get('/practices/:id', async (request) => {
    const { id } = request.params as { id: string };
    const practice = await practicesService.findById(id);
    return { data: practice };
  });

  // Update practice
  app.patch('/practices/:id', async (request) => {
    const { id } = request.params as { id: string };
    const input = updatePracticeSchema.parse(request.body);
    const practice = await practicesService.update(id, input);

    // Check for conflicts after update
    const conflictResult = await conflictService.checkEventConflicts({
      datetime: practice.datetime,
      durationMinutes: practice.durationMinutes,
      seasonId: practice.seasonId,
      facilityId: practice.facilityId,
    });

    // Fire-and-forget notification
    const season = await prisma.season.findUnique({ where: { id: practice.seasonId }, select: { team: { select: { schoolId: true } } } });
    if (season) {
      notificationService.emit({ trigger: 'SCHEDULE_CHANGE', schoolId: season.team.schoolId, eventType: 'PRACTICE', eventId: practice.id, changes: input as Record<string, unknown> }).catch(err => request.log.error(err));
    }

    return {
      data: practice,
      meta: {
        conflicts: conflictResult.conflicts,
        hasConflicts: conflictResult.hasConflicts,
      },
    };
  });

  // Delete practice
  app.delete('/practices/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const practice = await practicesService.findById(id);
    const season = await prisma.season.findUnique({ where: { id: practice.seasonId }, select: { team: { select: { schoolId: true } } } });
    await practicesService.delete(id);
    if (season) {
      notificationService.emit({ trigger: 'SCHEDULE_CHANGE', schoolId: season.team.schoolId, eventType: 'PRACTICE', eventId: id }).catch(err => request.log.error(err));
    }
    return reply.status(204).send();
  });
}
