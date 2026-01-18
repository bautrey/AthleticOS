// backend/src/modules/shares/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { createShareSchema, updateShareSchema } from './schemas.js';
import { sharesService } from './service.js';

export async function sharesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // List shares for a season
  app.get('/seasons/:seasonId/shares', async (request) => {
    const { seasonId } = request.params as { seasonId: string };
    const shares = await sharesService.listBySeason(seasonId);
    return { data: shares };
  });

  // Create a share
  app.post('/seasons/:seasonId/shares', async (request, reply) => {
    const { seasonId } = request.params as { seasonId: string };
    const input = createShareSchema.parse(request.body);
    const userId = (request.user as { userId: string }).userId;
    const share = await sharesService.create(seasonId, input, userId);
    return reply.status(201).send({ data: share });
  });

  // Get a share by ID
  app.get('/seasons/:seasonId/shares/:shareId', async (request) => {
    const { shareId } = request.params as { shareId: string };
    const share = await sharesService.findById(shareId);
    return { data: share };
  });

  // Update a share
  app.patch('/seasons/:seasonId/shares/:shareId', async (request) => {
    const { shareId } = request.params as { shareId: string };
    const input = updateShareSchema.parse(request.body);
    const share = await sharesService.update(shareId, input);
    return { data: share };
  });

  // Delete a share
  app.delete('/seasons/:seasonId/shares/:shareId', async (request, reply) => {
    const { shareId } = request.params as { shareId: string };
    await sharesService.delete(shareId);
    return reply.status(204).send();
  });
}
