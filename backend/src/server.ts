// backend/src/server.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config.js';

const app = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: config.NODE_ENV !== 'production' ? {
      target: 'pino-pretty',
      options: { colorize: true }
    } : undefined
  }
});

// Plugins
await app.register(cors, { origin: true });
await app.register(jwt, { secret: config.JWT_SECRET });
await app.register(swagger, {
  openapi: {
    info: {
      title: 'AthleticOS API',
      version: '0.1.0'
    }
  }
});
await app.register(swaggerUi, { routePrefix: '/docs' });

// Health check
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

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
