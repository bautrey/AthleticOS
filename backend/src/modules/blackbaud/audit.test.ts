// backend/src/modules/blackbaud/audit.test.ts
// Uses real database per NO MOCKS policy.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../common/db.js';
import { recordApiCall, listApiCalls, classifyError, toAuditPath } from './audit.js';

let schoolId: string;

describe('classifyError', () => {
  it('never returns the error message, which carries response body', () => {
    // client.ts builds messages containing up to 500 chars of Blackbaud response.
    // Storing that would put student data in the audit trail.
    const leaky = new Error(
      'Blackbaud SKY API 500 on /school/v1/athletics/teams/1/roster: {"students":[{"name":"Jane Doe"}]}'
    );
    const kind = classifyError(leaky);
    expect(kind).not.toContain('Jane Doe');
    expect(kind).not.toContain('students');
    expect(kind.length).toBeLessThanOrEqual(40);
  });

  it('names the common network failures', () => {
    expect(classifyError(Object.assign(new Error('x'), { code: 'ETIMEDOUT' }))).toBe('timeout');
    expect(classifyError(Object.assign(new Error('x'), { code: 'ECONNREFUSED' }))).toBe('network');
    expect(classifyError(new TypeError('fetch failed'))).toBe('network');
  });

  it('falls back rather than throwing on odd input', () => {
    expect(classifyError(null)).toBe('unknown');
    expect(classifyError('a string')).toBe('unknown');
    expect(classifyError(undefined)).toBe('unknown');
  });
});

describe('toAuditPath', () => {
  it('keeps a bare path with its query', () => {
    expect(toAuditPath('/school/v1/athletics/teams?school_year=2026-2027')).toBe(
      '/school/v1/athletics/teams?school_year=2026-2027'
    );
  });

  it('strips the host off an absolute URL', () => {
    expect(toAuditPath('https://api.sky.blackbaud.com/school/v1/years?x=1')).toBe(
      '/school/v1/years?x=1'
    );
  });

  it('caps length and survives a malformed URL', () => {
    expect(toAuditPath('http://[not a url')).toBeTruthy();
    expect(toAuditPath('/x'.repeat(2000)).length).toBeLessThanOrEqual(1000);
  });
});

describe('recordApiCall / listApiCalls', () => {
  beforeAll(async () => {
    await prisma.$connect();
    const school = await prisma.school.create({ data: { name: 'Audit Test School' } });
    schoolId = school.id;
  });

  beforeEach(async () => {
    await prisma.externalApiCall.deleteMany({ where: { schoolId } });
  });

  afterAll(async () => {
    await prisma.externalApiCall.deleteMany({ where: { schoolId } });
    await prisma.school.delete({ where: { id: schoolId } });
    await prisma.$disconnect();
  });

  it('records what was promised: timestamp, endpoint and response code', async () => {
    expect(
      await recordApiCall({
        schoolId,
        method: 'GET',
        path: '/school/v1/athletics/teams',
        status: 200,
        durationMs: 142,
      })
    ).toBe(true);

    const [row] = await listApiCalls(schoolId);
    expect(row.method).toBe('GET');
    expect(row.path).toBe('/school/v1/athletics/teams');
    expect(row.status).toBe(200);
    expect(row.durationMs).toBe(142);
    expect(row.system).toBe('BLACKBAUD');
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it('records a call that never got a response', async () => {
    await recordApiCall({
      schoolId,
      method: 'GET',
      path: '/school/v1/years',
      status: null,
      errorKind: 'timeout',
      durationMs: 30000,
    });

    const [row] = await listApiCalls(schoolId);
    expect(row.status).toBeNull();
    expect(row.errorKind).toBe('timeout');
  });

  it('records who caused it, and that background sync had no one', async () => {
    await recordApiCall({ schoolId, method: 'GET', path: '/a', status: 200, durationMs: 1, actingUserId: 'user-7' });
    await recordApiCall({ schoolId, method: 'GET', path: '/b', status: 200, durationMs: 1 });

    const rows = await listApiCalls(schoolId);
    expect(rows.find((r) => r.path === '/a')!.actingUserId).toBe('user-7');
    expect(rows.find((r) => r.path === '/b')!.actingUserId).toBeNull();
  });

  it('returns most recent first', async () => {
    await recordApiCall({ schoolId, method: 'GET', path: '/first', status: 200, durationMs: 1 });
    await new Promise((r) => setTimeout(r, 5));
    await recordApiCall({ schoolId, method: 'GET', path: '/second', status: 200, durationMs: 1 });

    const rows = await listApiCalls(schoolId);
    expect(rows[0].path).toBe('/second');
  });

  it('never throws, so a broken audit cannot fail a roster sync', async () => {
    // A school id with no matching row violates the foreign key.
    await expect(
      recordApiCall({
        schoolId: 'school-that-does-not-exist',
        method: 'GET',
        path: '/x',
        status: 200,
        durationMs: 1,
      })
    ).resolves.toBe(false);
  });

  it('keeps schools apart', async () => {
    const other = await prisma.school.create({ data: { name: 'Audit Other School' } });
    try {
      await recordApiCall({ schoolId, method: 'GET', path: '/mine', status: 200, durationMs: 1 });
      await recordApiCall({ schoolId: other.id, method: 'GET', path: '/theirs', status: 200, durationMs: 1 });

      expect((await listApiCalls(schoolId)).map((r) => r.path)).toEqual(['/mine']);
      expect((await listApiCalls(other.id)).map((r) => r.path)).toEqual(['/theirs']);
    } finally {
      await prisma.externalApiCall.deleteMany({ where: { schoolId: other.id } });
      await prisma.school.delete({ where: { id: other.id } });
    }
  });

  it('filters by time, which is how a school asks for a window', async () => {
    await recordApiCall({ schoolId, method: 'GET', path: '/old', status: 200, durationMs: 1 });
    const cutoff = new Date(Date.now() + 10);
    await new Promise((r) => setTimeout(r, 20));
    await recordApiCall({ schoolId, method: 'GET', path: '/new', status: 200, durationMs: 1 });

    expect((await listApiCalls(schoolId, { since: cutoff })).map((r) => r.path)).toEqual(['/new']);
  });

  it('caps the page size even when asked for more', async () => {
    expect((await listApiCalls(schoolId, { limit: 100000 })).length).toBeLessThanOrEqual(500);
  });
});
