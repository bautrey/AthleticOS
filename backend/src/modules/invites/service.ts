// backend/src/modules/invites/service.ts
import crypto from 'node:crypto';
import { prisma } from '../../common/db.js';
import { config } from '../../config.js';
import { sendInviteEmail } from '../../common/email.js';
import { NotFoundError, ValidationError } from '../../common/errors.js';
import type { Role } from '@prisma/client';

const INVITE_EXPIRY_DAYS = 7;

export const inviteService = {
  async createInvite(schoolId: string, email: string, role: Role, invitedByUserId: string) {
    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await prisma.schoolUser.findUnique({
        where: { schoolId_userId: { schoolId, userId: existingUser.id } },
      });
      if (existingMember) {
        throw new ValidationError('This user is already a member of this school');
      }
    }

    // Check for existing pending invite
    const existingInvite = await prisma.invite.findFirst({
      where: { schoolId, email, acceptedAt: null, expiresAt: { gt: new Date() } },
    });
    if (existingInvite) {
      throw new ValidationError('A pending invite already exists for this email');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const invite = await prisma.invite.create({
      data: { schoolId, email, role, token, invitedBy: invitedByUserId, expiresAt },
      include: { school: { select: { name: true } }, inviter: { select: { email: true } } },
    });

    const inviteUrl = `${config.APP_URL}/invite/${token}`;
    await sendInviteEmail(email, invite.school.name, invite.inviter.email, inviteUrl);

    return invite;
  },

  async getInviteByToken(token: string) {
    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { school: { select: { id: true, name: true } }, inviter: { select: { email: true } } },
    });
    if (!invite) throw new NotFoundError('Invite');
    return invite;
  },

  async acceptInvite(token: string, userId: string) {
    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { school: { select: { id: true, name: true } } },
    });

    if (!invite) throw new NotFoundError('Invite');
    if (invite.acceptedAt) throw new ValidationError('This invite has already been accepted');
    if (invite.expiresAt < new Date()) throw new ValidationError('This invite has expired');

    // Check if already a member
    const existingMember = await prisma.schoolUser.findUnique({
      where: { schoolId_userId: { schoolId: invite.schoolId, userId } },
    });
    if (existingMember) {
      // Mark invite as accepted even if already a member
      await prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      return invite;
    }

    // Create membership and mark accepted in a transaction
    await prisma.$transaction([
      prisma.schoolUser.create({
        data: { schoolId: invite.schoolId, userId, role: invite.role },
      }),
      prisma.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    return invite;
  },

  async listInvites(schoolId: string) {
    return prisma.invite.findMany({
      where: { schoolId },
      include: { inviter: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async revokeInvite(inviteId: string, schoolId: string) {
    const invite = await prisma.invite.findFirst({
      where: { id: inviteId, schoolId, acceptedAt: null },
    });
    if (!invite) throw new NotFoundError('Invite');

    await prisma.invite.delete({ where: { id: inviteId } });
  },
};
