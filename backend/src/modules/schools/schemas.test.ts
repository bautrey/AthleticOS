// backend/src/modules/schools/schemas.test.ts
//
// Settings is an open bag, so the weather block is the one part validated on write.
// A typo there fails quietly at scan time - unparseable settings mean no threshold,
// which means no alerts - and someone would go on believing heat alerts were on.

import { describe, it, expect } from 'vitest';
import { createSchoolSchema, updateSchoolSchema } from './schemas.js';

describe('school settings validation', () => {
  it('accepts a school with no settings at all', () => {
    expect(createSchoolSchema.safeParse({ name: 'TCA' }).success).toBe(true);
  });

  it('leaves unrelated settings alone', () => {
    const parsed = createSchoolSchema.safeParse({
      name: 'TCA',
      settings: { gameDurationMinutes: 120, somethingElse: { nested: true } },
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts a stated weather policy', () => {
    const parsed = createSchoolSchema.safeParse({
      name: 'TCA',
      settings: { weather: { thresholdF: 82, measure: 'WBGT', lookaheadDays: 3 } },
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts a weather block that states no threshold', () => {
    // The shipped state. Nothing fires until the school fills the number in.
    const parsed = createSchoolSchema.safeParse({
      name: 'TCA',
      settings: { weather: { thresholdF: null } },
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a threshold that is not a number', () => {
    const parsed = updateSchoolSchema.safeParse({ settings: { weather: { thresholdF: '82' } } });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].path).toEqual(['settings', 'weather', 'thresholdF']);
  });

  it('rejects a measure we cannot read a forecast for', () => {
    const parsed = updateSchoolSchema.safeParse({
      settings: { weather: { thresholdF: 82, measure: 'FEELS_LIKE' } },
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a practice window that ends before it starts', () => {
    const parsed = updateSchoolSchema.safeParse({
      settings: { weather: { practiceWindow: { start: '18:00', end: '15:00' } } },
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a malformed clock time', () => {
    const parsed = updateSchoolSchema.safeParse({
      settings: { weather: { practiceWindow: { start: '3pm', end: '18:30' } } },
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a lookahead past what the forecast covers', () => {
    expect(
      updateSchoolSchema.safeParse({ settings: { weather: { lookaheadDays: 30 } } }).success
    ).toBe(false);
  });
});

describe('school coordinates', () => {
  it('accepts a real location', () => {
    const parsed = createSchoolSchema.safeParse({
      name: 'TCA',
      latitude: 32.9668,
      longitude: -96.8236,
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts null to clear it', () => {
    expect(
      updateSchoolSchema.safeParse({ latitude: null, longitude: null }).success
    ).toBe(true);
  });

  it('rejects coordinates off the globe', () => {
    expect(updateSchoolSchema.safeParse({ latitude: 91 }).success).toBe(false);
    expect(updateSchoolSchema.safeParse({ longitude: -181 }).success).toBe(false);
  });
});
