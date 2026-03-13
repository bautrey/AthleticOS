// backend/src/modules/games/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole, STAFF, ALL_INTERNAL } from '../../common/middleware/auth.js';
import { createGameSchema, updateGameSchema } from './schemas.js';
import { gamesService } from './service.js';
import { conflictService } from '../conflicts/service.js';
import { notificationService } from '../notifications/service.js';
import { prisma } from '../../common/db.js';

export async function gamesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // List games for season
  app.get('/seasons/:seasonId/games', {
    preHandler: [requireRole(...ALL_INTERNAL)],
  }, async (request) => {
    const { seasonId } = request.params as { seasonId: string };
    const games = await gamesService.findBySeason(seasonId);
    return { data: games };
  });

  // Create game
  app.post('/seasons/:seasonId/games', {
    preHandler: [requireRole(...STAFF)],
  }, async (request, reply) => {
    const { seasonId } = request.params as { seasonId: string };
    const input = createGameSchema.parse(request.body);
    const game = await gamesService.create(seasonId, input);

    // Check for conflicts
    const conflictResult = await conflictService.checkEventConflicts({
      datetime: game.datetime,
      seasonId: game.seasonId,
      facilityId: game.facilityId,
    });

    // Fire-and-forget notification
    const season = await prisma.season.findUnique({ where: { id: seasonId }, select: { team: { select: { schoolId: true } } } });
    if (season) {
      notificationService.emit({ trigger: 'SCHEDULE_CHANGE', schoolId: season.team.schoolId, eventType: 'GAME', eventId: game.id }).catch(err => request.log.error(err));
    }

    return reply.status(201).send({
      data: game,
      meta: {
        conflicts: conflictResult.conflicts,
        hasConflicts: conflictResult.hasConflicts,
      },
    });
  });

  // Get game by ID
  app.get('/games/:id', async (request) => {
    const { id } = request.params as { id: string };
    const game = await gamesService.findById(id);
    return { data: game };
  });

  // Update game
  app.patch('/games/:id', async (request) => {
    const { id } = request.params as { id: string };
    const input = updateGameSchema.parse(request.body);
    const game = await gamesService.update(id, input);

    // Check for conflicts after update
    const conflictResult = await conflictService.checkEventConflicts({
      datetime: game.datetime,
      seasonId: game.seasonId,
      facilityId: game.facilityId,
    });

    // Fire-and-forget notification
    const season = await prisma.season.findUnique({ where: { id: game.seasonId }, select: { team: { select: { schoolId: true } } } });
    if (season) {
      notificationService.emit({ trigger: 'SCHEDULE_CHANGE', schoolId: season.team.schoolId, eventType: 'GAME', eventId: game.id, changes: input as Record<string, unknown> }).catch(err => request.log.error(err));
    }

    return {
      data: game,
      meta: {
        conflicts: conflictResult.conflicts,
        hasConflicts: conflictResult.hasConflicts,
      },
    };
  });

  // Delete game
  app.delete('/games/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    // Get schoolId before deletion
    const game = await gamesService.findById(id);
    const season = await prisma.season.findUnique({ where: { id: game.seasonId }, select: { team: { select: { schoolId: true } } } });
    await gamesService.delete(id);
    // Fire-and-forget notification
    if (season) {
      notificationService.emit({ trigger: 'SCHEDULE_CHANGE', schoolId: season.team.schoolId, eventType: 'GAME', eventId: id }).catch(err => request.log.error(err));
    }
    return reply.status(204).send();
  });
}
