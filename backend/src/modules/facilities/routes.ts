// backend/src/modules/facilities/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../common/middleware/auth.js';
import { createFacilitySchema, updateFacilitySchema } from './schemas.js';
import { facilitiesService } from './service.js';

export async function facilitiesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // List facilities for school
  app.get('/schools/:schoolId/facilities', async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const facilities = await facilitiesService.findBySchool(schoolId);
    return { data: facilities };
  });

  // Create facility
  app.post('/schools/:schoolId/facilities', {
    preHandler: [requireRole('ADMIN')],
  }, async (request, reply) => {
    const { schoolId } = request.params as { schoolId: string };
    const input = createFacilitySchema.parse(request.body);
    const facility = await facilitiesService.create(schoolId, input);
    return reply.status(201).send({ data: facility });
  });

  // Get facility by ID
  app.get('/facilities/:id', async (request) => {
    const { id } = request.params as { id: string };
    const facility = await facilitiesService.findById(id);
    return { data: facility };
  });

  // Update facility
  app.patch('/facilities/:id', async (request) => {
    const { id } = request.params as { id: string };
    const input = updateFacilitySchema.parse(request.body);
    const facility = await facilitiesService.update(id, input);
    return { data: facility };
  });

  // Delete facility
  app.delete('/facilities/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await facilitiesService.delete(id);
    return reply.status(204).send();
  });
}
