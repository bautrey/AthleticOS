// backend/src/modules/calendar-feeds/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, requireInternalRole } from '../../common/middleware/auth.js';
import { createFeedSchema, feedParamsSchema } from './schemas.js';
import { calendarFeedsService } from './service.js';

/**
 * Authenticated calendar feed routes (under /api/v1)
 */
export async function calendarFeedsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Create a new calendar feed
  app.post('/calendar-feeds', {
    preHandler: [requireInternalRole()],
  }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const input = createFeedSchema.parse(request.body);
    const feed = await calendarFeedsService.createFeed(userId, input);
    return reply.status(201).send({ data: feed });
  });

  // List user's calendar feeds
  app.get('/calendar-feeds', {
    preHandler: [requireInternalRole()],
  }, async (request) => {
    const { userId } = request.user as { userId: string };
    const feeds = await calendarFeedsService.listFeeds(userId);
    return { data: feeds };
  });

  // Deactivate a feed
  app.delete('/calendar-feeds/:id', {
    preHandler: [requireInternalRole()],
  }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = feedParamsSchema.parse(request.params);
    await calendarFeedsService.deactivateFeed(userId, id);
    return reply.status(204).send();
  });
}

/**
 * Public iCal route (no auth, registered at app level)
 */
export async function publicCalendarFeedRoutes(app: FastifyInstance) {
  // GET /cal/:token.ics - public iCal endpoint
  app.get('/cal/:tokenFile', async (request, reply) => {
    const { tokenFile } = request.params as { tokenFile: string };

    // Strip .ics extension
    const token = tokenFile.endsWith('.ics')
      ? tokenFile.slice(0, -4)
      : tokenFile;

    const icsContent = await calendarFeedsService.generateICS(token);

    return reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', 'inline; filename="schedule.ics"')
      .header('Cache-Control', 'no-cache, no-store, must-revalidate')
      .send(icsContent);
  });
}
