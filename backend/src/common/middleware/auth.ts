// backend/src/common/middleware/auth.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db.js';
import { ForbiddenError } from '../errors.js';
import { Role } from '@prisma/client';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  }
}

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const schoolId = (request.params as { schoolId?: string }).schoolId;
    if (!schoolId) return;

    const { userId } = request.user as { userId: string };

    const schoolUser = await prisma.schoolUser.findUnique({
      where: { schoolId_userId: { schoolId, userId } },
    });

    if (!schoolUser || !roles.includes(schoolUser.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }

    // Attach to request for downstream use
    (request as any).schoolUser = schoolUser;
  };
}
