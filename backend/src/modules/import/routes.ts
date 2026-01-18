// backend/src/modules/import/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { importPreviewSchema, importExecuteSchema } from './schemas.js';
import { importService } from './service.js';

export async function importRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Preview import (validate and check conflicts)
  app.post('/seasons/:seasonId/import/preview', async (request) => {
    const { seasonId } = request.params as { seasonId: string };
    const input = importPreviewSchema.parse(request.body);
    const result = await importService.preview(seasonId, input);
    return { data: result };
  });

  // Execute import
  app.post('/seasons/:seasonId/import/execute', async (request, reply) => {
    const { seasonId } = request.params as { seasonId: string };
    const input = importExecuteSchema.parse(request.body);
    const userId = (request.user as { id: string }).id;
    const result = await importService.execute(seasonId, input, userId);
    return reply.status(201).send({ data: result });
  });
}
