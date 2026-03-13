// backend/src/modules/recurring/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole, STAFF } from '../../common/middleware/auth.js';
import { createRecurringSchema, updateRecurringSchema } from './schemas.js';
import { recurringService } from './service.js';

export async function recurringRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Create recurring practice series (dryRun=true for preview)
  app.post('/schools/:schoolId/practices/recurring', {
    preHandler: [requireRole(...STAFF)],
  }, async (request, reply) => {
    const { schoolId } = request.params as { schoolId: string };
    const input = createRecurringSchema.parse(request.body);
    const result = await recurringService.createRecurringSeries(schoolId, input);
    return reply.status(input.dryRun ? 200 : 201).send({ data: result });
  });

  // Update future practices in a recurrence group
  app.patch('/schools/:schoolId/practices/recurring/:groupId', {
    preHandler: [requireRole(...STAFF)],
  }, async (request) => {
    const { schoolId, groupId } = request.params as { schoolId: string; groupId: string };
    const input = updateRecurringSchema.parse(request.body);
    const result = await recurringService.updateSeries(schoolId, groupId, input);
    return { data: result };
  });

  // Delete future practices in a recurrence group
  app.delete('/schools/:schoolId/practices/recurring/:groupId', {
    preHandler: [requireRole(...STAFF)],
  }, async (request, reply) => {
    const { schoolId, groupId } = request.params as { schoolId: string; groupId: string };
    const result = await recurringService.deleteSeries(schoolId, groupId);
    return { data: result };
  });
}
