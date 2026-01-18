// backend/src/modules/blockers/schemas.test.ts
import { describe, it, expect } from 'vitest';
import {
  createBlockerSchema,
  updateBlockerSchema,
  blockerQuerySchema,
  BlockerType,
  BlockerScope,
} from './schemas.js';

describe('BlockerType enum', () => {
  it('accepts valid blocker types', () => {
    const validTypes = ['EXAM', 'MAINTENANCE', 'EVENT', 'TRAVEL', 'HOLIDAY', 'WEATHER', 'CUSTOM'];
    validTypes.forEach(type => {
      expect(BlockerType.parse(type)).toBe(type);
    });
  });

  it('rejects invalid blocker types', () => {
    expect(() => BlockerType.parse('INVALID')).toThrow();
    expect(() => BlockerType.parse('')).toThrow();
  });
});

describe('BlockerScope enum', () => {
  it('accepts valid scopes', () => {
    const validScopes = ['SCHOOL_WIDE', 'TEAM', 'FACILITY'];
    validScopes.forEach(scope => {
      expect(BlockerScope.parse(scope)).toBe(scope);
    });
  });

  it('rejects invalid scopes', () => {
    expect(() => BlockerScope.parse('INVALID')).toThrow();
    expect(() => BlockerScope.parse('school_wide')).toThrow(); // case sensitive
  });
});

describe('createBlockerSchema', () => {
  const validSchoolWideBlocker = {
    type: 'EXAM',
    name: 'Final Exams',
    scope: 'SCHOOL_WIDE',
    startDatetime: '2026-05-15T08:00:00Z',
    endDatetime: '2026-05-22T17:00:00Z',
  };

  it('accepts valid school-wide blocker', () => {
    const result = createBlockerSchema.parse(validSchoolWideBlocker);
    expect(result.type).toBe('EXAM');
    expect(result.name).toBe('Final Exams');
    expect(result.scope).toBe('SCHOOL_WIDE');
    expect(result.startDatetime).toBeInstanceOf(Date);
    expect(result.endDatetime).toBeInstanceOf(Date);
  });

  it('accepts blocker with optional description', () => {
    const result = createBlockerSchema.parse({
      ...validSchoolWideBlocker,
      description: 'No practices during finals week',
    });
    expect(result.description).toBe('No practices during finals week');
  });

  it('accepts null description', () => {
    const result = createBlockerSchema.parse({
      ...validSchoolWideBlocker,
      description: null,
    });
    expect(result.description).toBeNull();
  });

  it('requires teamId when scope is TEAM', () => {
    expect(() =>
      createBlockerSchema.parse({
        type: 'TRAVEL',
        name: 'Away Tournament',
        scope: 'TEAM',
        startDatetime: '2026-03-01T08:00:00Z',
        endDatetime: '2026-03-03T18:00:00Z',
      })
    ).toThrow('teamId required when scope is TEAM');
  });

  it('accepts TEAM scope with teamId', () => {
    const result = createBlockerSchema.parse({
      type: 'TRAVEL',
      name: 'Away Tournament',
      scope: 'TEAM',
      teamId: 'cmkb6ov3000054mb5naz1kznq',
      startDatetime: '2026-03-01T08:00:00Z',
      endDatetime: '2026-03-03T18:00:00Z',
    });
    expect(result.scope).toBe('TEAM');
    expect(result.teamId).toBe('cmkb6ov3000054mb5naz1kznq');
  });

  it('requires facilityId when scope is FACILITY', () => {
    expect(() =>
      createBlockerSchema.parse({
        type: 'MAINTENANCE',
        name: 'Gym Floor Refinishing',
        scope: 'FACILITY',
        startDatetime: '2026-06-01T00:00:00Z',
        endDatetime: '2026-06-07T23:59:59Z',
      })
    ).toThrow('facilityId required when scope is FACILITY');
  });

  it('accepts FACILITY scope with facilityId', () => {
    const result = createBlockerSchema.parse({
      type: 'MAINTENANCE',
      name: 'Gym Floor Refinishing',
      scope: 'FACILITY',
      facilityId: 'cmkb6facility00001',
      startDatetime: '2026-06-01T00:00:00Z',
      endDatetime: '2026-06-07T23:59:59Z',
    });
    expect(result.scope).toBe('FACILITY');
    expect(result.facilityId).toBe('cmkb6facility00001');
  });

  it('rejects when endDatetime is before startDatetime', () => {
    expect(() =>
      createBlockerSchema.parse({
        type: 'HOLIDAY',
        name: 'Winter Break',
        scope: 'SCHOOL_WIDE',
        startDatetime: '2026-12-25T00:00:00Z',
        endDatetime: '2026-12-20T00:00:00Z', // Before start
      })
    ).toThrow('End datetime must be after start datetime');
  });

  it('rejects when endDatetime equals startDatetime', () => {
    expect(() =>
      createBlockerSchema.parse({
        type: 'HOLIDAY',
        name: 'Winter Break',
        scope: 'SCHOOL_WIDE',
        startDatetime: '2026-12-25T00:00:00Z',
        endDatetime: '2026-12-25T00:00:00Z', // Same time
      })
    ).toThrow('End datetime must be after start datetime');
  });

  it('rejects empty name', () => {
    expect(() =>
      createBlockerSchema.parse({
        ...validSchoolWideBlocker,
        name: '',
      })
    ).toThrow();
  });

  it('rejects name exceeding 100 characters', () => {
    expect(() =>
      createBlockerSchema.parse({
        ...validSchoolWideBlocker,
        name: 'A'.repeat(101),
      })
    ).toThrow();
  });

  it('rejects description exceeding 500 characters', () => {
    expect(() =>
      createBlockerSchema.parse({
        ...validSchoolWideBlocker,
        description: 'A'.repeat(501),
      })
    ).toThrow();
  });

  it('coerces date strings to Date objects', () => {
    const result = createBlockerSchema.parse(validSchoolWideBlocker);
    expect(result.startDatetime).toBeInstanceOf(Date);
    expect(result.endDatetime).toBeInstanceOf(Date);
  });
});

describe('updateBlockerSchema', () => {
  it('accepts partial updates', () => {
    const result = updateBlockerSchema.parse({ name: 'Updated Name' });
    expect(result.name).toBe('Updated Name');
  });

  it('accepts empty update', () => {
    const result = updateBlockerSchema.parse({});
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('validates datetime range when both provided', () => {
    expect(() =>
      updateBlockerSchema.parse({
        startDatetime: '2026-05-22T00:00:00Z',
        endDatetime: '2026-05-15T00:00:00Z', // Before start
      })
    ).toThrow('End datetime must be after start datetime');
  });

  it('allows updating only startDatetime', () => {
    const result = updateBlockerSchema.parse({
      startDatetime: '2026-05-10T00:00:00Z',
    });
    expect(result.startDatetime).toBeInstanceOf(Date);
    expect(result.endDatetime).toBeUndefined();
  });

  it('requires teamId when changing to TEAM scope', () => {
    expect(() =>
      updateBlockerSchema.parse({
        scope: 'TEAM',
      })
    ).toThrow('teamId required when changing scope to TEAM');
  });

  it('accepts scope change to TEAM with teamId', () => {
    const result = updateBlockerSchema.parse({
      scope: 'TEAM',
      teamId: 'cmkb6ov3000054mb5naz1kznq',
    });
    expect(result.scope).toBe('TEAM');
    expect(result.teamId).toBe('cmkb6ov3000054mb5naz1kznq');
  });

  it('requires facilityId when changing to FACILITY scope', () => {
    expect(() =>
      updateBlockerSchema.parse({
        scope: 'FACILITY',
      })
    ).toThrow('facilityId required when changing scope to FACILITY');
  });

  it('accepts scope change to FACILITY with facilityId', () => {
    const result = updateBlockerSchema.parse({
      scope: 'FACILITY',
      facilityId: 'cmkb6facility00001',
    });
    expect(result.scope).toBe('FACILITY');
    expect(result.facilityId).toBe('cmkb6facility00001');
  });
});

describe('blockerQuerySchema', () => {
  it('provides default pagination', () => {
    const result = blockerQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
  });

  it('accepts date range filters', () => {
    const result = blockerQuerySchema.parse({
      from: '2026-01-01T00:00:00Z',
      to: '2026-12-31T23:59:59Z',
    });
    expect(result.from).toBeInstanceOf(Date);
    expect(result.to).toBeInstanceOf(Date);
  });

  it('accepts scope filter', () => {
    const result = blockerQuerySchema.parse({ scope: 'TEAM' });
    expect(result.scope).toBe('TEAM');
  });

  it('accepts type filter', () => {
    const result = blockerQuerySchema.parse({ type: 'EXAM' });
    expect(result.type).toBe('EXAM');
  });

  it('accepts teamId filter', () => {
    const result = blockerQuerySchema.parse({ teamId: 'cmkb6ov3000054mb5naz1kznq' });
    expect(result.teamId).toBe('cmkb6ov3000054mb5naz1kznq');
  });

  it('accepts facilityId filter', () => {
    const result = blockerQuerySchema.parse({ facilityId: 'cmkb6facility00001' });
    expect(result.facilityId).toBe('cmkb6facility00001');
  });

  it('coerces string page and limit to numbers', () => {
    const result = blockerQuerySchema.parse({ page: '3', limit: '25' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(25);
  });

  it('rejects limit exceeding 100', () => {
    expect(() => blockerQuerySchema.parse({ limit: 101 })).toThrow();
  });

  it('rejects non-positive page', () => {
    expect(() => blockerQuerySchema.parse({ page: 0 })).toThrow();
    expect(() => blockerQuerySchema.parse({ page: -1 })).toThrow();
  });

  it('rejects non-positive limit', () => {
    expect(() => blockerQuerySchema.parse({ limit: 0 })).toThrow();
    expect(() => blockerQuerySchema.parse({ limit: -1 })).toThrow();
  });
});
