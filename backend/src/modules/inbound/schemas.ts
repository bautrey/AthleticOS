// backend/src/modules/inbound/schemas.ts
//
// The shape of a provider's inbound-email webhook, and the review actions a
// person can take on what it delivered.
//
// The payload schema is deliberately loose about fields we do not read. A
// provider adding a key must not start rejecting a school's schedule, so this
// validates what we depend on and ignores the rest.

import { z } from 'zod';

/** One attachment as the provider describes it in the delivery event. */
export const inboundAttachmentSchema = z.object({
  id: z.string().optional(),
  filename: z.string().optional(),
  content_type: z.string().optional(),
  content_disposition: z.string().optional(),
  /**
   * Some providers inline small attachments as base64. Resend does not - it
   * sends metadata and expects a follow-up call - so this stays optional and the
   * service falls back to fetching.
   */
  content: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
});

export const inboundEmailSchema = z.object({
  /** Provider's message id. Used to make a redelivery idempotent. */
  email_id: z.string().optional(),
  id: z.string().optional(),
  from: z.string(),
  to: z.array(z.string()).default([]),
  cc: z.array(z.string()).default([]),
  bcc: z.array(z.string()).default([]),
  subject: z.string().optional(),
  attachments: z.array(inboundAttachmentSchema).default([]),
});

export const inboundWebhookSchema = z.object({
  type: z.string(),
  created_at: z.string().optional(),
  data: inboundEmailSchema,
});

export type InboundAttachment = z.infer<typeof inboundAttachmentSchema>;
export type InboundEmail = z.infer<typeof inboundEmailSchema>;
export type InboundWebhook = z.infer<typeof inboundWebhookSchema>;

export const reviewQuerySchema = z.object({
  status: z
    .enum(['RECEIVED', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'FAILED'])
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

export const rejectSchema = z.object({
  notes: z.string().max(500).optional(),
});

export type ReviewQuery = z.infer<typeof reviewQuerySchema>;
export type RejectInput = z.infer<typeof rejectSchema>;

/** What review shows about a file before anyone approves it. */
export interface ParseSummary {
  kind: 'SCHOOLDUDE_CALENDAR' | 'UNRECOGNISED';
  /** Rows the parser read. */
  events: number;
  /** Rows it refused, with reasons. Never silently dropped. */
  skipped: number;
  /** Distinct bookings once multi-room rows are collapsed. */
  bookings: number;
  /** Facility double-bookings the file contains. */
  conflicts: number;
  /** Earliest and latest event date in the file, ISO. */
  dateRange: { from: string; to: string } | null;
  /** Room names seen, so a reviewer can spot an unmapped facility. */
  rooms: string[];
}
