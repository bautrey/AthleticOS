// backend/src/modules/blackbaud/client.test.ts
// Mock client returns shape-stable fixtures; live client builds correct URL + headers,
// parses through Zod schemas, and recovers from a 401 by refreshing then retrying once.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MockBlackbaudSkyClient,
  LiveBlackbaudSkyClient,
  SKY_API_BASE_URL,
} from './client.js';
import { blackbaudService } from './service.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('MockBlackbaudSkyClient', () => {
  const client = new MockBlackbaudSkyClient();

  it('listTeams returns multiple TCA teams with sport object', async () => {
    const teams = await client.listTeams();
    expect(teams.length).toBeGreaterThanOrEqual(3);
    for (const t of teams) {
      expect(typeof t.id).toBe('number');
      expect(t.name).toBeTruthy();
      expect(t.sport).toBeTruthy();
      expect(t.sport.name).toBeTruthy();
    }
  });

  it('getTeamSchedule filters by team_id and excludes practices by default', async () => {
    const schedule = await client.getTeamSchedule(4316267);
    expect(schedule.length).toBeGreaterThan(0);
    for (const e of schedule) {
      expect(e.team_id).toBe(4316267);
      expect(e.practice).not.toBe(true);
      expect(new Date(e.start_time ?? e.game_date ?? 0).toString()).not.toBe('Invalid Date');
    }
  });

  it('getTeamSchedule includes practices when includePractice=true', async () => {
    const withPractice = await client.getTeamSchedule(4316267, { includePractice: true });
    expect(withPractice.some((e) => e.practice === true)).toBe(true);
  });

  it('getTeamRoster returns the roster for a team_id', async () => {
    const roster = await client.getTeamRoster(4316267);
    expect(roster.id).toBe(4316267);
    expect(roster.players.value.length).toBeGreaterThan(0);
    for (const p of roster.players.value) {
      expect(typeof p.id).toBe('number');
      expect(p.first_name).toBeTruthy();
      expect(p.last_name).toBeTruthy();
    }
  });

  it('getTeamRoster returns an empty roster shape for an unknown team', async () => {
    const roster = await client.getTeamRoster(999_999);
    expect(roster.id).toBe(999_999);
    expect(roster.coaches.value).toEqual([]);
    expect(roster.players.value).toEqual([]);
  });

  it('listMasterCalendarEvents filters by date window', async () => {
    const all = await client.listMasterCalendarEvents({
      start_date: '2026-01-01T00:00:00Z',
      end_date: '2026-12-31T23:59:59Z',
    });
    expect(all.length).toBeGreaterThan(0);

    const narrow = await client.listMasterCalendarEvents({
      start_date: '2026-03-01T00:00:00Z',
      end_date: '2026-03-31T23:59:59Z',
    });
    expect(narrow.length).toBeGreaterThan(0);
    expect(narrow.length).toBeLessThanOrEqual(all.length);
    for (const e of narrow) {
      const t = new Date(e.start_date ?? 0).getTime();
      expect(t).toBeGreaterThanOrEqual(new Date('2026-03-01T00:00:00Z').getTime());
      expect(t).toBeLessThanOrEqual(new Date('2026-03-31T23:59:59Z').getTime());
    }
  });

  it('returns empty array when no team matches', async () => {
    const schedule = await client.getTeamSchedule(999_999);
    expect(schedule).toEqual([]);
  });
});

describe('LiveBlackbaudSkyClient', () => {
  let fetchSpy: any;
  let getConnSpy: any;
  let refreshSpy: any;
  let saveSpy: any;

  beforeEach(() => {
    // NOTE: config (incl. BLACKBAUD_SUBSCRIPTION_KEY) is parsed at module import,
    // so we rely on the test runner being launched with that env var set.

    // Stub the connection lookup so we never touch Prisma in this test.
    getConnSpy = vi.spyOn(blackbaudService, 'getConnectionWithFreshToken').mockResolvedValue({
      id: 'conn-1',
      schoolId: 'tca',
      accessToken: 'access-current',
      refreshToken: 'refresh-current',
      expiresAt: new Date(Date.now() + 3600_000),
      tokenType: 'Bearer',
      scope: null,
      environmentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    refreshSpy = vi.spyOn(blackbaudService, 'refreshAccessToken').mockResolvedValue({
      access_token: 'access-refreshed',
      refresh_token: 'refresh-refreshed',
      token_type: 'Bearer',
      expires_in: 3600,
    });
    saveSpy = vi.spyOn(blackbaudService, 'saveConnection').mockResolvedValue({} as any);
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
    getConnSpy.mockRestore();
    refreshSpy.mockRestore();
    saveSpy.mockRestore();
  });

  it('builds correct URL + headers for listTeams', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        count: 1,
        value: [{ id: 1, name: 'T1', sport: { id: 10, name: 'Basketball' } }],
      }) as any
    );

    const client = new LiveBlackbaudSkyClient({ schoolId: 'tca' });
    const teams = await client.listTeams();

    expect(teams).toHaveLength(1);
    expect(teams[0].id).toBe(1);
    expect(teams[0].sport.name).toBe('Basketball');

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${SKY_API_BASE_URL}/school/v1/athletics/teams`);
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get('authorization')).toBe('Bearer access-current');
    // Whatever subscription key is in the env at test launch — non-empty + identifiable.
    expect(headers.get('bb-api-subscription-key')).toBeTruthy();
    expect(headers.get('accept')).toBe('application/json');
  });

  it('appends school_year query param for listTeams when provided', async () => {
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { count: 0, value: [] }) as any);

    const client = new LiveBlackbaudSkyClient({ schoolId: 'tca' });
    await client.listTeams({ schoolYear: '2025-2026' });
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${SKY_API_BASE_URL}/school/v1/athletics/teams?school_year=2025-2026`);
  });

  it('uses /school/v1/athletics/schedules with team_id query for getTeamSchedule', async () => {
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { count: 0, value: [] }) as any);

    const client = new LiveBlackbaudSkyClient({ schoolId: 'tca' });
    await client.getTeamSchedule(4316267, {
      startDate: '2026-03-01T00:00:00Z',
      endDate: '2026-03-31T23:59:59Z',
    });
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toContain(`${SKY_API_BASE_URL}/school/v1/athletics/schedules?`);
    expect(url).toContain('team_id=4316267');
    expect(url).toContain('include_practice=true');
    expect(url).toContain('start_date=2026-03-01');
    expect(url).toContain('end_date=2026-03-31');
  });

  it('passes include_practice=false when caller opts out', async () => {
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { count: 0, value: [] }) as any);

    const client = new LiveBlackbaudSkyClient({ schoolId: 'tca' });
    await client.getTeamSchedule(4316267, { includePractice: false });
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toContain('include_practice=false');
  });

  it('encodes teamId path param for getTeamRoster', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        id: 4316267,
        coaches: { count: 0, value: [] },
        players: { count: 0, value: [] },
      }) as any
    );

    const client = new LiveBlackbaudSkyClient({ schoolId: 'tca' });
    await client.getTeamRoster(4316267);
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${SKY_API_BASE_URL}/school/v1/athletics/teams/4316267/roster`);
  });

  it('POSTs to /school/v1/events/list for master calendar with JSON body', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, []) as any);

    const client = new LiveBlackbaudSkyClient({ schoolId: 'tca' });
    await client.listMasterCalendarEvents({
      start_date: '2026-03-01T00:00:00Z',
      end_date: '2026-03-31T23:59:59Z',
    });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${SKY_API_BASE_URL}/school/v1/events/list`);
    const initObj = init as RequestInit;
    expect(initObj.method).toBe('POST');
    const headers = new Headers(initObj.headers);
    expect(headers.get('content-type')).toBe('application/json');
    const body = JSON.parse(initObj.body as string);
    expect(body.start_date).toBe('2026-03-01T00:00:00Z');
    expect(body.end_date).toBe('2026-03-31T23:59:59Z');
  });

  it('throws a clear schema error when the response shape is unexpected', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        // Wrong shape: id should be number, sport should be object.
        count: 1,
        value: [{ id: 'not-a-number', name: 'T1', sport: 'should-be-object' }],
      }) as any
    );

    const client = new LiveBlackbaudSkyClient({ schoolId: 'tca' });
    await expect(client.listTeams()).rejects.toThrow(/schema validation/i);
  });

  it('on 401, refreshes the token, retries, and succeeds', async () => {
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(401, { error: 'invalid_token' }) as any)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          count: 1,
          value: [{ id: 1, name: 'T1', sport: { id: 10, name: 'Basketball' } }],
        }) as any
      );

    const client = new LiveBlackbaudSkyClient({ schoolId: 'tca' });
    const teams = await client.listTeams();

    expect(teams).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('on persistent 401, throws after one retry', async () => {
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(401, { error: 'invalid_token' }) as any);

    const client = new LiveBlackbaudSkyClient({ schoolId: 'tca' });
    await expect(client.listTeams()).rejects.toThrow(/401/);
    // Should have tried twice: original + 1 retry.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('throws on non-2xx, non-401 status', async () => {
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(500, { error: 'internal' }) as any);

    const client = new LiveBlackbaudSkyClient({ schoolId: 'tca' });
    await expect(client.listTeams()).rejects.toThrow(/500/);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // no retry on 500
  });
});
