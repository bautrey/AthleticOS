// backend/src/modules/conflicts/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole, STAFF, ALL_INTERNAL } from '../../common/middleware/auth.js';
import { prisma } from '../../common/db.js';
import { createOverrideSchema, conflictsListQueryWithSuggestionsSchema, batchOverrideSchema, checkConflictsSchema, suggestSlotsSchema } from './schemas.js';
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
  // T-028: Extended with 'types' query param for blocker/facility/all filtering
  app.get('/schools/:schoolId/conflicts', {
    preHandler: [requireRole(...ALL_INTERNAL)],
  }, async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const query = conflictsListQueryWithSuggestionsSchema.parse(request.query);

    // Get the base blocker-based conflicts list
    const result = await conflictService.listAllConflicts(schoolId, query);

    // T-028: If types includes 'facility' or 'all', merge facility conflicts
    const typesStr = query.types ?? 'blocker';
    const types = typesStr.split(',').map(t => t.trim().toLowerCase());

    if (types.includes('facility') || types.includes('all')) {
      // Determine date range from existing conflicts or default to 90 days
      const now = new Date();
      const ninetyDaysOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      const facilityConflicts = await conflictService.checkFacilityConflicts(schoolId, {
        start: now,
        end: ninetyDaysOut,
      });

      // Return facility conflicts as a separate field alongside blocker conflicts
      return {
        ...result,
        facilityConflicts,
        summary: {
          ...result.summary,
          facilityConflictCount: facilityConflicts.length,
        },
      };
    }

    return result;
  });

  // T-026: POST /schools/:schoolId/check-conflicts - Run all enabled conflict checks
  app.post('/schools/:schoolId/check-conflicts', {
    preHandler: [requireRole(...STAFF)],
  }, async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const input = checkConflictsSchema.parse(request.body);

    const dateRange = input.dateRange
      ? { start: new Date(input.dateRange.start), end: new Date(input.dateRange.end) }
      : undefined;

    const result = await conflictService.checkConflicts(schoolId, {
      eventId: input.eventId,
      dateRange,
      types: input.types,
    });

    return { data: result };
  });

  // T-027: POST /schools/:schoolId/suggest-slots - Find available time slots
  app.post('/schools/:schoolId/suggest-slots', {
    preHandler: [requireRole(...STAFF)],
  }, async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const input = suggestSlotsSchema.parse(request.body);

    // Verify facility belongs to school
    const facility = await prisma.facility.findFirst({
      where: { id: input.facilityId, schoolId },
    });
    if (!facility) {
      return { error: { code: 'NOT_FOUND', message: 'Facility not found' } };
    }

    const slots = await conflictService.suggestSlots(schoolId, input);
    return { data: { slots } };
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
