// backend/src/modules/inbound/routes.ts
//
// Two audiences, two very different trust levels, so they are two plugins.
//
// The webhook is reachable by anyone on the internet and carries no session. It
// is authenticated by the provider's signature over the raw body and by nothing
// else. The review routes are ordinary authenticated, role-checked staff routes.

import type { FastifyInstance } from 'fastify';
import { Webhook } from 'svix';
import { authenticate, requireRole, STAFF, MANAGEMENT } from '../../common/middleware/auth.js';
import { config } from '../../config.js';
import { inboundService, type AttachmentFetcher } from './service.js';
import { inboundWebhookSchema, reviewQuerySchema, rejectSchema } from './schemas.js';

/** Pull an attachment's bytes from Resend. Their download links expire in an hour. */
const fetchFromResend: AttachmentFetcher = async (emailId, attachmentId) => {
  const listed = await fetch(
    `https://api.resend.com/emails/${encodeURIComponent(emailId)}/attachments`,
    { headers: { Authorization: `Bearer ${config.RESEND_API_KEY}` } }
  );
  if (!listed.ok) throw new Error(`attachment list failed: ${listed.status}`);

  const body = (await listed.json()) as {
    data?: Array<{ id: string; download_url?: string }>;
  };
  const match = (body.data ?? []).find((a) => a.id === attachmentId) ?? (body.data ?? [])[0];
  if (!match?.download_url) throw new Error('no download url for attachment');

  const file = await fetch(match.download_url);
  if (!file.ok) throw new Error(`attachment download failed: ${file.status}`);
  return Buffer.from(await file.arrayBuffer());
};

/**
 * The provider's delivery webhook. No session, no JWT.
 *
 * Registered as its own plugin so the raw-body content type parser below is
 * scoped to it: Fastify's default JSON parser hands back a parsed object, and a
 * signature computed over a re-serialised object does not match one computed over
 * the bytes that were signed. Key order and whitespace both move.
 */
export async function inboundWebhookRoutes(app: FastifyInstance) {
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body)
  );

  app.post('/webhooks/inbound-email', async (request, reply) => {
    // An unset secret means inbound is not configured. Refuse rather than accept
    // unsigned traffic, because the alternative is an open write endpoint.
    if (!config.INBOUND_WEBHOOK_SECRET) {
      request.log.warn('inbound webhook called with no INBOUND_WEBHOOK_SECRET set');
      return reply.status(503).send({ error: { message: 'Inbound email is not configured' } });
    }

    const raw = (request.body as Buffer).toString('utf8');
    try {
      // The return value is deliberately discarded: svix has returned both the
      // raw string and a parsed object across versions, so the body is parsed
      // below instead of depending on which. What matters is that verify throws
      // when the signature does not match.
      new Webhook(config.INBOUND_WEBHOOK_SECRET).verify(raw, {
        'svix-id': String(request.headers['svix-id'] ?? ''),
        'svix-timestamp': String(request.headers['svix-timestamp'] ?? ''),
        'svix-signature': String(request.headers['svix-signature'] ?? ''),
      });
    } catch {
      // Includes an expired timestamp, which is svix's replay guard.
      request.log.warn('inbound webhook signature rejected');
      return reply.status(401).send({ error: { message: 'Invalid signature' } });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      request.log.warn('inbound webhook body was signed but is not JSON');
      return reply.status(202).send({ data: { accepted: false, reason: 'unparseable body' } });
    }

    const parsed = inboundWebhookSchema.safeParse(payload);
    if (!parsed.success) {
      // Signed by the provider, so this is a shape we do not know rather than an
      // attack. Acknowledge it; retrying will not make it parse.
      request.log.warn({ issues: parsed.error.issues.length }, 'inbound webhook payload not understood');
      return reply.status(202).send({ data: { accepted: false, reason: 'unrecognised payload' } });
    }

    if (!parsed.data.type.startsWith('email.received')) {
      return reply.status(202).send({ data: { accepted: false, reason: 'ignored event type' } });
    }

    const outcome = await inboundService.ingest(parsed.data.data, fetchFromResend);
    if (!outcome.stored) {
      request.log.info({ reason: outcome.reason }, 'inbound message not attributable to a school');
    }
    // Always 200 on a signed message we understood. A 500 makes the provider
    // retry something that will fail identically every time.
    return reply.status(200).send({ data: outcome });
  });
}

/** Staff-facing review queue. */
export async function inboundRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Where this school's reports should be sent. Minted on first ask.
  app.get<{ Params: { schoolId: string } }>(
    '/schools/:schoolId/inbound/address',
    { preHandler: [requireRole(...MANAGEMENT)] },
    async (request) => ({ data: await inboundService.addressFor(request.params.schoolId) })
  );

  // Rotate it. The old address stops working at once, so anything still sending
  // to it has to be repointed - which is the intended cost of a leak.
  app.post<{ Params: { schoolId: string } }>(
    '/schools/:schoolId/inbound/address/rotate',
    { preHandler: [requireRole(...MANAGEMENT)] },
    async (request) => ({ data: await inboundService.rotateAddress(request.params.schoolId) })
  );

  app.get<{ Params: { schoolId: string } }>(
    '/schools/:schoolId/inbound',
    { preHandler: [requireRole(...STAFF)] },
    async (request) =>
      inboundService.list(request.params.schoolId, reviewQuerySchema.parse(request.query))
  );

  app.get<{ Params: { schoolId: string; id: string } }>(
    '/schools/:schoolId/inbound/:id',
    { preHandler: [requireRole(...STAFF)] },
    async (request) => ({
      data: await inboundService.getById(request.params.schoolId, request.params.id),
    })
  );

  // The file as it arrived, so a reviewer can open what we actually received
  // rather than trusting our reading of it.
  app.get<{ Params: { schoolId: string; id: string } }>(
    '/schools/:schoolId/inbound/:id/download',
    { preHandler: [requireRole(...STAFF)] },
    async (request, reply) => {
      const file = await inboundService.getContent(request.params.schoolId, request.params.id);
      return reply
        .header('Content-Type', file.contentType ?? 'application/octet-stream')
        .header(
          'Content-Disposition',
          `attachment; filename="${(file.filename ?? 'import').replace(/[^\w.\-]/g, '_')}"`
        )
        .send(file.content);
    }
  );

  app.post<{ Params: { schoolId: string; id: string } }>(
    '/schools/:schoolId/inbound/:id/approve',
    { preHandler: [requireRole(...MANAGEMENT)] },
    async (request) => {
      const { userId } = request.user as { userId: string };
      return {
        data: await inboundService.approve(request.params.schoolId, request.params.id, userId),
      };
    }
  );

  app.post<{ Params: { schoolId: string; id: string } }>(
    '/schools/:schoolId/inbound/:id/reject',
    { preHandler: [requireRole(...MANAGEMENT)] },
    async (request) => {
      const { userId } = request.user as { userId: string };
      const { notes } = rejectSchema.parse(request.body ?? {});
      return {
        data: await inboundService.reject(
          request.params.schoolId,
          request.params.id,
          userId,
          notes
        ),
      };
    }
  );
}
