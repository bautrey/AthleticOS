// backend/src/modules/blackbaud/client.ts
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config } from '../../config.js';
import { blackbaudService } from './service.js';

// Base URL for SKY API. Same host for both K-12 (Education Edge / EE NXT) and other
// verticals — the path differentiates. We're hitting /school/v1/* per the prep doc.
export const SKY_API_BASE_URL = 'https://api.sky.blackbaud.com';

// ====== Public response shapes ======
// These are intentionally lenient — Blackbaud's public docs aren't 100% pinned for K-12,
// so the live client returns whatever shape Blackbaud sends back.
// TODO: tighten these into Zod schemas once we've seen real live responses from TCA.

export interface SkySchool {
  id: string;
  name: string;
  type?: string;
}

export interface SkyTeam {
  id: string;
  name: string;
  sport: string;
  level?: string;
  active?: boolean;
}

export interface SkyScheduleEntry {
  id: string;
  team_id: string;
  type: 'game' | 'practice' | 'scrimmage';
  opponent?: string;
  start_time: string; // ISO 8601
  end_time?: string;
  location?: string;
  home_away?: 'home' | 'away' | 'neutral';
  status?: string;
}

export interface SkyRosterEntry {
  id: string;
  team_id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  grade?: string;
  jersey_number?: string;
  position?: string;
}

export interface SkyMasterCalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string; // ISO 8601
  end_time: string;
  all_day?: boolean;
  category?: string; // exam, assembly, fine_arts, holiday, in_service, etc.
  location?: string;
}

// ====== Client interface ======

export interface BlackbaudSkyClient {
  listSchools(): Promise<SkySchool[]>;
  listTeams(schoolId: string): Promise<SkyTeam[]>;
  getTeamSchedule(teamId: string): Promise<SkyScheduleEntry[]>;
  getTeamRoster(teamId: string): Promise<SkyRosterEntry[]>;
  listMasterCalendarEvents(startDate: string, endDate: string): Promise<SkyMasterCalendarEvent[]>;
}

// ====== Mock client ======
// Loads JSON fixtures from ./client-fixtures. Same method signatures as live; downstream
// code can build sync/conflict logic against this without needing TCA approval first.

const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'client-fixtures');

async function loadFixture<T>(name: string): Promise<T> {
  const full = path.join(FIXTURES_DIR, name);
  const raw = await readFile(full, 'utf8');
  return JSON.parse(raw) as T;
}

export class MockBlackbaudSkyClient implements BlackbaudSkyClient {
  async listSchools(): Promise<SkySchool[]> {
    return loadFixture<SkySchool[]>('schools.json');
  }
  async listTeams(_schoolId: string): Promise<SkyTeam[]> {
    return loadFixture<SkyTeam[]>('teams.json');
  }
  async getTeamSchedule(teamId: string): Promise<SkyScheduleEntry[]> {
    const all = await loadFixture<SkyScheduleEntry[]>('schedule.json');
    return all.filter((e) => e.team_id === teamId);
  }
  async getTeamRoster(teamId: string): Promise<SkyRosterEntry[]> {
    const all = await loadFixture<SkyRosterEntry[]>('rosters.json');
    return all.filter((e) => e.team_id === teamId);
  }
  async listMasterCalendarEvents(
    startDate: string,
    endDate: string
  ): Promise<SkyMasterCalendarEvent[]> {
    const all = await loadFixture<SkyMasterCalendarEvent[]>('master-calendar.json');
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return all.filter((e) => {
      const eventStart = new Date(e.start_time).getTime();
      return eventStart >= start && eventStart <= end;
    });
  }
}

// ====== Live client ======
// Real fetch against api.sky.blackbaud.com with auth headers + auto-refresh on 401.

interface LiveClientDeps {
  schoolId: string;
}

export class LiveBlackbaudSkyClient implements BlackbaudSkyClient {
  constructor(private deps: LiveClientDeps) {}

  /**
   * Internal fetch helper: builds headers, retries once on 401 with a refreshed token.
   */
  private async request<T>(endpointPath: string, init: RequestInit = {}): Promise<T> {
    return this.requestWithRetry<T>(endpointPath, init, /* allowRetry */ true);
  }

  private async requestWithRetry<T>(
    endpointPath: string,
    init: RequestInit,
    allowRetry: boolean
  ): Promise<T> {
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

    // 401 — token may have been revoked. Force a refresh once and retry.
    if (res.status === 401 && allowRetry) {
      const refreshed = await blackbaudService.refreshAccessToken(conn.refreshToken);
      await blackbaudService.saveConnection(this.deps.schoolId, refreshed);
      return this.requestWithRetry<T>(endpointPath, init, /* allowRetry */ false);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Blackbaud SKY API ${res.status} on ${endpointPath}: ${body.slice(0, 500)}`);
    }

    // Some SKY endpoints return { value: [...] } envelope, others return the bare array/object.
    // Caller handles whatever the live response looks like — see TODOs on each method.
    return (await res.json()) as T;
  }

  async listSchools(): Promise<SkySchool[]> {
    // TODO: verify against live response — not all SKY tenants expose a "schools" list.
    // For K-12 single-tenant we may just return a synthetic single-element list.
    const json = await this.request<{ value?: SkySchool[] } | SkySchool[]>('/school/v1/schools');
    return Array.isArray(json) ? json : json.value ?? [];
  }

  async listTeams(_schoolId: string): Promise<SkyTeam[]> {
    // Per blackbaud-sky-prep.md: GET /school/v1/athletics/teams
    const json = await this.request<{ value?: SkyTeam[] } | SkyTeam[]>(
      '/school/v1/athletics/teams'
    );
    return Array.isArray(json) ? json : json.value ?? [];
  }

  async getTeamSchedule(teamId: string): Promise<SkyScheduleEntry[]> {
    // Per blackbaud-sky-prep.md: GET /school/v1/athletics/teams/{id}/schedule
    // TODO: verify against live response — exact shape of schedule entries depends on EE NXT version.
    const json = await this.request<{ value?: SkyScheduleEntry[] } | SkyScheduleEntry[]>(
      `/school/v1/athletics/teams/${encodeURIComponent(teamId)}/schedule`
    );
    return Array.isArray(json) ? json : json.value ?? [];
  }

  async getTeamRoster(teamId: string): Promise<SkyRosterEntry[]> {
    // Per blackbaud-sky-prep.md: GET /school/v1/athletics/teams/{id}/roster
    const json = await this.request<{ value?: SkyRosterEntry[] } | SkyRosterEntry[]>(
      `/school/v1/athletics/teams/${encodeURIComponent(teamId)}/roster`
    );
    return Array.isArray(json) ? json : json.value ?? [];
  }

  async listMasterCalendarEvents(
    startDate: string,
    endDate: string
  ): Promise<SkyMasterCalendarEvent[]> {
    // Master calendar lives under /school/v1/calendars per blackbaud-sky-prep.md.
    // TODO: verify exact endpoint — Blackbaud SKY exposes both /school/v1/events and
    // /school/v1/calendars/{id}/events. Using the simpler /events with date range filter for now.
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });
    const json = await this.request<
      { value?: SkyMasterCalendarEvent[] } | SkyMasterCalendarEvent[]
    >(`/school/v1/events?${params.toString()}`);
    return Array.isArray(json) ? json : json.value ?? [];
  }
}

// ====== Factory ======

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
