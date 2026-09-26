// backend/src/modules/weather/policy.test.ts
//
// The assertion this file exists for is the first one: a school that has not stated
// a threshold gets nothing raised. Everything else is arithmetic around it.

import { describe, it, expect } from 'vitest';

import {
  readPolicy,
  hasThreshold,
  assessWindow,
  localParts,
  upcomingDates,
  weatherPolicySchema,
  measuredValue,
  zonedTimeToUtc,
  windowBounds,
} from './policy.js';
import type { HourlyReading } from './source.js';

const CHICAGO = 'America/Chicago';

/** A reading at a given Chicago wall-clock hour on 2026-09-30 (CDT, UTC-5). */
function at(hour: number, values: Partial<HourlyReading> = {}): HourlyReading {
  return {
    time: new Date(Date.UTC(2026, 8, 30, hour + 5)),
    source: 'FORECAST',
    wbgtF: null,
    heatIndexF: null,
    temperatureF: null,
    humidity: null,
    precipChance: null,
    ...values,
  };
}

describe('readPolicy', () => {
  it('treats a school with no weather settings as having no policy', () => {
    const { policy, error } = readPolicy({});
    expect(error).toBeNull();
    expect(policy.thresholdF).toBeNull();
    expect(hasThreshold(policy)).toBe(false);
  });

  it('treats null settings the same way', () => {
    expect(readPolicy(null).policy.thresholdF).toBeNull();
    expect(readPolicy(undefined).policy.thresholdF).toBeNull();
  });

  it('reads a stated policy', () => {
    const { policy } = readPolicy({
      weather: { thresholdF: 82, measure: 'WBGT', lookaheadDays: 3 },
    });
    expect(policy.thresholdF).toBe(82);
    expect(policy.measure).toBe('WBGT');
    expect(policy.lookaheadDays).toBe(3);
  });

  it('falls back to no policy when the settings are malformed, and says why', () => {
    // One school's typo must not stop the scan, and must not be read as a threshold.
    const { policy, error } = readPolicy({ weather: { thresholdF: 'hot' } });
    expect(policy.thresholdF).toBeNull();
    expect(error).toContain('thresholdF');
  });

  it('rejects a practice window that ends before it starts', () => {
    const bad = weatherPolicySchema.safeParse({
      practiceWindow: { start: '18:00', end: '15:00' },
    });
    expect(bad.success).toBe(false);
  });

  it('defaults the window and lookahead but never the threshold', () => {
    const { policy } = weatherPolicySchema.parse({}) && readPolicy({ weather: {} });
    expect(policy.practiceWindow).toEqual({ start: '15:00', end: '18:30' });
    expect(policy.lookaheadDays).toBe(3);
    expect(policy.thresholdF).toBeNull();
  });
});

describe('assessWindow', () => {
  const stated = weatherPolicySchema.parse({ thresholdF: 82, measure: 'WBGT' });

  it('takes the peak inside the window and ignores the rest of the day', () => {
    const readings = [
      at(12, { wbgtF: 95 }), // hottest hour of the day, but before practice
      at(15, { wbgtF: 80 }),
      at(16, { wbgtF: 84 }),
      at(17, { wbgtF: 81 }),
      at(19, { wbgtF: 90 }), // after the window closes
    ];
    const result = assessWindow(readings, '2026-09-30', stated, CHICAGO);
    expect(result.peakF).toBe(84);
    expect(result.hoursObserved).toBe(3);
    expect(result.breach).toBe(true);
  });

  it('treats the window as half-open, so the closing time is not inside it', () => {
    const window = weatherPolicySchema.parse({
      thresholdF: 82,
      practiceWindow: { start: '15:00', end: '17:00' },
    });
    const result = assessWindow([at(17, { wbgtF: 99 })], '2026-09-30', window, CHICAGO);
    expect(result.hoursObserved).toBe(0);
    expect(result.breach).toBe(false);
  });

  it('breaches at the threshold exactly, not only above it', () => {
    const result = assessWindow([at(16, { wbgtF: 82 })], '2026-09-30', stated, CHICAGO);
    expect(result.breach).toBe(true);
  });

  it('does not breach just below', () => {
    const result = assessWindow([at(16, { wbgtF: 81.9 })], '2026-09-30', stated, CHICAGO);
    expect(result.peakF).toBe(81.9);
    expect(result.breach).toBe(false);
  });

  it('RAISES NOTHING when no threshold is configured, however hot it is', () => {
    // The guard this whole module is built around. A school that has not stated a
    // policy gets its conditions reported and no blocker raised, because a number we
    // invented would be indistinguishable on screen from one their trainer wrote.
    const noPolicy = weatherPolicySchema.parse({});
    const result = assessWindow([at(16, { wbgtF: 130 })], '2026-09-30', noPolicy, CHICAGO);
    expect(result.peakF).toBe(130); // conditions still reported
    expect(result.breach).toBe(false); // nothing raised
  });

  it('reads the measure the policy names, not whichever one is present', () => {
    // An hour can report a heat index and no wbgt. A WBGT policy must not quietly
    // fall through to the heat index, which is a different and usually higher number.
    const heatOnly = [at(16, { heatIndexF: 97, wbgtF: null })];
    expect(assessWindow(heatOnly, '2026-09-30', stated, CHICAGO)).toMatchObject({
      peakF: null,
      breach: false,
      hoursObserved: 0,
    });

    const byHeatIndex = weatherPolicySchema.parse({ thresholdF: 95, measure: 'HEAT_INDEX' });
    expect(assessWindow(heatOnly, '2026-09-30', byHeatIndex, CHICAGO)).toMatchObject({
      peakF: 97,
      breach: true,
    });
  });

  it('reports no peak for a day the forecast does not reach', () => {
    const result = assessWindow([at(16, { wbgtF: 99 })], '2026-10-02', stated, CHICAGO);
    expect(result.peakF).toBeNull();
    expect(result.breach).toBe(false);
  });

  it('selects hours by local time, not UTC', () => {
    // 21:00 UTC is 16:00 in Chicago, inside the window. Reading the UTC hour instead
    // would place it at 21:00, outside it, and the whole afternoon would be missed.
    const reading: HourlyReading = {
      time: new Date('2026-09-30T21:00:00Z'),
      source: 'FORECAST',
      wbgtF: 88,
      heatIndexF: null,
      temperatureF: null,
      humidity: null,
      precipChance: null,
    };
    expect(assessWindow([reading], '2026-09-30', stated, CHICAGO).breach).toBe(true);
    // The same instant is 14:00 in Los Angeles, an hour before that window opens.
    expect(assessWindow([reading], '2026-09-30', stated, 'America/Los_Angeles')).toMatchObject({
      hoursObserved: 0,
      breach: false,
    });
  });
});

describe('measuredValue', () => {
  it('picks the field the measure names', () => {
    const r = at(16, { wbgtF: 80, heatIndexF: 95 });
    expect(measuredValue(r, 'WBGT')).toBe(80);
    expect(measuredValue(r, 'HEAT_INDEX')).toBe(95);
  });
});

describe('localParts', () => {
  it('reads the local date across the UTC day boundary', () => {
    // 02:00 UTC on the 1st is still the evening of the 30th in Texas.
    expect(localParts(new Date('2026-10-01T02:00:00Z'), CHICAGO)).toEqual({
      date: '2026-09-30',
      hour: 21,
      minute: 0,
    });
  });

  it('renders local midnight as hour zero', () => {
    expect(localParts(new Date('2026-10-01T05:00:00Z'), CHICAGO).hour).toBe(0);
  });

  it('follows the daylight saving change', () => {
    // Texas leaves CDT on 2026-11-01. Same UTC hour, different local hour either side.
    expect(localParts(new Date('2026-10-31T18:00:00Z'), CHICAGO).hour).toBe(13);
    expect(localParts(new Date('2026-11-02T18:00:00Z'), CHICAGO).hour).toBe(12);
  });
});

describe('upcomingDates', () => {
  it('lists consecutive local dates starting today', () => {
    expect(upcomingDates(new Date('2026-09-30T14:00:00Z'), 3, CHICAGO)).toEqual([
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
  });
});

describe('zonedTimeToUtc', () => {
  it('resolves a local wall time to the right instant', () => {
    // 15:00 in Chicago on a summer date is CDT, UTC-5.
    expect(zonedTimeToUtc('2026-09-30', '15:00', CHICAGO).toISOString()).toBe(
      '2026-09-30T20:00:00.000Z'
    );
    // The same wall time in winter is CST, UTC-6.
    expect(zonedTimeToUtc('2026-12-15', '15:00', CHICAGO).toISOString()).toBe(
      '2026-12-15T21:00:00.000Z'
    );
  });

  it('round-trips through localParts', () => {
    for (const date of ['2026-03-08', '2026-11-01', '2027-06-21']) {
      const instant = zonedTimeToUtc(date, '15:30', CHICAGO);
      expect(localParts(instant, CHICAGO)).toEqual({ date, hour: 15, minute: 30 });
    }
  });

  it('handles the afternoon of a daylight saving change', () => {
    // Clocks go back at 2am on 2026-11-01, so 15:00 that afternoon is already CST.
    expect(zonedTimeToUtc('2026-11-01', '15:00', CHICAGO).toISOString()).toBe(
      '2026-11-01T21:00:00.000Z'
    );
  });
});

describe('windowBounds', () => {
  it('spans the configured practice window in local time', () => {
    const policy = weatherPolicySchema.parse({
      practiceWindow: { start: '15:00', end: '18:30' },
    });
    const { start, end } = windowBounds('2026-09-30', policy, CHICAGO);
    expect(start.toISOString()).toBe('2026-09-30T20:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-30T23:30:00.000Z');
  });
});
