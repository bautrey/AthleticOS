// backend/src/common/middleware/auth.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db.js';
import { ForbiddenError, NotFoundError } from '../errors.js';
import { Role } from '@prisma/client';

// Role group constants
export const STAFF = [Role.ADMIN, Role.ATHLETIC_DIRECTOR, Role.COACH] as const;
export const MANAGEMENT = [Role.ADMIN, Role.ATHLETIC_DIRECTOR] as const;
export const ALL_INTERNAL = [Role.ADMIN, Role.ATHLETIC_DIRECTOR, Role.COACH, Role.PARENT, Role.ATHLETE] as const;

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  }
}

/**
 * Resolve schoolId from route params. Supports:
 * - Direct :schoolId param
 * - :seasonId param (resolves via season → team → school)
 */
async function resolveSchoolId(params: Record<string, string>): Promise<string> {
  if (params.schoolId) return params.schoolId;

  if (params.seasonId) {
    const season = await prisma.season.findUnique({
      where: { id: params.seasonId },
      select: { team: { select: { schoolId: true } } },
    });
    if (!season) throw new NotFoundError('Season', params.seasonId);
    return season.team.schoolId;
  }

  throw new ForbiddenError('Route requires schoolId or seasonId parameter for role check');
}

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const schoolId = await resolveSchoolId(request.params as Record<string, string>);
    const { userId } = request.user as { userId: string };

    const schoolUser = await prisma.schoolUser.findUnique({
      where: { schoolId_userId: { schoolId, userId } },
    });

    if (!schoolUser || !roles.includes(schoolUser.role)) {
      logPermissionDenied(userId, schoolUser?.role ?? 'NONE', request.url, request.method);
      throw new ForbiddenError('Insufficient permissions');
    }

    // Attach to request for downstream use
    (request as any).schoolUser = schoolUser;
  };
}

/**
 * For user-scoped routes without schoolId (e.g., calendar feeds).
 * Verifies the user has at least one internal role at any school.
 */
export function requireInternalRole() {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const { userId } = request.user as { userId: string };
    const schoolUser = await prisma.schoolUser.findFirst({
      where: { userId, role: { in: [...ALL_INTERNAL] } },
    });
    if (!schoolUser) {
      logPermissionDenied(userId, 'NONE', request.url, request.method);
      throw new ForbiddenError('Requires internal account');
    }
    (request as any).schoolUser = schoolUser;
  };
}

function logPermissionDenied(userId: string, role: string, route: string, method: string) {
  console.warn(`[PERMISSION_DENIED] user=${userId} role=${role} ${method} ${route}`);
}
