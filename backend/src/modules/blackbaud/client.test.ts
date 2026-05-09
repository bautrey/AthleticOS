// backend/src/modules/blackbaud/client.test.ts
// Mock client returns shape-stable fixtures; live client builds correct headers + URL,
// and 401 → refresh → retry happy path works.
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

  it('listSchools returns at least TCA', async () => {
    const schools = await client.listSchools();
    expect(schools.length).toBeGreaterThan(0);
    expect(schools[0]).toMatchObject({ id: expect.any(String), name: expect.any(String) });
    expect(schools.find((s) => /Trinity/i.test(s.name))).toBeTruthy();
  });

  it('listTeams returns multiple TCA teams with sport + level', async () => {
    const teams = await client.listTeams('tca-001');
    expect(teams.length).toBeGreaterThanOrEqual(3);
    for (const t of teams) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.sport).toBeTruthy();
    }
  });

  it('getTeamSchedule filters by team_id', async () => {
    const schedule = await client.getTeamSchedule('bb-team-vbb-boys');
    expect(schedule.length).toBeGreaterThan(0);
    for (const e of schedule) {
      expect(e.team_id).toBe('bb-team-vbb-boys');
      expect(['game', 'practice', 'scrimmage']).toContain(e.type);
      expect(new Date(e.start_time).toString()).not.toBe('Invalid Date');
    }
  });

  it('getTeamRoster filters by team_id', async () => {
    const roster = await client.getTeamRoster('bb-team-vbb-boys');
    expect(roster.length).toBeGreaterThan(0);
    for (const r of roster) {
      expect(r.team_id).toBe('bb-team-vbb-boys');
      expect(r.first_name).toBeTruthy();
      expect(r.last_name).toBeTruthy();
    }
  });

  it('listMasterCalendarEvents filters by date window', async () => {
    const all = await client.listMasterCalendarEvents('2026-01-01', '2026-12-31');
    expect(all.length).toBeGreaterThan(0);

    const narrow = await client.listMasterCalendarEvents('2026-03-01', '2026-03-31');
    expect(narrow.length).toBeGreaterThan(0);
    expect(narrow.length).toBeLessThanOrEqual(all.length);
    for (const e of narrow) {
      const t = new Date(e.start_time).getTime();
      expect(t).toBeGreaterThanOrEqual(new Date('2026-03-01').getTime());
      expect(t).toBeLessThanOrEqual(new Date('2026-03-31').getTime());
    }
  });

  it('returns empty array when no team matches', async () => {
    const schedule = await client.getTeamSchedule('nonexistent-team');
    expect(schedule).toEqual([]);
  });
});

describe('LiveBlackbaudSkyClient', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let getConnSpy: ReturnType<typeof vi.spyOn>;
  let refreshSpy: ReturnType<typeof vi.spyOn>;
  let saveSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // NOTE: config (incl. BLACKBAUD_SUBSCRIPTION_KEY) is parsed at module import,
    // so we rely on the test runner being launched with that env var set.
    // See npm script `test:blackbaud` in package.json or pass it inline.

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
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { value: [{ id: 't1', name: 'T1', sport: 'Basketball' }] }) as any);

    const client = new LiveBlackbaudSkyClient({ schoolId: 'tca' });
    const teams = await client.listTeams('tca');

    expect(teams).toHaveLength(1);
    expect(teams[0].id).toBe('t1');

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${SKY_API_BASE_URL}/school/v1/athletics/teams`);
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get('authorization')).toBe('Bearer access-current');
    // Whatever subscription key is in the env at test launch — non-empty + identifiable.
    expect(headers.get('bb-api-subscription-key')).toBeTruthy();
    expect(headers.get('accept')).toBe('application/json');
  });

  it('encodes teamId path param for getTeamSchedule', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, []) as any);

    const client = new LiveBlackbaudSkyClient({ schoolId: 'tca' });
    await client.getTeamSchedule('team with space');
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${SKY_API_BASE_URL}/school/v1/athletics/teams/team%20with%20space/schedule`);
  });

  it('passes start_date/end_date as query params for master calendar', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, []) as any);

    const client = new LiveBlackbaudSkyClient({ schoolId: 'tca' });
    await client.listMasterCalendarEvents('2026-03-01', '2026-03-31');
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toContain('/school/v1/events?');
    expect(url).toContain('start_date=2026-03-01');
    expect(url).toContain('end_date=2026-03-31');
  });

  it('handles bare-array responses (no value envelope)', async () => {
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        jsonResponse(200, [{ id: 't1', name: 'T1', sport: 'Basketball' }]) as any
      );

    const client = new LiveBlackbaudSkyClient({ schoolId: 'tca' });
    const teams = await client.listTeams('tca');
    expect(teams).toHaveLength(1);
  });

  it('on 401, refreshes the token, retries, and succeeds', async () => {
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(401, { error: 'invalid_token' }) as any)
      .mockResolvedValueOnce(
        jsonResponse(200, { value: [{ id: 't1', name: 'T1', sport: 'Basketball' }] }) as any
      );

    const client = new LiveBlackbaudSkyClient({ schoolId: 'tca' });
    const teams = await client.listTeams('tca');

    expect(teams).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledTimes(1);

    // Second call should use the refreshed token (we mock getConnectionWithFreshToken to return
    // a connection on each call — in real life saveConnection would update the row, but here we
    // just verify the retry happened).
  });

  it('on persistent 401, throws after one retry', async () => {
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(401, { error: 'invalid_token' }) as any);

    const client = new LiveBlackbaudSkyClient({ schoolId: 'tca' });
    await expect(client.listTeams('tca')).rejects.toThrow(/401/);
    // Should have tried twice: original + 1 retry.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('throws on non-2xx, non-401 status', async () => {
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(500, { error: 'internal' }) as any);

    const client = new LiveBlackbaudSkyClient({ schoolId: 'tca' });
    await expect(client.listTeams('tca')).rejects.toThrow(/500/);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // no retry on 500
  });
});
