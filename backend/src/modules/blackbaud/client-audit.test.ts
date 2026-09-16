// backend/src/modules/blackbaud/client-audit.test.ts
//
// Proves the audit trail is actually wired into the client, not merely that the
// recorder works. Uses a real school row, because recordApiCall swallows its own
// failures by design - against a fake school id every write would fail silently and
// a test asserting "it recorded" would pass while recording nothing.

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '../../common/db.js';
import { LiveBlackbaudSkyClient } from './client.js';
import { blackbaudService } from './service.js';
import { listApiCalls } from './audit.js';

let schoolId: string;
let userId: string;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const TEAMS_BODY = {
  count: 1,
  value: [{ id: 1, name: 'Varsity Soccer', sport: { id: 31083, name: 'Soccer' } }],
};

describe('SKY client audit wiring', () => {
  beforeAll(async () => {
    await prisma.$connect();
    const user = await prisma.user.create({
      data: { email: `client-audit-${Date.now()}@test.com`, passwordHash: 'h' },
    });
    userId = user.id;
    const school = await prisma.school.create({ data: { name: 'Client Audit School' } });
    schoolId = school.id;
  });

  beforeEach(async () => {
    await prisma.externalApiCall.deleteMany({ where: { schoolId } });
    vi.spyOn(blackbaudService, 'getConnectionWithFreshToken').mockResolvedValue({
      id: 'conn-1',
      schoolId,
      accessToken: 'access-current',
      refreshToken: 'refresh-current',
      expiresAt: new Date(Date.now() + 3600_000),
      tokenType: 'Bearer',
      scope: null,
      environmentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.externalApiCall.deleteMany({ where: { schoolId } });
    await prisma.school.delete({ where: { id: schoolId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('records a successful call with its endpoint and status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, TEAMS_BODY));

    await new LiveBlackbaudSkyClient({ schoolId }).listTeams();

    const rows = await listApiCalls(schoolId);
    expect(rows).toHaveLength(1);
    expect(rows[0].method).toBe('GET');
    expect(rows[0].path).toBe('/school/v1/athletics/teams');
    expect(rows[0].status).toBe(200);
    expect(rows[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records the acting user when one caused the call', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, TEAMS_BODY));

    await new LiveBlackbaudSkyClient({ schoolId, actingUserId: userId }).listTeams();

    expect((await listApiCalls(schoolId))[0].actingUserId).toBe(userId);
  });

  it('records a failing call, which is the one an audit is actually for', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(403, { message: 'Forbidden' }));

    await expect(new LiveBlackbaudSkyClient({ schoolId }).listTeams()).rejects.toThrow();

    const rows = await listApiCalls(schoolId);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(403);
  });

  it('records a call that never reached Blackbaud', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
    );

    await expect(new LiveBlackbaudSkyClient({ schoolId }).listTeams()).rejects.toThrow();

    const [row] = await listApiCalls(schoolId);
    expect(row.status).toBeNull();
    expect(row.errorKind).toBe('network');
  });

  it('records the 401 and the retry as two calls, because two calls happened', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(401, { message: 'expired' }))
      .mockResolvedValueOnce(jsonResponse(200, TEAMS_BODY));
    vi.spyOn(blackbaudService, 'refreshAccessToken').mockResolvedValue({
      access_token: 'access-refreshed',
      refresh_token: 'refresh-refreshed',
      token_type: 'Bearer',
      expires_in: 3600,
    } as never);
    vi.spyOn(blackbaudService, 'saveConnection').mockResolvedValue(undefined as never);

    await new LiveBlackbaudSkyClient({ schoolId }).listTeams();

    const rows = await listApiCalls(schoolId);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  it('never stores a response body, even when the error message carries one', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(500, { students: [{ name: 'Jane Doe', grade: 11 }] })
    );

    await expect(new LiveBlackbaudSkyClient({ schoolId }).listTeams()).rejects.toThrow();

    const serialised = JSON.stringify(await listApiCalls(schoolId));
    expect(serialised).not.toContain('Jane Doe');
    expect(serialised).not.toContain('students');
  });

  it('does not fail the call when the audit write fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, TEAMS_BODY));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // A school that does not exist violates the audit table's foreign key.
    const teams = await new LiveBlackbaudSkyClient({ schoolId: 'no-such-school' }).listTeams();

    // The roster sync still returned its data.
    expect(teams).toHaveLength(1);
  });
});
