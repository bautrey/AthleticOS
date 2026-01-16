// backend/src/modules/conflicts/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { prisma } from '../../common/db.js';
import { createOverrideSchema } from './schemas.js';
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

  // Get school-wide conflict summary (dashboard)
  app.get('/schools/:schoolId/conflict-summary', async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const result = await conflictService.getSchoolConflictSummary(schoolId);
    return { data: result };
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
