// backend/src/modules/teams/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../common/middleware/auth.js';
import { createTeamSchema, updateTeamSchema } from './schemas.js';
import { teamsService } from './service.js';

export async function teamsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // List teams for school
  app.get('/schools/:schoolId/teams', async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const teams = await teamsService.findBySchool(schoolId);
    return { data: teams };
  });

  // Create team
  app.post('/schools/:schoolId/teams', {
    preHandler: [requireRole('ADMIN', 'COACH')],
  }, async (request, reply) => {
    const { schoolId } = request.params as { schoolId: string };
    const input = createTeamSchema.parse(request.body);
    const team = await teamsService.create(schoolId, input);
    return reply.status(201).send({ data: team });
  });

  // Get team by ID
  app.get('/teams/:id', async (request) => {
    const { id } = request.params as { id: string };
    const team = await teamsService.findById(id);
    return { data: team };
  });

  // Update team
  app.patch('/teams/:id', async (request) => {
    const { id } = request.params as { id: string };
    const input = updateTeamSchema.parse(request.body);
    const team = await teamsService.update(id, input);
    return { data: team };
  });

  // Delete team
  app.delete('/teams/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await teamsService.delete(id);
    return reply.status(204).send();
  });
}
