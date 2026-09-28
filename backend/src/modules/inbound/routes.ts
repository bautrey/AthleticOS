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
  // Both calls are bounded. A provider that accepts the connection and then
  // stops talking would otherwise hold the webhook handler open indefinitely,
  // and the caller of this endpoint is the internet.
  const listed = await fetch(
    `https://api.resend.com/emails/${encodeURIComponent(emailId)}/attachments`,
    {
      headers: { Authorization: `Bearer ${config.RESEND_API_KEY}` },
      signal: AbortSignal.timeout(15_000),
    }
  );
  if (!listed.ok) throw new Error(`attachment list failed: ${listed.status}`);

  const body = (await listed.json()) as {
    data?: Array<{ id: string; download_url?: string }>;
  };
  // The id, or nothing. Falling back to the first attachment fetched whichever
  // file happened to be listed first - a signature image, say - and stored it
  // as the report the sender never sent.
  const match = (body.data ?? []).find((a) => a.id === attachmentId);
  if (!match?.download_url) throw new Error('no download url for the named attachment');

  const file = await fetch(match.download_url, { signal: AbortSignal.timeout(30_000) });
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

    // A POST with no body, or with no content-type, never reaches the raw parser
    // registered above, so request.body is undefined and calling toString on it
    // threw a 500 - on an endpoint the whole internet can reach, where the answer
    // should be the same 401 every other unsigned request gets. Found by running
    // the merge repro against production, not by a test: every test in the suite
    // sets a content-type, so nothing exercised this.
    const rawBody = request.body;
    if (!Buffer.isBuffer(rawBody)) {
      request.log.warn('inbound webhook called with no parseable body');
      return reply.status(401).send({ error: { message: 'Invalid signature' } });
    }

    const raw = rawBody.toString('utf8');
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
    } catch (err) {
      // Answers 401 for everything, including an expired timestamp, which is
      // svix's replay guard. Failing closed is right: this is the endpoint's
      // only authentication.
      //
      // The LOG distinguishes what 401 cannot. standardwebhooks 1.0.0 parses
      // the payload inside verify(), so a correctly signed body that is not
      // JSON throws here and is answered "Invalid signature" - true of the
      // call, false about the cause, and it would send whoever is debugging it
      // hunting a signing mismatch that does not exist.
      const unparseable = err instanceof SyntaxError;
      request.log.warn(
        unparseable
          ? 'inbound webhook rejected: the body is not JSON. The signature may well have ' +
              'been valid - the verifier parses the payload itself and throws before it can ' +
              'say. Answering 401 regardless, because this endpoint fails closed.'
          : 'inbound webhook signature rejected'
      );
      return reply.status(401).send({ error: { message: 'Invalid signature' } });
    }

    // Cannot throw on the pinned svix line: verify() above already JSON.parsed
    // the same string and would have thrown first. Kept because it is the only
    // thing standing between a future svix 2.x - which returns the raw string
    // and parses nothing - and an unhandled exception on this path.
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
        // The content type came from the mail, so a sender chose it. The
        // disposition below already stops a browser rendering it; nosniff stops
        // one deciding for itself that the bytes are something else.
        .header('X-Content-Type-Options', 'nosniff')
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
