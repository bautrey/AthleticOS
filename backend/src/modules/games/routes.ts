// backend/src/modules/games/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { createGameSchema, updateGameSchema } from './schemas.js';
import { gamesService } from './service.js';
import { conflictService } from '../conflicts/service.js';

export async function gamesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // List games for season
  app.get('/seasons/:seasonId/games', async (request) => {
    const { seasonId } = request.params as { seasonId: string };
    const games = await gamesService.findBySeason(seasonId);
    return { data: games };
  });

  // Create game
  app.post('/seasons/:seasonId/games', async (request, reply) => {
    const { seasonId } = request.params as { seasonId: string };
    const input = createGameSchema.parse(request.body);
    const game = await gamesService.create(seasonId, input);

    // Check for conflicts
    const conflictResult = await conflictService.checkEventConflicts({
      datetime: game.datetime,
      seasonId: game.seasonId,
      facilityId: game.facilityId,
    });

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
    await gamesService.delete(id);
    return reply.status(204).send();
  });
}
