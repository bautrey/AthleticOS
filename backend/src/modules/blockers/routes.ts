// backend/src/modules/blockers/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole, STAFF, ALL_INTERNAL } from '../../common/middleware/auth.js';
import { blockerService } from './service.js';
import {
  createBlockerSchema,
  updateBlockerSchema,
  blockerQuerySchema,
  type CreateBlockerInput,
  type UpdateBlockerInput,
  type BlockerQuery,
} from './schemas.js';
import { notificationService } from '../notifications/service.js';

interface SchoolParams {
  schoolId: string;
}

interface BlockerParams extends SchoolParams {
  id: string;
}

export async function blockersRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', authenticate);

  // List blockers
  app.get<{ Params: SchoolParams; Querystring: BlockerQuery }>(
    '/schools/:schoolId/blockers',
    {
      preHandler: [requireRole(...ALL_INTERNAL)],
    },
    async (request) => {
      const query = blockerQuerySchema.parse(request.query);
      const result = await blockerService.list(request.params.schoolId, query);
      return result;
    }
  );

  // Get single blocker
  app.get<{ Params: BlockerParams }>(
    '/schools/:schoolId/blockers/:id',
    {
      preHandler: [requireRole(...ALL_INTERNAL)],
    },
    async (request) => {
      const blocker = await blockerService.getById(
        request.params.schoolId,
        request.params.id
      );
      return { data: blocker };
    }
  );

  // Create blocker
  app.post<{ Params: SchoolParams; Body: CreateBlockerInput }>(
    '/schools/:schoolId/blockers',
    {
      preHandler: [requireRole(...STAFF)],
    },
    async (request, reply) => {
      const data = createBlockerSchema.parse(request.body);
      const { userId } = request.user as { userId: string };
      const result = await blockerService.create(
        request.params.schoolId,
        data,
        userId
      );
      // Fire-and-forget notification (WEATHER_ALERT for weather blockers, SCHEDULE_CHANGE otherwise)
      const trigger = data.type === 'WEATHER' ? 'WEATHER_ALERT' as const : 'SCHEDULE_CHANGE' as const;
      notificationService.emit({
        trigger,
        schoolId: request.params.schoolId,
        eventType: 'BLOCKER',
        eventId: result.blocker.id,
      }).catch(err => request.log.error(err));
      return reply.status(201).send({
        data: result.blocker,
        meta: { conflictingEvents: result.conflictingEvents },
      });
    }
  );

  // Update blocker
  app.patch<{ Params: BlockerParams; Body: UpdateBlockerInput }>(
    '/schools/:schoolId/blockers/:id',
    {
      preHandler: [requireRole(...STAFF)],
    },
    async (request) => {
      const data = updateBlockerSchema.parse(request.body);
      const result = await blockerService.update(
        request.params.schoolId,
        request.params.id,
        data
      );
      return {
        data: result.blocker,
        meta: { conflictingEvents: result.conflictingEvents },
      };
    }
  );

  // Delete blocker
  app.delete<{ Params: BlockerParams }>(
    '/schools/:schoolId/blockers/:id',
    {
      preHandler: [requireRole(...STAFF)],
    },
    async (request, reply) => {
      await blockerService.delete(request.params.schoolId, request.params.id);
      return reply.status(204).send();
    }
  );
}
