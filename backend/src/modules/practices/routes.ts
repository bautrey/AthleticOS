// backend/src/modules/practices/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { createPracticeSchema, updatePracticeSchema } from './schemas.js';
import { practicesService } from './service.js';
import { conflictService } from '../conflicts/service.js';

export async function practicesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // List practices for season
  app.get('/seasons/:seasonId/practices', async (request) => {
    const { seasonId } = request.params as { seasonId: string };
    const practices = await practicesService.findBySeason(seasonId);
    return { data: practices };
  });

  // Create practice
  app.post('/seasons/:seasonId/practices', async (request, reply) => {
    const { seasonId } = request.params as { seasonId: string };
    const input = createPracticeSchema.parse(request.body);
    const practice = await practicesService.create(seasonId, input);

    // Check for conflicts
    const conflictResult = await conflictService.checkEventConflicts({
      datetime: practice.datetime,
      durationMinutes: practice.durationMinutes,
      seasonId: practice.seasonId,
      facilityId: practice.facilityId,
    });

    return reply.status(201).send({
      data: practice,
      meta: {
        conflicts: conflictResult.conflicts,
        hasConflicts: conflictResult.hasConflicts,
      },
    });
  });

  // Get practice by ID
  app.get('/practices/:id', async (request) => {
    const { id } = request.params as { id: string };
    const practice = await practicesService.findById(id);
    return { data: practice };
  });

  // Update practice
  app.patch('/practices/:id', async (request) => {
    const { id } = request.params as { id: string };
    const input = updatePracticeSchema.parse(request.body);
    const practice = await practicesService.update(id, input);

    // Check for conflicts after update
    const conflictResult = await conflictService.checkEventConflicts({
      datetime: practice.datetime,
      durationMinutes: practice.durationMinutes,
      seasonId: practice.seasonId,
      facilityId: practice.facilityId,
    });

    return {
      data: practice,
      meta: {
        conflicts: conflictResult.conflicts,
        hasConflicts: conflictResult.hasConflicts,
      },
    };
  });

  // Delete practice
  app.delete('/practices/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await practicesService.delete(id);
    return reply.status(204).send();
  });
}
