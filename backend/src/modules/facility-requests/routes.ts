// backend/src/modules/facility-requests/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole, STAFF, MANAGEMENT } from '../../common/middleware/auth.js';
import { Role } from '@prisma/client';
import { facilityRequestService } from './service.js';
import {
  createFacilityRequestSchema,
  listRequestsSchema,
  updateRequestStatusSchema,
  availabilitySchema,
} from './schemas.js';

export async function facilityRequestRoutes(app: FastifyInstance) {
  // Create facility request
  app.post('/schools/:schoolId/facility-requests', {
    preHandler: [authenticate, requireRole(Role.ADMIN, Role.ATHLETIC_DIRECTOR, Role.COACH, Role.COMMUNITY)],
  }, async (request, reply) => {
    const { schoolId } = request.params as { schoolId: string };
    const { userId } = request.user as { userId: string };
    const input = createFacilityRequestSchema.parse(request.body);
    const result = await facilityRequestService.create(schoolId, input, userId);
    return reply.status(201).send({ data: result });
  });

  // List facility requests
  app.get('/schools/:schoolId/facility-requests', {
    preHandler: [authenticate, requireRole(Role.ADMIN, Role.ATHLETIC_DIRECTOR, Role.COACH, Role.COMMUNITY)],
  }, async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const { userId } = request.user as { userId: string };
    const schoolUser = (request as any).schoolUser;
    const query = listRequestsSchema.parse(request.query);
    const result = await facilityRequestService.list(schoolId, query, userId, schoolUser.role);
    return { data: result.data, meta: result.meta };
  });

  // Update request status (approve/deny/cancel)
  app.patch('/schools/:schoolId/facility-requests/:id', {
    preHandler: [authenticate, requireRole(...MANAGEMENT)],
  }, async (request) => {
    const { schoolId, id } = request.params as { schoolId: string; id: string };
    const { userId } = request.user as { userId: string };
    const input = updateRequestStatusSchema.parse(request.body);
    const result = await facilityRequestService.updateStatus(schoolId, id, input, userId);
    return { data: result };
  });

  // Get facility availability
  app.get('/schools/:schoolId/facilities/:id/availability', {
    preHandler: [authenticate, requireRole(...STAFF)],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const query = availabilitySchema.parse(request.query);
    const result = await facilityRequestService.getAvailability(id, query.from, query.to);
    return { data: result };
  });
}
