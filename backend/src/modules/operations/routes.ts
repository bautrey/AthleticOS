// backend/src/modules/operations/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole, STAFF, MANAGEMENT } from '../../common/middleware/auth.js';
import { createTemplateSchema, updateChecklistSchema, readinessQuerySchema } from './schemas.js';
import { operationsService } from './service.js';

export async function operationsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Create operations template
  app.post('/schools/:schoolId/operations-templates', {
    preHandler: [requireRole(...MANAGEMENT)],
  }, async (request, reply) => {
    const { schoolId } = request.params as { schoolId: string };
    const input = createTemplateSchema.parse(request.body);
    const template = await operationsService.createTemplate(schoolId, input);
    return reply.status(201).send({ data: template });
  });

  // List operations templates
  app.get('/schools/:schoolId/operations-templates', {
    preHandler: [requireRole(...STAFF)],
  }, async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const templates = await operationsService.listTemplates(schoolId);
    return { data: templates };
  });

  // Get event checklist (auto-creates from template if needed)
  app.get('/schools/:schoolId/events/:eventId/checklist', {
    preHandler: [requireRole(...STAFF)],
  }, async (request) => {
    const { schoolId, eventId } = request.params as { schoolId: string; eventId: string };
    const { eventType } = request.query as { eventType?: string };
    const type = eventType || 'HOME_GAME';
    const checklist = await operationsService.getChecklist(schoolId, type, eventId);
    return { data: checklist };
  });

  // Update event checklist items
  app.patch('/schools/:schoolId/events/:eventId/checklist', {
    preHandler: [requireRole(...STAFF)],
  }, async (request) => {
    const { schoolId, eventId } = request.params as { schoolId: string; eventId: string };
    const { eventType } = request.query as { eventType?: string };
    const type = eventType || 'HOME_GAME';
    const input = updateChecklistSchema.parse(request.body);
    const checklist = await operationsService.updateChecklist(schoolId, type, eventId, input);
    return { data: checklist };
  });

  // Operations readiness dashboard
  app.get('/schools/:schoolId/operations-readiness', {
    preHandler: [requireRole(...MANAGEMENT)],
  }, async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const { days } = readinessQuerySchema.parse(request.query);
    const readiness = await operationsService.getReadiness(schoolId, days);
    return { data: readiness };
  });
}
