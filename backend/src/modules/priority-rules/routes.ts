// backend/src/modules/priority-rules/routes.ts

import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../common/middleware/auth.js';
import { priorityRuleService } from './service.js';
import {
  updatePriorityRulesSchema,
  calculatePrioritySchema,
  comparePrioritySchema,
  auditQuerySchema,
  type UpdatePriorityRulesInput,
  type CalculatePriorityInput,
  type ComparePriorityInput,
  type AuditQuery,
} from './schemas.js';

interface SchoolParams {
  schoolId: string;
}

export async function priorityRuleRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', authenticate);

  // Get priority rules
  app.get<{ Params: SchoolParams }>(
    '/schools/:schoolId/priority-rules',
    {
      preHandler: [requireRole('ADMIN', 'ATHLETIC_DIRECTOR', 'COACH', 'PARENT', 'ATHLETE')],
    },
    async (request) => {
      const rule = await priorityRuleService.get(request.params.schoolId);
      return { data: rule };
    }
  );

  // Update priority rules (ADMIN only)
  app.put<{ Params: SchoolParams; Body: UpdatePriorityRulesInput }>(
    '/schools/:schoolId/priority-rules',
    {
      preHandler: [requireRole('ADMIN')],
    },
    async (request) => {
      const data = updatePriorityRulesSchema.parse(request.body);
      const { userId } = request.user as { userId: string };
      const result = await priorityRuleService.upsert(
        request.params.schoolId,
        data,
        userId
      );
      return { data: result.rule, meta: { audits: result.audits } };
    }
  );

  // Calculate priority score
  app.post<{ Params: SchoolParams; Body: CalculatePriorityInput }>(
    '/schools/:schoolId/priority-rules/calculate',
    {
      preHandler: [requireRole('ADMIN', 'COACH')],
    },
    async (request) => {
      const input = calculatePrioritySchema.parse(request.body);
      const result = await priorityRuleService.calculate(request.params.schoolId, input);
      return { data: result };
    }
  );

  // Compare two events
  app.post<{ Params: SchoolParams; Body: ComparePriorityInput }>(
    '/schools/:schoolId/priority-rules/compare',
    {
      preHandler: [requireRole('ADMIN', 'COACH')],
    },
    async (request) => {
      const input = comparePrioritySchema.parse(request.body);
      const result = await priorityRuleService.compare(request.params.schoolId, input);
      return { data: result };
    }
  );

  // Audit log
  app.get<{ Params: SchoolParams; Querystring: AuditQuery }>(
    '/schools/:schoolId/priority-rules/audits',
    {
      preHandler: [requireRole('ADMIN')],
    },
    async (request) => {
      const query = auditQuerySchema.parse(request.query);
      return await priorityRuleService.getAudits(request.params.schoolId, query);
    }
  );
}
