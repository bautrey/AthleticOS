// backend/src/modules/events/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole, ALL_INTERNAL } from '../../common/middleware/auth.js';
import { eventsService } from './service.js';
import { upcomingEventsSchema } from './schemas.js';

export async function eventsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Get upcoming events for a school
  app.get('/schools/:schoolId/events/upcoming', {
    preHandler: [requireRole(...ALL_INTERNAL)],
  }, async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const { from, to } = upcomingEventsSchema.parse(request.query);

    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // +2 days default

    const events = await eventsService.getUpcoming(schoolId, fromDate, toDate);
    return { data: events };
  });
}
