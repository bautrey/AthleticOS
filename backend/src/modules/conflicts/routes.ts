// backend/src/modules/conflicts/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole, ALL_INTERNAL } from '../../common/middleware/auth.js';
import { prisma } from '../../common/db.js';
import { createOverrideSchema, conflictsListQueryWithSuggestionsSchema, batchOverrideSchema } from './schemas.js';
import { conflictService } from './service.js';

export async function conflictsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Get conflicts for a specific game
  app.get('/games/:id/conflicts', async (request) => {
    const { id } = request.params as { id: string };
    const result = await conflictService.checkGameConflicts(id);
    return { data: result };
  });

  // Get conflicts for a specific practice
  app.get('/practices/:id/conflicts', async (request) => {
    const { id } = request.params as { id: string };
    const result = await conflictService.checkPracticeConflicts(id);
    return { data: result };
  });

  // Get conflict summary for a season
  app.get('/seasons/:seasonId/conflicts', async (request) => {
    const { seasonId } = request.params as { seasonId: string };
    const result = await conflictService.getSeasonConflictSummary(seasonId);
    return { data: result };
  });

  // Get events affected by a specific blocker
  app.get('/blockers/:id/affected-events', async (request) => {
    const { id } = request.params as { id: string };
    const result = await conflictService.findConflictingEvents(id);
    return { data: result };
  });

  // List all conflicts for a school (paginated, for triage page)
  app.get('/schools/:schoolId/conflicts', {
    preHandler: [requireRole(...ALL_INTERNAL)],
  }, async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const query = conflictsListQueryWithSuggestionsSchema.parse(request.query);
    const result = await conflictService.listAllConflicts(schoolId, query);
    return result;
  });

  // Get school-wide conflict summary (dashboard)
  app.get('/schools/:schoolId/conflict-summary', {
    preHandler: [requireRole(...ALL_INTERNAL)],
  }, async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const result = await conflictService.getSchoolConflictSummary(schoolId);
    return { data: result };
  });

  // Batch override multiple conflicts
  app.post('/conflicts/batch-override', async (request) => {
    const { userId } = request.user as { userId: string };
    const { overrides, reason } = batchOverrideSchema.parse(request.body);

    const results = { succeeded: 0, failed: 0, errors: [] as Array<{ eventId: string; error: string }> };

    for (const override of overrides) {
      try {
        // Get schoolId from the event
        let schoolId: string;
        if (override.eventType === 'GAME') {
          const game = await prisma.game.findUnique({
            where: { id: override.eventId },
            include: { season: { include: { team: true } } },
          });
          if (!game) throw new Error('Game not found');
          schoolId = game.season.team.schoolId;
        } else {
          const practice = await prisma.practice.findUnique({
            where: { id: override.eventId },
            include: { season: { include: { team: true } } },
          });
          if (!practice) throw new Error('Practice not found');
          schoolId = practice.season.team.schoolId;
        }

        await conflictService.createOverride(
          schoolId,
          { eventType: override.eventType as any, eventId: override.eventId, blockerId: override.blockerId, reason },
          userId
        );
        results.succeeded++;
      } catch (error) {
        results.failed++;
        results.errors.push({ eventId: override.eventId, error: String(error) });
      }
    }

    return { data: results };
  });

  // Get override history for a specific event
  app.get('/conflicts/overrides/:eventType/:eventId', async (request) => {
    const { eventType, eventId } = request.params as { eventType: string; eventId: string };
    const overrides = await conflictService.getOverridesForEvent(
      eventType as 'GAME' | 'PRACTICE',
      eventId
    );
    return { data: overrides };
  });

  // Create a conflict override
  app.post('/conflicts/override', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const input = createOverrideSchema.parse(request.body);

    // Get schoolId from the event
    let schoolId: string;

    if (input.eventType === 'GAME') {
      const game = await prisma.game.findUnique({
        where: { id: input.eventId },
        include: { season: { include: { team: true } } },
      });
      if (!game) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Game not found' } });
      }
      schoolId = game.season.team.schoolId;
    } else {
      const practice = await prisma.practice.findUnique({
        where: { id: input.eventId },
        include: { season: { include: { team: true } } },
      });
      if (!practice) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Practice not found' } });
      }
      schoolId = practice.season.team.schoolId;
    }

    const result = await conflictService.createOverride(
      schoolId,
      {
        eventType: input.eventType,
        eventId: input.eventId,
        blockerId: input.blockerId,
        reason: input.reason,
      },
      userId
    );

    return reply.status(201).send({ data: result });
  });
}
