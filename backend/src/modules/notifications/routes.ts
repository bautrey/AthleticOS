// backend/src/modules/notifications/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole, MANAGEMENT } from '../../common/middleware/auth.js';
import { notificationService } from './service.js';
import {
  updatePreferencesSchema,
  notificationLogQuerySchema,
  testNotificationSchema,
} from './schemas.js';

export async function notificationsRoutes(app: FastifyInstance) {
  // User preferences (user-scoped, no schoolId needed for route)
  app.get('/notifications/preferences', {
    preHandler: [authenticate],
  }, async (request) => {
    const { userId } = request.user as { userId: string };
    // Get user's first school for preferences
    const schoolUser = await import('../../common/db.js').then(m =>
      m.prisma.schoolUser.findFirst({ where: { userId } })
    );
    if (!schoolUser) {
      return { data: { emailEnabled: true, smsEnabled: false, quietHoursStart: null, quietHoursEnd: null, digestMode: false, digestTime: null, phone: null, preferences: [] } };
    }
    const prefs = await notificationService.getPreferences(userId, schoolUser.schoolId);
    return { data: prefs };
  });

  app.put('/notifications/preferences', {
    preHandler: [authenticate],
  }, async (request) => {
    const { userId } = request.user as { userId: string };
    const input = updatePreferencesSchema.parse(request.body);
    // Get user's first school
    const schoolUser = await import('../../common/db.js').then(m =>
      m.prisma.schoolUser.findFirst({ where: { userId } })
    );
    if (!schoolUser) {
      return { error: { code: 'NOT_FOUND', message: 'No school membership found' } };
    }
    const prefs = await notificationService.updatePreferences(userId, schoolUser.schoolId, input);
    return { data: prefs };
  });

  // Admin notification log (school-scoped)
  app.get('/schools/:schoolId/notifications', {
    preHandler: [authenticate, requireRole(...MANAGEMENT)],
  }, async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const query = notificationLogQuerySchema.parse(request.query);
    const result = await notificationService.getNotificationLog(schoolId, query);
    return result;
  });

  // Test notification (user-scoped)
  app.post('/schools/:schoolId/notifications/test', {
    preHandler: [authenticate],
  }, async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const { userId } = request.user as { userId: string };
    const input = testNotificationSchema.parse(request.body);
    await notificationService.sendTestNotification(userId, schoolId, input.channel);
    return { data: { sent: true } };
  });

  // Public SMS opt-out (no auth, token-validated)
  app.post('/notifications/sms-opt-out', async (request, reply) => {
    const { token } = request.body as { token: string };
    if (!token) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Token required' } });
    }
    await notificationService.smsOptOut(token);
    return { data: { optedOut: true } };
  });
}
