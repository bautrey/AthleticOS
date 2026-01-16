// backend/src/server.ts (updated)
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config.js';
import { authRoutes } from './modules/auth/routes.js';
import { schoolsRoutes } from './modules/schools/routes.js';
import { teamsRoutes } from './modules/teams/routes.js';
import { seasonsRoutes } from './modules/seasons/routes.js';
import { facilitiesRoutes } from './modules/facilities/routes.js';
import { gamesRoutes } from './modules/games/routes.js';
import { practicesRoutes } from './modules/practices/routes.js';
import { blockersRoutes } from './modules/blockers/routes.js';
import { conflictsRoutes } from './modules/conflicts/routes.js';
import { AppError } from './common/errors.js';
import { ZodError } from 'zod';

const app = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: config.NODE_ENV !== 'production' ? {
      target: 'pino-pretty',
      options: { colorize: true }
    } : undefined
  }
});

// Error handler
app.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message, details: error.details }
    });
  }
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.flatten() }
    });
  }
  app.log.error(error);
  return reply.status(500).send({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
  });
});

// Plugins
await app.register(cors, { origin: true });
await app.register(jwt, { secret: config.JWT_SECRET });
await app.register(swagger, {
  openapi: { info: { title: 'AthleticOS API', version: '0.1.0' } }
});
await app.register(swaggerUi, { routePrefix: '/docs' });

// Health check
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// API routes
await app.register(async (api) => {
  await api.register(authRoutes);
  await api.register(schoolsRoutes);
  await api.register(teamsRoutes);
  await api.register(seasonsRoutes);
  await api.register(facilitiesRoutes);
  await api.register(gamesRoutes);
  await api.register(practicesRoutes);
  await api.register(blockersRoutes);
  await api.register(conflictsRoutes);
}, { prefix: '/api/v1' });

// Start
const start = async () => {
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log(`Server running at http://localhost:${config.PORT}`);
    console.log(`API docs at http://localhost:${config.PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
