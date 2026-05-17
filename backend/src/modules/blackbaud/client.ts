// backend/src/modules/blackbaud/client.ts
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config } from '../../config.js';
import { blackbaudService } from './service.js';
import {
  skyTeamCollectionSchema,
  skyScheduleCollectionSchema,
  skyRosterSchema,
  skyEventSchema,
  type SkyTeam,
  type SkyScheduleEntry,
  type SkyRoster,
  type SkyEvent,
  type SkyEventsListRequest,
} from './client-schemas.js';
import { z } from 'zod';

// Base URL for SKY API. The API gateway routes by path prefix (`school` →
// SKY School product, the K-12 / Education Edge / EE NXT vertical).
// Verified via Azure API Management export: API hostname = api.sky.blackbaud.com,
// API path = "school", urlTemplate = "/v1/...".
export const SKY_API_BASE_URL = 'https://api.sky.blackbaud.com';

// ============ Client interface ============
//
// NOTE: there is intentionally no listSchools() — the SKY School API (Education Edge /
// EE NXT) is single-tenant per app subscription. The operations export contains no
// `/v1/schools` endpoint. Each Blackbaud tenant IS one school; the OAuth tokens
// authorize against that one school. If we ever need to surface "the school" object,
// we'd need to source it from Render env / DB metadata, not a SKY API call.
//
// (In multi-school MMS deployments Blackbaud uses a different auth flow with explicit
// `environment_id` selection — out of scope for TCA's setup.)
export interface BlackbaudSkyClient {
  listTeams(opts?: { schoolYear?: string }): Promise<SkyTeam[]>;
  getTeamSchedule(
    teamId: number,
    opts?: {
      startDate?: string; // ISO 8601 date-time
      endDate?: string;
      includePractice?: boolean; // defaults to true (we want both games + practices)
      schoolYear?: string;
    }
  ): Promise<SkyScheduleEntry[]>;
  getTeamRoster(teamId: number): Promise<SkyRoster>;
  listMasterCalendarEvents(req: SkyEventsListRequest): Promise<SkyEvent[]>;
}

// ============ Mock client ============
// Loads JSON fixtures from ./client-fixtures. Same method signatures + same response
// shapes as live, so downstream sync/conflict/calendar code is mode-agnostic.

const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'client-fixtures');

async function loadFixture<T>(name: string): Promise<T> {
  const full = path.join(FIXTURES_DIR, name);
  const raw = await readFile(full, 'utf8');
  return JSON.parse(raw) as T;
}

export class MockBlackbaudSkyClient implements BlackbaudSkyClient {
  async listTeams(_opts?: { schoolYear?: string }): Promise<SkyTeam[]> {
    return loadFixture<SkyTeam[]>('teams.json');
  }
  async getTeamSchedule(
    teamId: number,
    opts?: {
      startDate?: string;
      endDate?: string;
      includePractice?: boolean;
    }
  ): Promise<SkyScheduleEntry[]> {
    const all = await loadFixture<SkyScheduleEntry[]>('schedule.json');
    let out = all.filter((e) => e.team_id === teamId);
    // Default behavior matches live: if includePractice is unset/false, drop practices.
    if (!opts?.includePractice) {
      out = out.filter((e) => !e.practice);
    }
    if (opts?.startDate) {
      const start = new Date(opts.startDate).getTime();
      out = out.filter((e) => {
        const t = new Date(e.start_time ?? e.game_date ?? 0).getTime();
        return Number.isFinite(t) && t >= start;
      });
    }
    if (opts?.endDate) {
      const end = new Date(opts.endDate).getTime();
      out = out.filter((e) => {
        const t = new Date(e.start_time ?? e.game_date ?? 0).getTime();
        return Number.isFinite(t) && t <= end;
      });
    }
    return out;
  }
  async getTeamRoster(teamId: number): Promise<SkyRoster> {
    const all = await loadFixture<SkyRoster[]>('rosters.json');
    const found = all.find((r) => r.id === teamId);
    if (found) return found;
    // Return an empty roster shape rather than throw — matches what live SKY would return.
    return { id: teamId, coaches: { count: 0, value: [] }, players: { count: 0, value: [] } };
  }
  async listMasterCalendarEvents(req: SkyEventsListRequest): Promise<SkyEvent[]> {
    const all = await loadFixture<SkyEvent[]>('master-calendar.json');
    const start = new Date(req.start_date).getTime();
    const end = new Date(req.end_date).getTime();
    return all.filter((e) => {
      const t = new Date(e.start_date ?? 0).getTime();
      return Number.isFinite(t) && t >= start && t <= end;
    });
  }
}

// ============ Live client ============
// Real fetch against api.sky.blackbaud.com with auth headers + auto-refresh on 401.
// Responses are parsed through Zod so we get a clear error if SKY shifts shape.

interface LiveClientDeps {
  schoolId: string;
}

export class LiveBlackbaudSkyClient implements BlackbaudSkyClient {
  constructor(private deps: LiveClientDeps) {}

  /**
   * Internal fetch helper. Builds auth headers, retries once on 401 with refreshed token,
   * then parses through the supplied Zod schema.
   */
  private async request<T extends z.ZodTypeAny>(
    schema: T,
    endpointPath: string,
    init: RequestInit = {}
  ): Promise<z.infer<T>> {
    const raw = await this.requestRaw(endpointPath, init, /* allowRetry */ true);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Blackbaud SKY response failed schema validation for ${endpointPath}: ` +
          JSON.stringify(parsed.error.issues).slice(0, 800)
      );
    }
    return parsed.data;
  }

  private async requestRaw(
    endpointPath: string,
    init: RequestInit,
    allowRetry: boolean
  ): Promise<unknown> {
    if (!config.BLACKBAUD_SUBSCRIPTION_KEY) {
      throw new Error('BLACKBAUD_SUBSCRIPTION_KEY is not configured');
    }
    const conn = await blackbaudService.getConnectionWithFreshToken(this.deps.schoolId);
    const url = endpointPath.startsWith('http')
      ? endpointPath
      : `${SKY_API_BASE_URL}${endpointPath}`;

    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${conn.accessToken}`);
    headers.set('Bb-Api-Subscription-Key', config.BLACKBAUD_SUBSCRIPTION_KEY);
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');

    const res = await fetch(url, { ...init, headers });

    if (res.status === 401 && allowRetry) {
      const refreshed = await blackbaudService.refreshAccessToken(conn.refreshToken);
      await blackbaudService.saveConnection(this.deps.schoolId, refreshed);
      return this.requestRaw(endpointPath, init, /* allowRetry */ false);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Blackbaud SKY API ${res.status} on ${endpointPath}: ${body.slice(0, 500)}`);
    }

    return res.json();
  }

  async listTeams(opts?: { schoolYear?: string }): Promise<SkyTeam[]> {
    // GET /school/v1/athletics/teams[?school_year=YYYY-YYYY]
    // Verified: V1AthleticsTeamsGet
    const qs = new URLSearchParams();
    if (opts?.schoolYear) qs.set('school_year', opts.schoolYear);
    const path = `/school/v1/athletics/teams${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await this.request(skyTeamCollectionSchema, path);
    return res.value;
  }

  async getTeamSchedule(
    teamId: number,
    opts?: {
      startDate?: string;
      endDate?: string;
      includePractice?: boolean;
      schoolYear?: string;
    }
  ): Promise<SkyScheduleEntry[]> {
    // GET /school/v1/athletics/schedules?team_id=&start_date=&end_date=&include_practice=true
    // Verified: V1AthleticsSchedulesGet. Note this is the FLAT endpoint, NOT
    // /v1/athletics/teams/{id}/schedule (that path exists only for POST/PATCH/DELETE).
    const qs = new URLSearchParams();
    qs.set('team_id', String(teamId));
    qs.set('include_practice', opts?.includePractice === false ? 'false' : 'true');
    if (opts?.startDate) qs.set('start_date', opts.startDate);
    if (opts?.endDate) qs.set('end_date', opts.endDate);
    if (opts?.schoolYear) qs.set('school_year', opts.schoolYear);
    const res = await this.request(
      skyScheduleCollectionSchema,
      `/school/v1/athletics/schedules?${qs.toString()}`
    );
    return res.value;
  }

  async getTeamRoster(teamId: number): Promise<SkyRoster> {
    // GET /school/v1/athletics/teams/{team_id}/roster
    // Verified: V1AthleticsTeamsByTeam_idRosterGet. team_id is integer.
    return this.request(
      skyRosterSchema,
      `/school/v1/athletics/teams/${encodeURIComponent(String(teamId))}/roster`
    );
  }

  async listMasterCalendarEvents(req: SkyEventsListRequest): Promise<SkyEvent[]> {
    // POST /school/v1/events/list (NOT GET — verified V1EventsListPost).
    // GET /v1/events/calendar exists but returns events for the calling user only,
    // which isn't what we want. POST /v1/events/list is the master events query that
    // managers (incl. Athletic Group Manager) can run.
    //
    // Response body: array of event objects (top-level, no envelope) per the example.
    return this.request(z.array(skyEventSchema), '/school/v1/events/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
  }
}

// ============ Factory ============

/**
 * Get a SKY client for the given school. Returns the mock client if BLACKBAUD_MODE=mock,
 * otherwise the live client. Same downstream code regardless of mode.
 */
export function getBlackbaudClient(schoolId: string): BlackbaudSkyClient {
  if (config.BLACKBAUD_MODE === 'mock') {
    return new MockBlackbaudSkyClient();
  }
  return new LiveBlackbaudSkyClient({ schoolId });
}
