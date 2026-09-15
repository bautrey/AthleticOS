// backend/src/modules/external-mappings/service.test.ts
// Uses real database per NO MOCKS policy.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../common/db.js';
import { externalMappingService } from './service.js';

const KEY = { system: 'BLACKBAUD', entityType: 'TEAM' } as const;

let schoolId: string;
let otherSchoolId: string;
let userId: string;

describe('externalMappingService', () => {
  beforeAll(async () => {
    await prisma.$connect();
    const user = await prisma.user.create({
      data: { email: `extmap-${Date.now()}@test.com`, passwordHash: 'test-hash' },
    });
    userId = user.id;

    const school = await prisma.school.create({ data: { name: 'ExtMap Test School' } });
    schoolId = school.id;

    const other = await prisma.school.create({ data: { name: 'ExtMap Other School' } });
    otherSchoolId = other.id;
  });

  beforeEach(async () => {
    await prisma.externalMapping.deleteMany({
      where: { schoolId: { in: [schoolId, otherSchoolId] } },
    });
  });

  afterAll(async () => {
    await prisma.externalMapping.deleteMany({
      where: { schoolId: { in: [schoolId, otherSchoolId] } },
    });
    await prisma.school.deleteMany({ where: { id: { in: [schoolId, otherSchoolId] } } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('resolves in both directions once linked', async () => {
    await externalMappingService.link(
      schoolId,
      { ...KEY, entityId: 'team-local-1', externalId: 'bb-team-99', externalLabel: 'Girls Varsity Soccer' },
      userId
    );

    expect(await externalMappingService.resolveLocalId(schoolId, KEY, 'bb-team-99')).toBe('team-local-1');
    expect(await externalMappingService.resolveExternalId(schoolId, KEY, 'team-local-1')).toBe('bb-team-99');
  });

  it('returns null for anything never linked', async () => {
    expect(await externalMappingService.resolveLocalId(schoolId, KEY, 'nope')).toBeNull();
    expect(await externalMappingService.resolveExternalId(schoolId, KEY, 'nope')).toBeNull();
  });

  it('survives a rename on either side, because the link is an id', async () => {
    await externalMappingService.link(
      schoolId,
      { ...KEY, entityId: 'team-local-1', externalId: 'bb-team-99', externalLabel: 'Girls Varsity Soccer' },
      userId
    );
    // The external system renames the team. Nothing about the mapping changes.
    expect(await externalMappingService.resolveLocalId(schoolId, KEY, 'bb-team-99')).toBe('team-local-1');
  });

  it('keeps schools apart', async () => {
    await externalMappingService.link(
      schoolId,
      { ...KEY, entityId: 'team-local-1', externalId: 'bb-team-99' },
      userId
    );
    // Same external id at a different school is a different team entirely.
    expect(await externalMappingService.resolveLocalId(otherSchoolId, KEY, 'bb-team-99')).toBeNull();

    await externalMappingService.link(
      otherSchoolId,
      { ...KEY, entityId: 'team-other-1', externalId: 'bb-team-99' },
      userId
    );
    expect(await externalMappingService.resolveLocalId(otherSchoolId, KEY, 'bb-team-99')).toBe('team-other-1');
    expect(await externalMappingService.resolveLocalId(schoolId, KEY, 'bb-team-99')).toBe('team-local-1');
  });

  it('keeps entity types apart', async () => {
    await externalMappingService.link(
      schoolId,
      { ...KEY, entityId: 'team-1', externalId: 'shared-id' },
      userId
    );
    await externalMappingService.link(
      schoolId,
      { system: 'BLACKBAUD', entityType: 'FACILITY', entityId: 'facility-1', externalId: 'shared-id' },
      userId
    );

    expect(await externalMappingService.resolveLocalId(schoolId, KEY, 'shared-id')).toBe('team-1');
    expect(
      await externalMappingService.resolveLocalId(
        schoolId,
        { system: 'BLACKBAUD', entityType: 'FACILITY' },
        'shared-id'
      )
    ).toBe('facility-1');
  });

  it('re-linking a local record replaces the old link instead of failing', async () => {
    await externalMappingService.link(
      schoolId,
      { ...KEY, entityId: 'team-1', externalId: 'bb-wrong' },
      userId
    );
    await externalMappingService.link(
      schoolId,
      { ...KEY, entityId: 'team-1', externalId: 'bb-right' },
      userId
    );

    expect(await externalMappingService.resolveExternalId(schoolId, KEY, 'team-1')).toBe('bb-right');
    // The mistaken link is gone, not merely shadowed.
    expect(await externalMappingService.resolveLocalId(schoolId, KEY, 'bb-wrong')).toBeNull();
    expect(await externalMappingService.list(schoolId, KEY)).toHaveLength(1);
  });

  it('re-linking an external record steals it from the previous local record', async () => {
    await externalMappingService.link(
      schoolId,
      { ...KEY, entityId: 'team-wrong', externalId: 'bb-1' },
      userId
    );
    await externalMappingService.link(
      schoolId,
      { ...KEY, entityId: 'team-right', externalId: 'bb-1' },
      userId
    );

    expect(await externalMappingService.resolveLocalId(schoolId, KEY, 'bb-1')).toBe('team-right');
    // The team that used to own it is now unmapped rather than pointing at a stale id.
    expect(await externalMappingService.resolveExternalId(schoolId, KEY, 'team-wrong')).toBeNull();
    expect(await externalMappingService.list(schoolId, KEY)).toHaveLength(1);
  });

  it('records who confirmed the link and how it was made', async () => {
    await externalMappingService.link(
      schoolId,
      { ...KEY, entityId: 'team-1', externalId: 'bb-1', matchMethod: 'FUZZY' },
      userId
    );
    const [row] = await externalMappingService.list(schoolId, KEY);
    expect(row.matchMethod).toBe('FUZZY');
    expect(row.confirmedBy).toBe(userId);
    expect(row.confirmedAt).toBeInstanceOf(Date);
    expect(row.lastSyncedAt).toBeNull();
  });

  it('resolves many at once and omits the unmapped', async () => {
    await externalMappingService.link(schoolId, { ...KEY, entityId: 'a', externalId: 'x' }, userId);
    await externalMappingService.link(schoolId, { ...KEY, entityId: 'b', externalId: 'y' }, userId);

    const map = await externalMappingService.resolveLocalIds(schoolId, KEY, ['x', 'y', 'z']);
    expect(map.get('x')).toBe('a');
    expect(map.get('y')).toBe('b');
    expect(map.has('z')).toBe(false);
    expect(await externalMappingService.resolveLocalIds(schoolId, KEY, [])).toEqual(new Map());
  });

  it('unlinks and reports whether anything was there', async () => {
    await externalMappingService.link(schoolId, { ...KEY, entityId: 'team-1', externalId: 'bb-1' }, userId);
    expect(await externalMappingService.unlink(schoolId, KEY, 'team-1')).toBe(1);
    expect(await externalMappingService.resolveLocalId(schoolId, KEY, 'bb-1')).toBeNull();
    expect(await externalMappingService.unlink(schoolId, KEY, 'team-1')).toBe(0);
  });

  it('stamps sync time only on the rows named', async () => {
    await externalMappingService.link(schoolId, { ...KEY, entityId: 'a', externalId: 'x' }, userId);
    await externalMappingService.link(schoolId, { ...KEY, entityId: 'b', externalId: 'y' }, userId);

    expect(await externalMappingService.markSynced(schoolId, KEY, ['a'])).toBe(1);
    const rows = await externalMappingService.list(schoolId, KEY);
    expect(rows.find((r) => r.entityId === 'a')!.lastSyncedAt).toBeInstanceOf(Date);
    expect(rows.find((r) => r.entityId === 'b')!.lastSyncedAt).toBeNull();
  });

  describe('suggestLinks', () => {
    const external = [
      { id: 'bb-1', name: 'Girls Varsity Soccer' },
      { id: 'bb-2', name: 'Boys Varsity Soccer' },
    ];
    const local = [
      { id: 'l-1', name: 'Varsity Soccer (Girls)' },
      { id: 'l-2', name: 'Varsity Soccer (Boys)' },
    ];

    it('proposes the right pairing and never the opposite gender', async () => {
      const suggestions = await externalMappingService.suggestLinks(schoolId, KEY, external, local);
      const forGirls = suggestions.find((s) => s.external.id === 'bb-1')!;
      expect(forGirls.matches[0].local.id).toBe('l-1');
      expect(forGirls.matches.map((m) => m.local.id)).not.toContain('l-2');
    });

    it('drops both sides of an existing link from the work list', async () => {
      await externalMappingService.link(
        schoolId,
        { ...KEY, entityId: 'l-1', externalId: 'bb-1' },
        userId
      );

      const suggestions = await externalMappingService.suggestLinks(schoolId, KEY, external, local);
      expect(suggestions.map((s) => s.external.id)).toEqual(['bb-2']);
      // l-1 is spoken for and must not be offered to the boys team.
      expect(suggestions[0].matches.map((m) => m.local.id)).not.toContain('l-1');
    });

    it('returns an entry with no matches rather than omitting the record', async () => {
      const suggestions = await externalMappingService.suggestLinks(
        schoolId,
        KEY,
        [{ id: 'bb-9', name: 'Robotics Club' }],
        local
      );
      // The reconciliation screen still needs to show that this one is unmatched.
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].matches).toEqual([]);
    });

    it('writes nothing', async () => {
      await externalMappingService.suggestLinks(schoolId, KEY, external, local);
      expect(await externalMappingService.list(schoolId, KEY)).toEqual([]);
    });
  });
});
