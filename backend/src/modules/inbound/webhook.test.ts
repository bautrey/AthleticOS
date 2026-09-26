// backend/src/modules/inbound/webhook.test.ts
//
// Uses a real database per the NO MOCKS policy.
//
// This endpoint is reachable by anyone on the internet and carries no session.
// The signature is the entire authentication, so most of this file is about what
// happens when the signature is wrong, missing, stale, or computed over a body
// that is not quite the one that arrived.
//
// Signatures here are produced by svix's own signer, the same library the route
// verifies with. That proves the wiring - that the route reads the right headers,
// over the raw bytes, and refuses when they do not agree. It does not
// independently re-derive svix's scheme, and it cannot prove Resend signs the way
// svix expects; the first real delivery is what settles that.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { Webhook } from 'svix';
import { prisma } from '../../common/db.js';
import { config } from '../../config.js';
import { AppError } from '../../common/errors.js';
import { inboundWebhookRoutes } from './routes.js';
import { inboundService } from './service.js';
import { inboundAddress } from './address.js';

// A valid svix secret is "whsec_" plus base64. This one is not a credential for
// anything: it exists only so the signer and verifier in this file agree.
const SECRET = 'whsec_' + Buffer.from('inbound-webhook-test-key-not-real').toString('base64');

let app: FastifyInstance;
let schoolId: string;
let token: string;
let originalSecret: string;

function signed(body: unknown, at: Date = new Date()) {
  const payload = JSON.stringify(body);
  const id = `msg_${Math.random().toString(36).slice(2)}`;
  const signature = new Webhook(SECRET).sign(id, at, payload);
  return {
    payload,
    headers: {
      'content-type': 'application/json',
      'svix-id': id,
      'svix-timestamp': Math.floor(at.getTime() / 1000).toString(),
      'svix-signature': signature,
    },
  };
}

function receivedEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: 'email.received',
    data: {
      email_id: `msg-${Math.random().toString(36).slice(2)}`,
      from: 'zdykes@trinitychristian.org',
      to: [inboundAddress(token)],
      subject: 'Athletic Calendar',
      attachments: [],
      ...overrides,
    },
  };
}

describe('inbound email webhook', () => {
  beforeAll(async () => {
    await prisma.$connect();
    originalSecret = config.INBOUND_WEBHOOK_SECRET;
    // config is parsed once at import; the route reads it at request time.
    (config as { INBOUND_WEBHOOK_SECRET: string }).INBOUND_WEBHOOK_SECRET = SECRET;

    const school = await prisma.school.create({
      data: { name: `Webhook Test ${Date.now()}`, timezone: 'America/Chicago' },
    });
    schoolId = school.id;
    token = (await inboundService.addressFor(schoolId)).token;

    app = Fastify();
    app.setErrorHandler((error, _request, reply) => {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: { message: error.message } });
      }
      return reply.status(500).send({ error: { message: 'boom' } });
    });
    await app.register(inboundWebhookRoutes);
    await app.ready();
  });

  beforeEach(async () => {
    await prisma.inboundImport.deleteMany({ where: { schoolId } });
  });

  afterAll(async () => {
    (config as { INBOUND_WEBHOOK_SECRET: string }).INBOUND_WEBHOOK_SECRET = originalSecret;
    await prisma.inboundImport.deleteMany({ where: { schoolId } });
    await prisma.school.deleteMany({ where: { id: schoolId } });
    await app.close();
    await prisma.$disconnect();
  });

  async function post(headers: Record<string, string>, payload: string) {
    return app.inject({ method: 'POST', url: '/webhooks/inbound-email', headers, payload });
  }

  describe('refusing what it should refuse', () => {
    it('rejects a request with no signature headers at all', async () => {
      const res = await post(
        { 'content-type': 'application/json' },
        JSON.stringify(receivedEvent())
      );
      expect(res.statusCode).toBe(401);
      expect(await prisma.inboundImport.count({ where: { schoolId } })).toBe(0);
    });

    it('rejects a forged signature', async () => {
      const { payload, headers } = signed(receivedEvent());
      const res = await post(
        { ...headers, 'svix-signature': 'v1,' + Buffer.from('nope').toString('base64') },
        payload
      );
      expect(res.statusCode).toBe(401);
      expect(await prisma.inboundImport.count({ where: { schoolId } })).toBe(0);
    });

    it('rejects a signature made with a different secret', async () => {
      const other = 'whsec_' + Buffer.from('a completely different key here').toString('base64');
      const payload = JSON.stringify(receivedEvent());
      const id = 'msg_other';
      const at = new Date();
      const res = await post(
        {
          'content-type': 'application/json',
          'svix-id': id,
          'svix-timestamp': Math.floor(at.getTime() / 1000).toString(),
          'svix-signature': new Webhook(other).sign(id, at, payload),
        },
        payload
      );
      expect(res.statusCode).toBe(401);
    });

    it('REJECTS a body altered after signing', async () => {
      // The reason the route parses the body as a raw buffer. Fastify's default
      // JSON parser would hand the verifier a re-serialised object, and a
      // signature over that is not a signature over what arrived.
      const { payload, headers } = signed(receivedEvent());
      // Same length, so the verifier is catching changed content rather than a
      // changed Content-Length.
      const tampered = payload.replace('zdykes', 'attack');
      expect(tampered).not.toBe(payload);
      expect(tampered.length).toBe(payload.length);

      const res = await post(headers, tampered);
      expect(res.statusCode).toBe(401);
      expect(await prisma.inboundImport.count({ where: { schoolId } })).toBe(0);
    });

    it('rejects a replay of an old delivery', async () => {
      // svix refuses a timestamp outside its tolerance window, which is what
      // stops a captured request being resent later.
      const { payload, headers } = signed(receivedEvent(), new Date(Date.now() - 60 * 60 * 1000));
      const res = await post(headers, payload);
      expect(res.statusCode).toBe(401);
    });

    it('refuses everything when no secret is configured', async () => {
      // An unset secret must not degrade into accepting unsigned traffic, which
      // would leave an open write endpoint on the internet.
      (config as { INBOUND_WEBHOOK_SECRET: string }).INBOUND_WEBHOOK_SECRET = '';
      try {
        const { payload, headers } = signed(receivedEvent());
        const res = await post(headers, payload);
        expect(res.statusCode).toBe(503);
        expect(await prisma.inboundImport.count({ where: { schoolId } })).toBe(0);
      } finally {
        (config as { INBOUND_WEBHOOK_SECRET: string }).INBOUND_WEBHOOK_SECRET = SECRET;
      }
    });
  });

  describe('accepting what it should accept', () => {
    it('takes a properly signed delivery', async () => {
      const { payload, headers } = signed(receivedEvent());
      const res = await post(headers, payload);
      expect(res.statusCode).toBe(200);

      const row = await prisma.inboundImport.findFirstOrThrow({ where: { schoolId } });
      // No attachment on this event, so it is recorded as arrived and unusable.
      expect(row.status).toBe('FAILED');
      expect(row.fromAddress).toBe('zdykes@trinitychristian.org');
    });

    it('acknowledges an event type it does not handle without storing anything', async () => {
      const { payload, headers } = signed({ type: 'email.delivered', data: receivedEvent().data });
      const res = await post(headers, payload);
      expect(res.statusCode).toBe(202);
      expect(await prisma.inboundImport.count({ where: { schoolId } })).toBe(0);
    });

    it('acknowledges a signed payload whose shape it does not know', async () => {
      // Signed by the provider, so this is a schema change rather than an
      // attack. Retrying will not make it parse, so do not ask them to.
      const { payload, headers } = signed({ type: 'email.received', data: { nonsense: true } });
      const res = await post(headers, payload);
      expect(res.statusCode).toBe(202);
      expect(res.json().data.accepted).toBe(false);
    });

    it('answers 200 for mail addressed to nobody we know, and stores nothing', async () => {
      // A 500 here would make the provider retry a message that can never
      // succeed. There is also no school to attribute it to, so nothing is kept.
      const { payload, headers } = signed(
        receivedEvent({ to: [`0123456789abcdefghjk@${config.INBOUND_EMAIL_DOMAIN}`] })
      );
      const res = await post(headers, payload);
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toMatchObject({ stored: false, reason: 'no-matching-school' });
      // Scoped to this school, not a global count: vitest runs test files in
      // parallel and another file's fixtures would make a global count flaky.
      expect(await prisma.inboundImport.count({ where: { schoolId } })).toBe(0);
    });
  });
});
