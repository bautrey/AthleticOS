// backend/src/modules/inbound/service.test.ts
//
// Uses a real database per the NO MOCKS policy. The attachment fetch is injected,
// because the alternative is reaching a mail provider from the test suite.
//
// Two properties carry the weight here. A file never reaches a schedule without
// somebody approving it, and a message we cannot attribute to a school is not
// stored against a guess.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { prisma } from '../../common/db.js';
import { config } from '../../config.js';
import { inboundService, summarise, type AttachmentFetcher } from './service.js';
import { inboundAddress } from './address.js';
import type { InboundEmail } from './schemas.js';

const here = dirname(fileURLToPath(import.meta.url));
const CALENDAR = readFileSync(
  resolve(here, '../import/fixtures/schooldude-calendar-2026-fall.txt')
);

let schoolId: string;
let otherSchoolId: string;
let token: string;
let userId: string;

/** Never called unless a test means for the attachment to be fetched. */
const noFetch: AttachmentFetcher = async () => {
  throw new Error('attachment fetch should not have been attempted');
};

const servesCalendar: AttachmentFetcher = async () => CALENDAR;

function message(overrides: Partial<InboundEmail> = {}): InboundEmail {
  return {
    email_id: `msg-${Math.random().toString(36).slice(2)}`,
    from: 'zdykes@trinitychristian.org',
    to: [inboundAddress(token)],
    cc: [],
    bcc: [],
    subject: 'Athletic Calendar',
    attachments: [
      {
        id: 'att-1',
        filename: 'athletic-calendar.txt',
        content_type: 'text/plain',
        size: CALENDAR.byteLength,
      },
    ],
    ...overrides,
  };
}

describe('inbound imports', () => {
  beforeAll(async () => {
    await prisma.$connect();
    const school = await prisma.school.create({
      data: { name: `Inbound Test ${Date.now()}`, timezone: 'America/Chicago' },
    });
    schoolId = school.id;
    const other = await prisma.school.create({
      data: { name: `Inbound Other ${Date.now()}`, timezone: 'America/Chicago' },
    });
    otherSchoolId = other.id;

    const user = await prisma.user.create({
      data: { email: `inbound-${Date.now()}@test.com`, passwordHash: 'x' },
    });
    userId = user.id;

    token = (await inboundService.addressFor(schoolId)).token;
  });

  beforeEach(async () => {
    await prisma.inboundImport.deleteMany({ where: { schoolId: { in: [schoolId, otherSchoolId] } } });
  });

  afterAll(async () => {
    await prisma.inboundImport.deleteMany({ where: { schoolId: { in: [schoolId, otherSchoolId] } } });
    await prisma.school.deleteMany({ where: { id: { in: [schoolId, otherSchoolId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  describe('addressFor', () => {
    it('mints a token once and keeps returning it', async () => {
      const first = await inboundService.addressFor(schoolId);
      const second = await inboundService.addressFor(schoolId);
      expect(second.token).toBe(first.token);
      expect(first.address).toBe(`${first.token}@${config.INBOUND_EMAIL_DOMAIN}`);
    });

    it('gives different schools different addresses', async () => {
      const mine = await inboundService.addressFor(schoolId);
      const theirs = await inboundService.addressFor(otherSchoolId);
      expect(theirs.token).not.toBe(mine.token);
    });

    it('rotation stops the old address resolving', async () => {
      const before = await inboundService.addressFor(otherSchoolId);
      const after = await inboundService.rotateAddress(otherSchoolId);
      expect(after.token).not.toBe(before.token);

      const stale = await inboundService.ingest(
        message({ to: [inboundAddress(before.token)] }),
        servesCalendar
      );
      expect(stale.stored).toBe(false);
      expect(stale.reason).toBe('no-matching-school');
    });
  });

  describe('ingest', () => {
    it('stores a recognised calendar for review and applies nothing', async () => {
      const outcome = await inboundService.ingest(message(), servesCalendar);
      expect(outcome.stored).toBe(true);

      const row = await prisma.inboundImport.findUniqueOrThrow({
        where: { id: outcome.importId! },
      });
      expect(row.schoolId).toBe(schoolId);
      expect(row.status).toBe('NEEDS_REVIEW');
      expect(row.reviewedBy).toBeNull();
      expect(row.content?.byteLength).toBe(CALENDAR.byteLength);

      // Nothing was written to the schedule.
      expect(await prisma.game.count({ where: { season: { team: { schoolId } } } })).toBe(0);
      expect(await prisma.practice.count({ where: { season: { team: { schoolId } } } })).toBe(0);
    });

    it('summarises the file so a reviewer can see what is in it', async () => {
      const outcome = await inboundService.ingest(message(), servesCalendar);
      const row = await prisma.inboundImport.findUniqueOrThrow({
        where: { id: outcome.importId! },
      });
      // The same numbers the parser suite pins against this export.
      expect(row.parseSummary).toMatchObject({
        kind: 'SCHOOLDUDE_CALENDAR',
        events: 870,
        skipped: 0,
        bookings: 768,
        conflicts: 39,
        // The last event in the file, not the 12-31 the report header declares as
        // its query window. Measured, not taken from the header.
        dateRange: { from: '2026-09-01', to: '2026-12-18' },
      });
    });

    it('REFUSES a message addressed to a token we do not know', async () => {
      // The address is the credential. An unknown one is not attributed to any
      // school, so a stranger cannot put a file in anyone's queue.
      const outcome = await inboundService.ingest(
        message({ to: ['0123456789abcdefghjk@' + config.INBOUND_EMAIL_DOMAIN] }),
        noFetch
      );
      expect(outcome).toMatchObject({ stored: false, reason: 'no-matching-school' });
      // Scoped to the schools this file owns. A global count reads rows created
      // by test files running in parallel.
      expect(
        await prisma.inboundImport.count({ where: { schoolId: { in: [schoolId, otherSchoolId] } } })
      ).toBe(0);
    });

    it('refuses a message addressed at a domain that is not ours', async () => {
      const outcome = await inboundService.ingest(
        message({ to: [`${token}@evil.com`] }),
        noFetch
      );
      expect(outcome).toMatchObject({ stored: false, reason: 'no-matching-school' });
    });

    it('resolves the school when our address is only in Cc', async () => {
      const outcome = await inboundService.ingest(
        message({ to: ['truman@trinitychristian.org'], cc: [inboundAddress(token)] }),
        servesCalendar
      );
      expect(outcome.stored).toBe(true);
    });

    it('stores one row when the provider delivers the same message twice', async () => {
      // Providers retry. A retry must not become a second import for the AD to
      // review, or a second copy of a term's schedule to apply.
      const msg = message();
      const first = await inboundService.ingest(msg, servesCalendar);
      const second = await inboundService.ingest(msg, noFetch);

      expect(second).toMatchObject({ stored: true, duplicate: true, importId: first.importId });
      expect(await prisma.inboundImport.count({ where: { schoolId } })).toBe(1);
    });

    it('records a message that carried nothing to read', async () => {
      // The school should see that mail arrived and was useless, not silence.
      const outcome = await inboundService.ingest(message({ attachments: [] }), noFetch);
      expect(outcome).toMatchObject({ stored: true, reason: 'no-attachment' });

      const row = await prisma.inboundImport.findFirstOrThrow({ where: { schoolId } });
      expect(row.status).toBe('FAILED');
      expect(row.failureReason).toBe('no-attachment');
    });

    it('skips inline parts and takes the real report', async () => {
      // Signature images ride along on ordinary mail.
      const outcome = await inboundService.ingest(
        message({
          attachments: [
            { id: 'sig', filename: 'logo.png', content_disposition: 'inline', size: 9_000_000 },
            { id: 'att-1', filename: 'calendar.txt', size: CALENDAR.byteLength },
          ],
        }),
        servesCalendar
      );
      const row = await prisma.inboundImport.findUniqueOrThrow({
        where: { id: outcome.importId! },
      });
      expect(row.filename).toBe('calendar.txt');
    });

    it('refuses a file larger than the cap instead of storing it', async () => {
      const huge = Buffer.alloc(config.INBOUND_MAX_BYTES + 1);
      const outcome = await inboundService.ingest(message(), async () => huge);
      expect(outcome).toMatchObject({ stored: true, reason: 'too-large' });

      const row = await prisma.inboundImport.findFirstOrThrow({ where: { schoolId } });
      expect(row.status).toBe('FAILED');
      expect(row.content).toBeNull();
    });

    it('keeps a file it cannot read, marked as unreadable', async () => {
      const outcome = await inboundService.ingest(
        message({ attachments: [{ id: 'a', filename: 'notes.txt', size: 12 }] }),
        async () => Buffer.from('just some text')
      );
      const row = await prisma.inboundImport.findUniqueOrThrow({
        where: { id: outcome.importId! },
      });
      expect(row.status).toBe('FAILED');
      expect(row.failureReason).toMatch(/could not read/i);
      // Still kept, so somebody can look at what was actually sent.
      expect(row.content).not.toBeNull();
    });

    it('survives the attachment fetch failing', async () => {
      const outcome = await inboundService.ingest(message(), async () => {
        throw new Error('provider 503');
      });
      expect(outcome.stored).toBe(true);

      const row = await prisma.inboundImport.findFirstOrThrow({ where: { schoolId } });
      expect(row.status).toBe('FAILED');
      // The provider's own error text is never repeated back.
      expect(row.failureReason).not.toMatch(/503/);
    });
  });

  describe('review', () => {
    async function pending() {
      const outcome = await inboundService.ingest(message(), servesCalendar);
      return outcome.importId!;
    }

    it('approving records who decided and when', async () => {
      const id = await pending();
      const approved = await inboundService.approve(schoolId, id, userId);
      expect(approved).toMatchObject({ status: 'APPROVED', reviewedBy: userId });
      expect(approved.reviewedAt).toBeInstanceOf(Date);
    });

    it('rejecting keeps the note', async () => {
      const id = await pending();
      const rejected = await inboundService.reject(schoolId, id, userId, 'wrong date range');
      expect(rejected).toMatchObject({ status: 'REJECTED', reviewNotes: 'wrong date range' });
    });

    it('refuses to decide the same import twice', async () => {
      const id = await pending();
      await inboundService.approve(schoolId, id, userId);
      await expect(inboundService.approve(schoolId, id, userId)).rejects.toThrow(/APPROVED/);
      await expect(inboundService.reject(schoolId, id, userId)).rejects.toThrow(/APPROVED/);
    });

    it('will not let one school read or decide another school\'s import', async () => {
      const id = await pending();
      await expect(inboundService.getById(otherSchoolId, id)).rejects.toThrow();
      await expect(inboundService.approve(otherSchoolId, id, userId)).rejects.toThrow();
    });

    it('never returns file bytes in the queue listing', async () => {
      await pending();
      const listed = await inboundService.list(schoolId, { page: 1, limit: 25 });
      expect(listed.data).toHaveLength(1);
      expect(listed.data[0]).not.toHaveProperty('content');
    });

    it('filters by status', async () => {
      const id = await pending();
      await inboundService.reject(schoolId, id, userId);
      expect(
        (await inboundService.list(schoolId, { page: 1, limit: 25, status: 'NEEDS_REVIEW' })).data
      ).toHaveLength(0);
      expect(
        (await inboundService.list(schoolId, { page: 1, limit: 25, status: 'REJECTED' })).data
      ).toHaveLength(1);
    });
  });
});

describe('summarise', () => {
  it('reads the real export', () => {
    const summary = summarise(CALENDAR, 'calendar.txt');
    expect(summary).toMatchObject({ kind: 'SCHOOLDUDE_CALENDAR', events: 870, conflicts: 39 });
    expect(summary!.rooms).toHaveLength(28);
    expect(summary!.rooms).toContain('ATC RM 106 Gym');
  });

  it('declines a format it cannot read rather than guessing', () => {
    // The parser reads `pdftotext -layout` output. A PDF or a spreadsheet is
    // stored and shown as unrecognised until a converter for it exists.
    expect(summarise(CALENDAR, 'calendar.pdf')).toBeNull();
    expect(summarise(CALENDAR, 'calendar.xlsx')).toBeNull();
  });

  it('declines text that is not a SchoolDude export', () => {
    expect(summarise(Buffer.from('Dear Burke, here is the thing.'), 'note.txt')).toBeNull();
    expect(summarise(Buffer.from(''), 'empty.txt')).toBeNull();
  });
});
