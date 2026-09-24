// backend/src/modules/blackbaud/test-connection.test.ts
//
// The connection test is what a school's IT administrator presses to satisfy
// themselves before approving the integration, so its output is read by someone
// outside our organisation. These tests are mostly about what it must NOT say.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { describeFailure, testConnection } from './test-connection.js';
import * as clientModule from './client.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('describeFailure', () => {
  it('never surfaces a response body, which SKY errors carry', () => {
    // client.ts builds messages containing up to 500 chars of Blackbaud response.
    // Showing that verbatim would put student data on a screen we hand to a school.
    const leaky = new Error(
      'Blackbaud SKY API 500 on /school/v1/athletics/teams: {"students":[{"name":"Jane Doe","grade":11}]}'
    );
    const out = describeFailure(leaky);
    expect(out).not.toContain('Jane Doe');
    expect(out).not.toContain('students');
    expect(out).not.toContain('grade');
  });

  it('translates the statuses an administrator will actually hit', () => {
    expect(describeFailure(new Error('Blackbaud SKY API 401 on /x: nope'))).toMatch(/401/);
    expect(describeFailure(new Error('Blackbaud SKY API 401 on /x: nope'))).toMatch(/re-authoriz/i);

    const forbidden = describeFailure(new Error('Blackbaud SKY API 403 on /x: nope'));
    expect(forbidden).toMatch(/403/);
    // The 403 wording has to point at the account's permissions, because that is
    // the actual cause and the thing the administrator can fix.
    expect(forbidden).toMatch(/permission/i);
  });

  it('describes a schema mismatch without dumping the payload', () => {
    const out = describeFailure(
      new Error('Blackbaud SKY response failed schema validation for /x: [{"path":["value",0,"name"]}]')
    );
    expect(out).toMatch(/unexpected shape/i);
    expect(out).not.toContain('path');
  });

  it('falls back safely on anything unrecognised', () => {
    expect(describeFailure(new Error('socket hang up'))).toBeTruthy();
    expect(describeFailure(null)).toBeTruthy();
    expect(describeFailure('a bare string')).toBeTruthy();
  });
});

describe('testConnection', () => {
  function stubClient(overrides: Partial<Record<'listTeams' | 'listMasterCalendarEvents', unknown>>) {
    vi.spyOn(clientModule, 'getBlackbaudClient').mockReturnValue({
      listTeams: overrides.listTeams ?? (async () => []),
      listMasterCalendarEvents: overrides.listMasterCalendarEvents ?? (async () => []),
      getTeamSchedule: async () => [],
      getTeamRoster: async () => ({}),
    } as never);
  }

  it('reports both checks with counts and samples', async () => {
    stubClient({
      listTeams: async () => [
        { id: 1, name: 'Varsity Soccer', sport: { id: 1, name: 'Soccer' } },
        { id: 2, name: 'JV Soccer', sport: { id: 1, name: 'Soccer' } },
      ],
      listMasterCalendarEvents: async () => [{ id: 9, title: 'Exam Week' }],
    });

    const result = await testConnection('school-1', 'user-1');
    expect(result.ok).toBe(true);
    expect(result.checks).toHaveLength(2);

    const teams = result.checks.find((c) => c.label.includes('teams'))!;
    expect(teams.count).toBe(2);
    expect(teams.sample).toEqual(['Varsity Soccer', 'JV Soccer']);
  });

  it('never reads rosters, because phase one excludes student records', async () => {
    const roster = vi.fn(async () => ({}));
    vi.spyOn(clientModule, 'getBlackbaudClient').mockReturnValue({
      listTeams: async () => [],
      listMasterCalendarEvents: async () => [],
      getTeamSchedule: async () => [],
      getTeamRoster: roster,
    } as never);

    await testConnection('school-1');
    expect(roster).not.toHaveBeenCalled();
  });

  it('returns a failed check rather than throwing', async () => {
    stubClient({
      listTeams: async () => {
        throw new Error('Blackbaud SKY API 403 on /school/v1/athletics/teams: denied');
      },
    });

    const result = await testConnection('school-1');
    expect(result.ok).toBe(false);
    const teams = result.checks.find((c) => c.label.includes('teams'))!;
    expect(teams.ok).toBe(false);
    expect(teams.error).toMatch(/permission/i);
  });

  it('runs the calendar check even when teams fails', async () => {
    // A half-broken connection is the interesting case: the administrator needs to
    // see which half works, not just the first error.
    stubClient({
      listTeams: async () => {
        throw new Error('Blackbaud SKY API 403 on /x: denied');
      },
      listMasterCalendarEvents: async () => [{ id: 1, title: 'Assembly' }],
    });

    const result = await testConnection('school-1');
    expect(result.ok).toBe(false);
    expect(result.checks).toHaveLength(2);
    const calendar = result.checks.find((c) => c.label.includes('calendar'))!;
    expect(calendar.ok).toBe(true);
    expect(calendar.count).toBe(1);
  });

  it('handles an untitled calendar event without rendering undefined', async () => {
    stubClient({ listMasterCalendarEvents: async () => [{ id: 1, title: null }] });
    const result = await testConnection('school-1');
    const calendar = result.checks.find((c) => c.label.includes('calendar'))!;
    expect(calendar.sample).toEqual(['Untitled event']);
  });

  it('passes the acting user through, so the audit trail can attribute the calls', async () => {
    const spy = vi.spyOn(clientModule, 'getBlackbaudClient').mockReturnValue({
      listTeams: async () => [],
      listMasterCalendarEvents: async () => [],
      getTeamSchedule: async () => [],
      getTeamRoster: async () => ({}),
    } as never);

    await testConnection('school-1', 'user-42');
    expect(spy).toHaveBeenCalledWith('school-1', 'user-42');
  });
});
