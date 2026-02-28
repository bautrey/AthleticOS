// backend/src/modules/invites/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../common/middleware/auth.js';
import { createInviteSchema } from './schemas.js';
import { inviteService } from './service.js';

export async function inviteRoutes(app: FastifyInstance) {
  // Create invite (admin only)
  app.post('/schools/:schoolId/invites', {
    preHandler: [authenticate, requireRole('ADMIN')],
  }, async (request, reply) => {
    const { schoolId } = request.params as { schoolId: string };
    const { userId } = request.user as { userId: string };
    const input = createInviteSchema.parse(request.body);

    const invite = await inviteService.createInvite(schoolId, input.email, input.role, userId);
    return reply.status(201).send({ data: invite });
  });

  // List invites (admin only)
  app.get('/schools/:schoolId/invites', {
    preHandler: [authenticate, requireRole('ADMIN')],
  }, async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const invites = await inviteService.listInvites(schoolId);
    return { data: invites };
  });

  // Revoke invite (admin only)
  app.delete('/schools/:schoolId/invites/:inviteId', {
    preHandler: [authenticate, requireRole('ADMIN')],
  }, async (request, reply) => {
    const { schoolId, inviteId } = request.params as { schoolId: string; inviteId: string };
    await inviteService.revokeInvite(inviteId, schoolId);
    return reply.status(204).send();
  });

  // Get invite details (public - for accept page)
  app.get('/invites/:token', async (request) => {
    const { token } = request.params as { token: string };
    const invite = await inviteService.getInviteByToken(token);
    return {
      data: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        schoolName: invite.school.name,
        schoolId: invite.school.id,
        inviterEmail: invite.inviter.email,
        expiresAt: invite.expiresAt,
        acceptedAt: invite.acceptedAt,
      },
    };
  });

  // Accept invite (requires auth)
  app.post('/invites/:token/accept', {
    preHandler: [authenticate],
  }, async (request) => {
    const { token } = request.params as { token: string };
    const { userId } = request.user as { userId: string };
    const invite = await inviteService.acceptInvite(token, userId);
    return { data: { schoolId: invite.schoolId, schoolName: invite.school.name } };
  });

  // List school members
  app.get('/schools/:schoolId/members', {
    preHandler: [authenticate],
  }, async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const { prisma } = await import('../../common/db.js');
    const members = await prisma.schoolUser.findMany({
      where: { schoolId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      data: members.map(m => ({
        id: m.id,
        userId: m.userId,
        email: m.user.email,
        name: m.user.name,
        role: m.role,
        joinedAt: m.createdAt,
      })),
    };
  });
}
