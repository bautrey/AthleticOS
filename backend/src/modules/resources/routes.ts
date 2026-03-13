// backend/src/modules/resources/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { resourcesService } from './service.js';
import { createResourceSchema, updateResourceSchema, assignResourceSchema } from './schemas.js';

export async function resourcesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/schools/:schoolId/resources', async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const resources = await resourcesService.list(schoolId);
    return { data: resources };
  });

  app.post('/schools/:schoolId/resources', async (request, reply) => {
    const { schoolId } = request.params as { schoolId: string };
    const input = createResourceSchema.parse(request.body);
    const resource = await resourcesService.create(schoolId, input);
    return reply.status(201).send({ data: resource });
  });

  app.patch('/resources/:id', async (request) => {
    const { id } = request.params as { id: string };
    const input = updateResourceSchema.parse(request.body);
    const resource = await resourcesService.update(id, input);
    return { data: resource };
  });

  app.delete('/resources/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await resourcesService.delete(id);
    return reply.status(204).send();
  });

  app.post('/resources/assign', async (request, reply) => {
    const input = assignResourceSchema.parse(request.body);
    const result = await resourcesService.assignToEvent(input.resourceId, input.eventType, input.eventId);
    return reply.status(201).send({ data: result });
  });

  app.delete('/resources/:resourceId/events/:eventType/:eventId', async (request, reply) => {
    const { resourceId, eventType, eventId } = request.params as {
      resourceId: string;
      eventType: 'GAME' | 'PRACTICE';
      eventId: string;
    };
    await resourcesService.removeFromEvent(resourceId, eventType, eventId);
    return reply.status(204).send();
  });
}
