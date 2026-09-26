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

  // Delete school
  app.delete('/schools/:schoolId', {
    preHandler: [requireRole(...MANAGEMENT)],
  }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { schoolId } = request.params as { schoolId: string };
    await schoolsService.delete(schoolId, userId);
    return reply.status(204).send();
  });
}
