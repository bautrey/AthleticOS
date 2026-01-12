// backend/src/modules/practices/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { createPracticeSchema, updatePracticeSchema } from './schemas.js';
import { practicesService } from './service.js';

export async function practicesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // List practices for season
  app.get('/seasons/:seasonId/practices', async (request) => {
    const { seasonId } = request.params as { seasonId: string };
    const practices = await practicesService.findBySeason(seasonId);
    return { data: practices };
  });

  // Create practice
  app.post('/seasons/:seasonId/practices', async (request, reply) => {
    const { seasonId } = request.params as { seasonId: string };
    const input = createPracticeSchema.parse(request.body);
    const practice = await practicesService.create(seasonId, input);
    return reply.status(201).send({ data: practice });
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
    return { data: practice };
  });

  // Delete practice
  app.delete('/practices/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await practicesService.delete(id);
    return reply.status(204).send();
  });
}
