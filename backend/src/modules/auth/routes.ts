// backend/src/modules/auth/routes.ts
import type { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema } from './schemas.js';
import { authService } from './service.js';
import { config } from '../../config.js';

export async function authRoutes(app: FastifyInstance) {
  // Register
  app.post('/auth/register', async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const user = await authService.register(input);

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
