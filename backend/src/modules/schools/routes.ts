// backend/src/modules/schools/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole, MANAGEMENT } from '../../common/middleware/auth.js';
import { createSchoolSchema, updateSchoolSchema } from './schemas.js';
import { schoolsService } from './service.js';

export async function schoolsRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', authenticate);

  // List schools for current user
  app.get('/schools', async (request) => {
    const { userId } = request.user as { userId: string };
    const schools = await schoolsService.findAll(userId);
    return { data: schools };
  });

  // Create school
  app.post('/schools', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const input = createSchoolSchema.parse(request.body);
    const school = await schoolsService.create(input, userId);
    return reply.status(201).send({ data: school });
  });

  // Get school by ID
  app.get('/schools/:schoolId', async (request) => {
    const { userId } = request.user as { userId: string };
    const { schoolId } = request.params as { schoolId: string };
    const school = await schoolsService.findById(schoolId, userId);
    return { data: school };
  });

  // Update school
  app.patch('/schools/:schoolId', {
    preHandler: [requireRole(...MANAGEMENT)],
  }, async (request) => {
    const { userId } = request.user as { userId: string };
    const { schoolId } = request.params as { schoolId: string };
    const input = updateSchoolSchema.parse(request.body);
    const school = await schoolsService.update(schoolId, input, userId);
    return { data: school };
  });

  // Delete school.
  //
  // DELIBERATELY still on ':id', which leaves this route unreachable.
  //
  // requireRole resolves a school from params.schoolId or params.seasonId
  // (auth.ts:25), so ':id' makes it throw before it reads anyone's role and
  // every caller gets 403 - an ADMIN of this school included. That is the same
  // bug the rename fixed for PATCH above, and fixing it here too would switch
  // on, for the first time, a hard delete cascading across 11 relations: teams,
  // seasons, games, practices, facilities, blockers, inbound imports. One call,
  // no confirmation, no undo.
  //
  // Nothing has ever reached it and the frontend has no delete endpoint, so
  // leaving it exactly as it has always been costs nobody anything. Whether a
  // school should be deletable, and whether that cascades or goes soft, is a
  // decision on its own - tracked in issue #14.
  app.delete('/schools/:id', {
    preHandler: [requireRole(...MANAGEMENT)],
  }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    await schoolsService.delete(id, userId);
    return reply.status(204).send();
  });
}
