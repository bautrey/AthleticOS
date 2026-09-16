// backend/src/modules/blackbaud/audit.ts
//
// Append-only record of outbound SKY API calls.
//
// Commitment made to TCA in writing: "every call is logged with timestamp,
// endpoint and response code, available to TCA on request." This is that.
//
// Two rules hold it up. Bodies are never recorded, so the trail cannot become a
// second copy of the student data it accounts for. And recording never breaks the
// call it describes - a failure to audit is a problem to report, not a reason to
// fail a roster sync.

import type { ExternalSystem } from '@prisma/client';
import { prisma } from '../../common/db.js';

export interface ApiCallRecord {
  schoolId: string;
  system?: ExternalSystem;
  method: string;
  /** Endpoint path including query string. Never a body. */
  path: string;
  /** HTTP status, or null when no response arrived. */
  status: number | null;
  /** Short failure class when status is null. Never an error message. */
  errorKind?: string | null;
  durationMs: number;
  actingUserId?: string | null;
}

/**
 * Reduce a thrown value to a short, safe class name.
 *
 * Error messages from the SKY client embed up to 500 characters of response body
 * (client.ts builds them that way), so the message itself is exactly what must not
 * be stored. Only the shape of the failure is kept.
 */
export function classifyError(err: unknown): string {
  if (err && typeof err === 'object') {
    const name = (err as { name?: string }).name;
    const code = (err as { code?: string }).code;
    if (code === 'ETIMEDOUT' || name === 'TimeoutError' || name === 'AbortError') return 'timeout';
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ECONNRESET') return 'network';
    if (name === 'TypeError') return 'network';
    if (typeof name === 'string' && name) return name.slice(0, 40);
  }
  return 'unknown';
}

/**
 * Strip a full URL down to path plus query.
 *
 * Callers pass either a bare path or an absolute URL; storing the host repeatedly
 * adds nothing and makes the trail harder to read.
 */
export function toAuditPath(endpointPath: string): string {
  if (!endpointPath.startsWith('http')) return endpointPath.slice(0, 1000);
  try {
    const u = new URL(endpointPath);
    return `${u.pathname}${u.search}`.slice(0, 1000);
  } catch {
    return endpointPath.slice(0, 1000);
  }
}

/**
 * Write one row. Swallows its own failures on purpose.
 *
 * Returns whether the row was written, so a caller that cares (a test, a health
 * check) can tell, without any caller being able to fail because of it.
 */
export async function recordApiCall(record: ApiCallRecord): Promise<boolean> {
  try {
    await prisma.externalApiCall.create({
      data: {
        schoolId: record.schoolId,
        system: record.system ?? 'BLACKBAUD',
        method: record.method,
        path: toAuditPath(record.path),
        status: record.status,
        errorKind: record.errorKind ?? null,
        durationMs: record.durationMs,
        actingUserId: record.actingUserId ?? null,
      },
    });
    return true;
  } catch (err) {
    // Deliberately not rethrown. Surfaced on stderr so a broken audit trail is
    // visible in logs rather than silent, which matters because the trail is a
    // commitment we have made in writing.
    console.error('[audit] failed to record external API call:', classifyError(err));
    return false;
  }
}

export interface ListApiCallsOptions {
  system?: ExternalSystem;
  since?: Date;
  limit?: number;
}

/** Most recent calls first. This is what gets shown to a school on request. */
export async function listApiCalls(schoolId: string, options: ListApiCallsOptions = {}) {
  const { system, since, limit = 100 } = options;
  return prisma.externalApiCall.findMany({
    where: {
      schoolId,
      ...(system ? { system } : {}),
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 500),
  });
}
