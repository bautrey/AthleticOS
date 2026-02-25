// backend/src/modules/ideas/routes.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/auth.js';
import { prisma } from '../../common/db.js';
import { ideasService } from './service.js';

const createSubmissionSchema = z.object({
  type: z.enum(['FEATURE_REQUEST', 'BUG_REPORT', 'OTHER']),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function ideasRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Submit feedback (proxy to Ideas API)
  app.post('/ideas/submissions', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const input = createSubmissionSchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'User not found' },
      });
    }

    const result = await ideasService.createSubmission(input, user);
    return reply.status(201).send({ data: result });
  });

  // List user's submissions (proxy to Ideas API)
  app.get('/ideas/submissions', async (request) => {
    const { userId } = request.user as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return { data: [] };
    }

    const result = await ideasService.listSubmissions(user.email);
    return { data: result };
  });
}
