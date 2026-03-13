// backend/src/modules/auth/routes.ts
import type { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema } from './schemas.js';
import { communityRegisterSchema } from '../facility-requests/schemas.js';
import { authService } from './service.js';
import { inviteService } from '../invites/service.js';
import { config } from '../../config.js';
import { prisma } from '../../common/db.js';
import bcrypt from 'bcryptjs';

export async function authRoutes(app: FastifyInstance) {
  // Register
  app.post('/auth/register', async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const user = await authService.register(input);

    // Auto-accept invite if token provided
    if (input.inviteToken) {
      try {
        await inviteService.acceptInvite(input.inviteToken, user.id);
      } catch {
        // Don't fail registration if invite acceptance fails
      }
    }

    const accessToken = app.jwt.sign(
      { userId: user.id },
      { expiresIn: config.JWT_EXPIRES_IN }
    );
    const refreshToken = app.jwt.sign(
      { userId: user.id, type: 'refresh' },
      { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
    );

    return reply.status(201).send({
      data: { user, accessToken, refreshToken },
    });
  });

  // Login
  app.post('/auth/login', async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const user = await authService.login(input);

    const accessToken = app.jwt.sign(
      { userId: user.id },
      { expiresIn: config.JWT_EXPIRES_IN }
    );
    const refreshToken = app.jwt.sign(
      { userId: user.id, type: 'refresh' },
      { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
    );

    return { data: { user, accessToken, refreshToken } };
  });

  // Refresh
  app.post('/auth/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    try {
      const decoded = app.jwt.verify<{ userId: string; type: string }>(refreshToken);
      if (decoded.type !== 'refresh') {
        return reply.status(401).send({ error: { code: 'INVALID_TOKEN', message: 'Invalid refresh token' } });
      }

      const accessToken = app.jwt.sign(
        { userId: decoded.userId },
        { expiresIn: config.JWT_EXPIRES_IN }
      );
      const newRefreshToken = app.jwt.sign(
        { userId: decoded.userId, type: 'refresh' },
        { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
      );

      return { data: { accessToken, refreshToken: newRefreshToken } };
    } catch {
      return reply.status(401).send({ error: { code: 'INVALID_TOKEN', message: 'Invalid refresh token' } });
    }
  });

  // Community Register (public, no auth)
  app.post('/auth/community-register', async (request, reply) => {
    const input = communityRegisterSchema.parse(request.body);

    // Verify school exists
    const school = await prisma.school.findUnique({ where: { id: input.schoolId } });
    if (!school) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'School not found' } });
    }

    // Check if user already exists
    let user = await prisma.user.findUnique({ where: { email: input.email } });
    if (user) {
      // Check if already a member of this school
      const existing = await prisma.schoolUser.findUnique({
        where: { schoolId_userId: { schoolId: input.schoolId, userId: user.id } },
      });
      if (existing) {
        return reply.status(400).send({ error: { code: 'ALREADY_MEMBER', message: 'Already a member of this school' } });
      }
    } else {
      // Create user
      const passwordHash = await bcrypt.hash(input.password, 12);
      user = await prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash,
        },
      });
    }

    // Create SchoolUser with COMMUNITY role
    await prisma.schoolUser.create({
      data: {
        schoolId: input.schoolId,
        userId: user.id,
        role: 'COMMUNITY',
      },
    });

    const accessToken = app.jwt.sign(
      { userId: user.id },
      { expiresIn: config.JWT_EXPIRES_IN }
    );
    const refreshToken = app.jwt.sign(
      { userId: user.id, type: 'refresh' },
      { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
    );

    return reply.status(201).send({
      data: {
        user: { id: user.id, email: user.email, name: (user as any).name },
        accessToken,
        refreshToken,
      },
    });
  });

  // Me (protected)
  app.get('/auth/me', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }
    }],
  }, async (request) => {
    const { userId } = request.user as { userId: string };
    const profile = await authService.getProfile(userId);
    return { data: profile };
  });
}
