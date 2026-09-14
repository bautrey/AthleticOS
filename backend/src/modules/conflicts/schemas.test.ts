// backend/src/modules/conflicts/schemas.test.ts
//
// Pure parsing tests - no database. Covers the `types` query param, which decides
// whether facility double-booking detection runs at all for a request.

import { describe, it, expect } from 'vitest';
import {
  parseConflictTypes,
  conflictsListQueryWithSuggestionsSchema,
  resolveGameDurationMinutes,
  DEFAULT_GAME_DURATION_MINUTES,
} from './schemas.js';

describe('parseConflictTypes', () => {
  it('runs both checks when the caller says nothing', () => {
    expect(parseConflictTypes(undefined)).toEqual({ blocker: true, facility: true });
  });

  it('honours a single named check', () => {
    expect(parseConflictTypes('blocker')).toEqual({ blocker: true, facility: false });
    expect(parseConflictTypes('facility')).toEqual({ blocker: false, facility: true });
  });

  it('honours both when listed', () => {
    expect(parseConflictTypes('blocker,facility')).toEqual({ blocker: true, facility: true });
  });

  it('treats "all" as every check', () => {
    expect(parseConflictTypes('all')).toEqual({ blocker: true, facility: true });
  });

  it('tolerates the shapes a hand-written query string actually takes', () => {
    expect(parseConflictTypes(' Blocker , FACILITY ')).toEqual({ blocker: true, facility: true });
    expect(parseConflictTypes('facility,')).toEqual({ blocker: false, facility: true });
    expect(parseConflictTypes('blocker,,facility')).toEqual({ blocker: true, facility: true });
  });

  it('falls back to both rather than disabling everything on junk input', () => {
    // An empty or unrecognised value must not silently turn off detection - that is
    // how a conflict page ends up confidently showing nothing.
    expect(parseConflictTypes('')).toEqual({ blocker: true, facility: true });
    expect(parseConflictTypes('   ')).toEqual({ blocker: true, facility: true });
    expect(parseConflictTypes('bogus')).toEqual({ blocker: true, facility: true });
  });

  it('ignores an unknown check alongside a known one', () => {
    expect(parseConflictTypes('facility,person')).toEqual({ blocker: false, facility: true });
  });
});

describe('resolveGameDurationMinutes', () => {
  it('falls back to two hours when the school has set nothing', () => {
    expect(resolveGameDurationMinutes({})).toBe(DEFAULT_GAME_DURATION_MINUTES);
    expect(resolveGameDurationMinutes(null)).toBe(DEFAULT_GAME_DURATION_MINUTES);
    expect(resolveGameDurationMinutes(undefined)).toBe(DEFAULT_GAME_DURATION_MINUTES);
  });

  it('uses the school\'s value when set', () => {
    expect(resolveGameDurationMinutes({ gameDurationMinutes: 75 })).toBe(75);
  });

  it('ignores values outside a plausible game length', () => {
    // A zero or negative duration would collapse every game to a point and hide
    // real double-bookings; an absurd one would flag the whole season.
    expect(resolveGameDurationMinutes({ gameDurationMinutes: 0 })).toBe(120);
    expect(resolveGameDurationMinutes({ gameDurationMinutes: -30 })).toBe(120);
    expect(resolveGameDurationMinutes({ gameDurationMinutes: 10000 })).toBe(120);
  });

  it('ignores a value of the wrong type', () => {
    expect(resolveGameDurationMinutes({ gameDurationMinutes: '90' })).toBe(120);
    expect(resolveGameDurationMinutes({ gameDurationMinutes: NaN })).toBe(120);
    expect(resolveGameDurationMinutes('not an object')).toBe(120);
    expect(resolveGameDurationMinutes([90])).toBe(120);
  });
});

describe('conflictsListQueryWithSuggestionsSchema', () => {
  it('defaults to including facility double-bookings', () => {
    const parsed = conflictsListQueryWithSuggestionsSchema.parse({});
    expect(parsed.types).toBe('blocker,facility');
    expect(parseConflictTypes(parsed.types).facility).toBe(true);
  });

  it('still lets a caller narrow to blockers only', () => {
    const parsed = conflictsListQueryWithSuggestionsSchema.parse({ types: 'blocker' });
    expect(parseConflictTypes(parsed.types)).toEqual({ blocker: true, facility: false });
  });
});
