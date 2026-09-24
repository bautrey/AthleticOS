// backend/src/modules/blackbaud/test-connection.ts
//
// "Does this actually work, and what can you see?" — run after a school connects,
// so their administrator can verify the integration themselves and hand the result
// back to us rather than taking our word for it.
//
// Reads exactly what the pilot asks for and nothing else: athletics teams and the
// school calendar. Rosters are deliberately NOT read here even though the client
// can, because the phase-one ask excludes student records and a verification step
// that quietly pulled them would contradict the thing it exists to demonstrate.
//
// Every call goes through the normal client, so each one lands in the audit trail
// like any other. Running the test is itself something the school can see.

import { getBlackbaudClient } from './client.js';

export interface ConnectionCheck {
  /** What was read, in the school's language rather than ours. */
  label: string;
  endpoint: string;
  ok: boolean;
  /** How many records came back. */
  count?: number;
  /** A few names, so a person can recognise their own data. Never student records. */
  sample?: string[];
  /** Short, safe failure description. Never a raw response body. */
  error?: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  mode: string;
  ranAt: string;
  checks: ConnectionCheck[];
}

/**
 * Reduce a thrown error to something safe to show a school administrator.
 *
 * The SKY client embeds up to 500 characters of response body in its error
 * messages, so the message itself cannot be surfaced. The status code is the part
 * that is both safe and actually useful for diagnosing.
 */
export function describeFailure(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const status = raw.match(/Blackbaud SKY API (\d{3})/)?.[1];
  if (status === '401') return 'Not authorized (401) — the connection may need to be re-authorized.';
  if (status === '403') {
    return 'Forbidden (403) — the connected account does not have permission to read this.';
  }
  if (status === '404') return 'Not found (404) — this endpoint is not available on this environment.';
  if (status) return `Blackbaud returned HTTP ${status}.`;
  if (/schema validation/i.test(raw)) {
    return 'Blackbaud returned data in an unexpected shape.';
  }
  return 'The request did not reach Blackbaud.';
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Run the read-only checks. Never throws: a failed check is a result to display,
 * not an error to swallow or to blow up the request.
 */
export async function testConnection(
  schoolId: string,
  actingUserId?: string | null
): Promise<ConnectionTestResult> {
  const client = getBlackbaudClient(schoolId, actingUserId);
  const checks: ConnectionCheck[] = [];

  try {
    const teams = await client.listTeams();
    checks.push({
      label: 'Athletics teams',
      endpoint: '/school/v1/athletics/teams',
      ok: true,
      count: teams.length,
      sample: teams.slice(0, 5).map((t) => t.name),
    });
  } catch (err) {
    checks.push({
      label: 'Athletics teams',
      endpoint: '/school/v1/athletics/teams',
      ok: false,
      error: describeFailure(err),
    });
  }

  // A fortnight is enough to prove the calendar reads without pulling a year of it.
  const start = new Date();
  const end = new Date(start.getTime() + 14 * 86400000);
  try {
    const events = await client.listMasterCalendarEvents({
      start_date: isoDate(start),
      end_date: isoDate(end),
    });
    checks.push({
      label: 'School calendar (next 14 days)',
      endpoint: '/school/v1/events',
      ok: true,
      count: events.length,
      sample: events.slice(0, 5).map((e) => e.title ?? 'Untitled event'),
    });
  } catch (err) {
    checks.push({
      label: 'School calendar (next 14 days)',
      endpoint: '/school/v1/events',
      ok: false,
      error: describeFailure(err),
    });
  }

  return {
    ok: checks.every((c) => c.ok),
    mode: process.env.BLACKBAUD_MODE ?? 'mock',
    ranAt: new Date().toISOString(),
    checks,
  };
}
