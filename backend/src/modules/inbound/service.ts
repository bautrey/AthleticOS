// backend/src/modules/inbound/service.ts
//
// What happens to a file that arrives for a school.
//
// The shape of the problem: Zephanie sets up a Saved Action in SchoolDude that
// mails the athletic calendar on a schedule. It lands here. We work out which
// school it belongs to, keep the file, read it so a person can see what changed,
// and stop. Approving is a separate, deliberate act.
//
// Stopping is the design, not a missing feature. The last real export held 870
// events across 768 bookings with 39 facility conflicts in it. A pipeline that
// applied that on arrival would rewrite a term of the schedule with nobody having
// looked, and the first anyone would know is a coach turning up to a room that is
// no longer theirs.

import { Prisma, type InboundImport, type InboundImportStatus } from '@prisma/client';
import { prisma } from '../../common/db.js';
import { NotFoundError, ValidationError } from '../../common/errors.js';
import { config } from '../../config.js';
import { parseSchoolDudeCalendar } from '../import/schooldude-parse.js';
import { groupBookings, findRoomConflicts } from '../import/schooldude-transform.js';
import { generateInboundToken, inboundAddress, tokensFromRecipients } from './address.js';
import type { InboundEmail, ParseSummary, ReviewQuery } from './schemas.js';

/** Why a delivery was not stored. Never carries provider text verbatim. */
export type RejectionReason =
  | 'no-matching-school'
  | 'no-attachment'
  | 'too-large'
  | 'sender-not-allowed';

export interface IngestOutcome {
  stored: boolean;
  importId?: string;
  /** True when this exact message was already stored, i.e. a provider retry. */
  duplicate?: boolean;
  reason?: RejectionReason;
}

/** Fetches an attachment's bytes. Injected so tests never reach the network. */
export type AttachmentFetcher = (
  emailId: string,
  attachmentId: string
) => Promise<Buffer>;

export const inboundService = {
  /** The address this school's reports should be sent to, minting one if needed. */
  async addressFor(schoolId: string): Promise<{ address: string; token: string }> {
    const school = await prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      select: { inboundToken: true },
    });
    if (school.inboundToken) {
      return { address: inboundAddress(school.inboundToken), token: school.inboundToken };
    }

    const token = generateInboundToken();
    await prisma.school.update({ where: { id: schoolId }, data: { inboundToken: token } });
    return { address: inboundAddress(token), token };
  },

  /**
   * Replace a school's inbound address.
   *
   * The old address stops resolving immediately, which is the point: if an
   * address leaks, rotating it is the fix, and anything still sending to the old
   * one has to be repointed.
   */
  async rotateAddress(schoolId: string): Promise<{ address: string; token: string }> {
    const token = generateInboundToken();
    await prisma.school.update({ where: { id: schoolId }, data: { inboundToken: token } });
    return { address: inboundAddress(token), token };
  },

  /**
   * Take one delivered message.
   *
   * Never throws for anything a sender controls. A message we cannot place, or
   * that carries nothing we can read, is declined quietly - the provider gets a
   * 200 either way, because retrying it would not help and a 500 makes the
   * provider hammer us for a message that will never succeed.
   */
  async ingest(email: InboundEmail, fetchAttachment: AttachmentFetcher): Promise<IngestOutcome> {
    const providerMessageId = email.email_id ?? email.id ?? null;

    // Providers retry. The unique index is the real guard, but checking first
    // avoids doing the attachment fetch again for a message we already hold.
    if (providerMessageId) {
      const existing = await prisma.inboundImport.findUnique({
        where: { providerMessageId },
        select: { id: true },
      });
      if (existing) return { stored: true, importId: existing.id, duplicate: true };
    }

    const tokens = tokensFromRecipients([...email.to, ...email.cc, ...email.bcc]);
    const school = tokens.length
      ? await prisma.school.findFirst({
          where: { inboundToken: { in: tokens } },
          select: { id: true, inboundToken: true },
        })
      : null;
    // An address we do not recognise is the ordinary case for stray mail. There is
    // no school to attribute it to, so there is nowhere to record it either.
    if (!school) return { stored: false, reason: 'no-matching-school' };

    const matchedToken = school.inboundToken!;
    const attachment = pickAttachment(email);
    if (!attachment) {
      await this.recordFailure(school.id, email, matchedToken, providerMessageId, 'no-attachment');
      return { stored: true, reason: 'no-attachment' };
    }

    let content: Buffer;
    try {
      content = attachment.content
        ? Buffer.from(attachment.content, 'base64')
        : await fetchAttachment(providerMessageId ?? '', attachment.id ?? '');
    } catch {
      await this.recordFailure(
        school.id,
        email,
        matchedToken,
        providerMessageId,
        'could not retrieve the attachment from the mail provider'
      );
      return { stored: true, reason: 'no-attachment' };
    }

    if (content.byteLength > config.INBOUND_MAX_BYTES) {
      await this.recordFailure(school.id, email, matchedToken, providerMessageId, 'too-large');
      return { stored: true, reason: 'too-large' };
    }

    const summary = summarise(content, attachment.filename ?? null);

    const created = await prisma.inboundImport.create({
      data: {
        schoolId: school.id,
        source: 'EMAIL',
        fromAddress: email.from.slice(0, 320),
        toAddress: inboundAddress(matchedToken),
        subject: email.subject?.slice(0, 500) ?? null,
        providerMessageId,
        filename: attachment.filename?.slice(0, 255) ?? null,
        contentType: attachment.content_type?.slice(0, 255) ?? null,
        sizeBytes: content.byteLength,
        content,
        status: summary ? 'NEEDS_REVIEW' : 'FAILED',
        parseSummary: (summary ?? undefined) as Prisma.InputJsonValue | undefined,
        failureReason: summary ? null : 'could not read this file as a SchoolDude calendar export',
      },
      select: { id: true },
    });

    return { stored: true, importId: created.id };
  },

  /** Store a delivery we could place but could not use, so the school can see it arrived. */
  async recordFailure(
    schoolId: string,
    email: InboundEmail,
    token: string,
    providerMessageId: string | null,
    reason: string
  ): Promise<void> {
    await prisma.inboundImport.create({
      data: {
        schoolId,
        source: 'EMAIL',
        fromAddress: email.from.slice(0, 320),
        toAddress: inboundAddress(token),
        subject: email.subject?.slice(0, 500) ?? null,
        providerMessageId,
        status: 'FAILED',
        failureReason: reason.slice(0, 500),
      },
    });
  },

  /** The queue, newest first. Never returns file bytes. */
  async list(schoolId: string, query: ReviewQuery) {
    const where = { schoolId, ...(query.status ? { status: query.status } : {}) };
    const [rows, total] = await Promise.all([
      prisma.inboundImport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: listFields,
      }),
      prisma.inboundImport.count({ where }),
    ]);
    return {
      data: rows,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },

  async getById(schoolId: string, id: string) {
    const row = await prisma.inboundImport.findFirst({
      where: { id, schoolId },
      select: listFields,
    });
    if (!row) throw new NotFoundError('InboundImport', id);
    return row;
  },

  /** The stored file, for download. Separate from getById so bytes are never incidental. */
  async getContent(schoolId: string, id: string) {
    const row = await prisma.inboundImport.findFirst({
      where: { id, schoolId },
      select: { filename: true, contentType: true, content: true },
    });
    if (!row?.content) throw new NotFoundError('InboundImport content', id);
    return row;
  },

  /**
   * Approve a file.
   *
   * Records the decision and who made it. Applying the contents to the schedule
   * is not wired yet: the mapping from SchoolDude room names to AthleticOS
   * facilities does not exist, and without it an apply would invent facilities.
   * Approving therefore means "this file is good", and the apply step lands with
   * the facility mapper.
   */
  async approve(schoolId: string, id: string, userId: string) {
    const row = await this.getById(schoolId, id);
    if (row.status !== 'NEEDS_REVIEW') {
      throw new ValidationError(`Cannot approve an import that is ${row.status}`);
    }
    return prisma.inboundImport.update({
      where: { id },
      data: { status: 'APPROVED', reviewedBy: userId, reviewedAt: new Date() },
      select: listFields,
    });
  },

  async reject(schoolId: string, id: string, userId: string, notes?: string) {
    const row = await this.getById(schoolId, id);
    if (row.status !== 'NEEDS_REVIEW') {
      throw new ValidationError(`Cannot reject an import that is ${row.status}`);
    }
    return prisma.inboundImport.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes: notes?.slice(0, 500) ?? null,
      },
      select: listFields,
    });
  },
};

/** Everything except the file bytes. */
const listFields = {
  id: true,
  schoolId: true,
  source: true,
  fromAddress: true,
  toAddress: true,
  subject: true,
  filename: true,
  contentType: true,
  sizeBytes: true,
  status: true,
  parseSummary: true,
  failureReason: true,
  reviewedBy: true,
  reviewedAt: true,
  reviewNotes: true,
  createdAt: true,
} satisfies Prisma.InboundImportSelect;

export type InboundImportRow = Pick<InboundImport, keyof typeof listFields>;
export type { InboundImportStatus };

/**
 * The attachment worth keeping.
 *
 * A Saved Action carries one report, but mail picks up passengers: signature
 * images, calendar invites, the sender's logo. Inline parts are skipped by
 * disposition, and the largest remaining file wins, because among a report and a
 * logo the report is the big one.
 */
function pickAttachment(email: InboundEmail) {
  const candidates = email.attachments.filter(
    (a) => (a.content_disposition ?? 'attachment').toLowerCase() !== 'inline'
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((best, a) => ((a.size ?? 0) > (best.size ?? 0) ? a : best));
}

/**
 * Read the file well enough for somebody to decide about it.
 *
 * Returns null when it is not something we recognise, which is a fact to show the
 * reviewer rather than an error - a school mailing us the wrong report should see
 * "we could not read this", not silence.
 */
export function summarise(content: Buffer, filename: string | null): ParseSummary | null {
  // The SchoolDude parser reads `pdftotext -layout` output, so only the text form
  // is understood here. A PDF or an Excel file is stored and shown as
  // unrecognised until the converter for it exists.
  const looksText =
    filename === null ||
    /\.(txt|text)$/i.test(filename) ||
    !/\.(pdf|xlsx?|docx?)$/i.test(filename);
  if (!looksText) return null;

  let text: string;
  try {
    text = content.toString('utf8');
  } catch {
    return null;
  }
  if (!text.includes('Schedule ID') && !text.includes('Count of Events')) return null;

  const { events, skipped } = parseSchoolDudeCalendar(text);
  if (events.length === 0) return null;

  const bookings = groupBookings(events);
  const dates = events.map((e) => e.date).sort();

  return {
    kind: 'SCHOOLDUDE_CALENDAR',
    events: events.length,
    skipped: skipped.length,
    bookings: bookings.length,
    conflicts: findRoomConflicts(bookings).length,
    dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
    rooms: [...new Set(events.map((e) => e.room).filter((r): r is string => Boolean(r)))].sort(),
  };
}
