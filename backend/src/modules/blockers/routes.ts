// backend/src/modules/blockers/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../common/middleware/auth.js';
import { blockerService } from './service.js';
import {
  createBlockerSchema,
  updateBlockerSchema,
  blockerQuerySchema,
  type CreateBlockerInput,
  type UpdateBlockerInput,
  type BlockerQuery,
} from './schemas.js';

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
      preHandler: [requireRole('ADMIN', 'COACH', 'VIEWER')],
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
      preHandler: [requireRole('ADMIN', 'COACH', 'VIEWER')],
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
      preHandler: [requireRole('ADMIN', 'COACH')],
    },
    async (request, reply) => {
      const data = createBlockerSchema.parse(request.body);
      const { userId } = request.user as { userId: string };
      const result = await blockerService.create(
        request.params.schoolId,
        data,
        userId
      );
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
      preHandler: [requireRole('ADMIN', 'COACH')],
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
      preHandler: [requireRole('ADMIN', 'COACH')],
    },
    async (request, reply) => {
      await blockerService.delete(request.params.schoolId, request.params.id);
      return reply.status(204).send();
    }
  );
}
