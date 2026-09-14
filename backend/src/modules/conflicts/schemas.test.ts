// backend/src/modules/conflicts/schemas.test.ts
//
// Pure parsing tests - no database. Covers the `types` query param, which decides
// whether facility double-booking detection runs at all for a request.

import { describe, it, expect } from 'vitest';
import { parseConflictTypes, conflictsListQueryWithSuggestionsSchema } from './schemas.js';

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
