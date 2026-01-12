// backend/src/modules/seasons/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { createSeasonSchema, updateSeasonSchema } from './schemas.js';
import { seasonsService } from './service.js';

export async function seasonsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // List seasons for team
  app.get('/teams/:teamId/seasons', async (request) => {
    const { teamId } = request.params as { teamId: string };
    const seasons = await seasonsService.findByTeam(teamId);
    return { data: seasons };
  });

  // Create season
  app.post('/teams/:teamId/seasons', async (request, reply) => {
    const { teamId } = request.params as { teamId: string };
    const input = createSeasonSchema.parse(request.body);
    const season = await seasonsService.create(teamId, input);
    return reply.status(201).send({ data: season });
  });

  // Get season by ID
  app.get('/seasons/:id', async (request) => {
    const { id } = request.params as { id: string };
    const season = await seasonsService.findById(id);
    return { data: season };
  });

  // Update season
  app.patch('/seasons/:id', async (request) => {
    const { id } = request.params as { id: string };
    const input = updateSeasonSchema.parse(request.body);
    const season = await seasonsService.update(id, input);
    return { data: season };
  });

  // Delete season
  app.delete('/seasons/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await seasonsService.delete(id);
    return reply.status(204).send();
  });
}
