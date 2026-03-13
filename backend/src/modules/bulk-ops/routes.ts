// backend/src/modules/bulk-ops/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole, MANAGEMENT } from '../../common/middleware/auth.js';
import { bulkOpsService } from './service.js';
import { bulkMoveSchema, rainPlanSchema, autoResolveSchema } from './schemas.js';

export async function bulkOpsRoutes(app: FastifyInstance) {
  // Bulk move events
  app.post('/schools/:schoolId/bulk-move', {
    preHandler: [authenticate, requireRole(...MANAGEMENT)],
  }, async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const input = bulkMoveSchema.parse(request.body);
    const result = await bulkOpsService.bulkMove(schoolId, input);
    return { data: result };
  });

  // Rain plan: move outdoor events to fallback facilities
  app.post('/schools/:schoolId/rain-plan', {
    preHandler: [authenticate, requireRole(...MANAGEMENT)],
  }, async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const input = rainPlanSchema.parse(request.body);
    const result = await bulkOpsService.rainPlan(schoolId, input);
    return { data: result };
  });

  // Auto-resolve conflicts
  app.post('/schools/:schoolId/conflicts/auto-resolve', {
    preHandler: [authenticate, requireRole(...MANAGEMENT)],
  }, async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const input = autoResolveSchema.parse(request.body);
    const result = await bulkOpsService.autoResolve(schoolId, input);
    return { data: result };
  });
}
