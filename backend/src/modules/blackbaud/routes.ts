// backend/src/modules/blackbaud/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, MANAGEMENT } from '../../common/middleware/auth.js';
import { config } from '../../config.js';
import { prisma } from '../../common/db.js';
import { ForbiddenError } from '../../common/errors.js';
import { blackbaudService } from './service.js';
import {
  oauthCallbackQuerySchema,
  connectQuerySchema,
  statusQuerySchema,
  disconnectBodySchema,
} from './schemas.js';

/**
 * Authenticated routes (mounted under /api/v1).
 * Connect / status / disconnect — all require an admin (or AD) on the school.
 */
export async function blackbaudRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Build & return the Blackbaud authorize URL for a given school.
  app.get('/blackbaud/connect', async (request, reply) => {
    const { schoolId, redirect } = connectQuerySchema.parse(request.query);
    const { userId } = request.user as { userId: string };

    // Manual ACL check — middleware route param helper expects schoolId in :params.
    const su = await prisma.schoolUser.findUnique({
      where: { schoolId_userId: { schoolId, userId } },
    });
    if (!su || !MANAGEMENT.includes(su.role as any)) {
      throw new ForbiddenError('Only school admins/ADs can connect Blackbaud');
    }

    const url = blackbaudService.buildAuthorizeUrl(schoolId);
    if (redirect) {
      return reply.redirect(url);
    }
    return { data: { authorizeUrl: url } };
  });

  // Connection status for a school.
  app.get('/blackbaud/status', async (request) => {
    const { schoolId } = statusQuerySchema.parse(request.query);
    const { userId } = request.user as { userId: string };

    const su = await prisma.schoolUser.findUnique({
      where: { schoolId_userId: { schoolId, userId } },
    });
    if (!su) {
      throw new ForbiddenError('Not a member of this school');
    }
    const status = await blackbaudService.getStatus(schoolId);
    return { data: status };
  });

  // Disconnect (drops the BlackbaudConnection row).
  app.post('/blackbaud/disconnect', async (request, reply) => {
    const { schoolId } = disconnectBodySchema.parse(request.body);
    const { userId } = request.user as { userId: string };

    const su = await prisma.schoolUser.findUnique({
      where: { schoolId_userId: { schoolId, userId } },
    });
    if (!su || !MANAGEMENT.includes(su.role as any)) {
      throw new ForbiddenError('Only school admins/ADs can disconnect Blackbaud');
    }
    await blackbaudService.disconnect(schoolId);
    return reply.status(204).send();
  });
}

/**
 * OAuth callback — registered at root (NOT under /api/v1) because the redirect URI
 * registered with Blackbaud is `/auth/blackbaud/callback` on the API host.
 */
export async function blackbaudCallbackRoutes(app: FastifyInstance) {
  app.get('/auth/blackbaud/callback', async (request, reply) => {
    const query = oauthCallbackQuerySchema.parse(request.query);

    // Always verify state first — if it's bogus we don't even acknowledge the error.
    const statePayload = blackbaudService.verifyStateToken(query.state);

    // User denied or Blackbaud returned an error — bounce them back to the integrations page
    // with the error in the query string. Don't expose internal details.
    if (query.error) {
      const target = new URL('/settings/integrations', config.APP_URL);
      target.searchParams.set('blackbaud', 'error');
      target.searchParams.set('reason', query.error);
      return reply.redirect(target.toString());
    }

    if (!query.code) {
      const target = new URL('/settings/integrations', config.APP_URL);
      target.searchParams.set('blackbaud', 'error');
      target.searchParams.set('reason', 'missing_code');
      return reply.redirect(target.toString());
    }

    // Exchange code for tokens, persist, redirect.
    try {
      const tokens = await blackbaudService.exchangeCodeForTokens(query.code);
      await blackbaudService.saveConnection(statePayload.schoolId, tokens);
    } catch (err) {
      app.log.error({ err }, 'Blackbaud OAuth callback failed');
      const target = new URL('/settings/integrations', config.APP_URL);
      target.searchParams.set('blackbaud', 'error');
      target.searchParams.set('reason', 'exchange_failed');
      return reply.redirect(target.toString());
    }

    const target = new URL('/settings/integrations', config.APP_URL);
    target.searchParams.set('blackbaud', 'connected');
    return reply.redirect(target.toString());
  });
}
