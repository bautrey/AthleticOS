// backend/src/modules/weather/gridpoint.test.ts
//
// Runs against the recorded FWD/88,112 response rather than a hand-written sample,
// because the shapes worth defending here are the ones NWS actually emits: six
// different interval durations in a single series, series that disagree about where
// their boundaries fall, and a precipitation series whose six-hour blocks reach past
// the end of every hourly measure beside it.

import { describe, it, expect } from 'vitest';

import {
  intervalHours,
  expandSeries,
  celsiusToF,
  readingsFromGridpoint,
  formatGridpoint,
  parseGridpoint,
} from './gridpoint.js';
import { loadGridpointFixture, shiftToToday, MockWeatherSource } from './mock-source.js';

const fixture = loadGridpointFixture();
const readings = readingsFromGridpoint(fixture);

describe('intervalHours', () => {
  it('reads the hour forms NWS emits', () => {
    expect(intervalHours('2026-09-26T06:00:00+00:00/PT1H')).toEqual({
      start: new Date('2026-09-26T06:00:00Z'),
      hours: 1,
    });
    expect(intervalHours('2026-09-26T06:00:00+00:00/PT6H')?.hours).toBe(6);
  });

  it('reads a day-plus-hours duration', () => {
    expect(intervalHours('2026-09-26T06:00:00+00:00/P1DT6H')?.hours).toBe(30);
    expect(intervalHours('2026-09-26T06:00:00+00:00/P2D')?.hours).toBe(48);
  });

  it('refuses a duration it has not seen rather than guessing', () => {
    // A minutes or seconds duration would have to be rounded to land on an hour,
    // and rounding silently spreads one value across hours it never covered.
    expect(intervalHours('2026-09-26T06:00:00+00:00/PT30M')).toBeNull();
    expect(intervalHours('2026-09-26T06:00:00+00:00/PT0H')).toBeNull();
    expect(intervalHours('2026-09-26T06:00:00+00:00')).toBeNull();
    expect(intervalHours('not-a-time/PT1H')).toBeNull();
  });
});

describe('expandSeries', () => {
  it('gives a multi-hour interval one entry per hour, all the same value', () => {
    const expanded = expandSeries({
      values: [{ validTime: '2026-09-26T06:00:00+00:00/PT3H', value: 20 }],
    });
    expect(expanded.size).toBe(3);
    expect([...expanded.values()]).toEqual([20, 20, 20]);
    expect(expanded.get(Date.UTC(2026, 8, 26, 8))).toBe(20);
  });

  it('drops a null value instead of reading it as zero', () => {
    // Zero degrees is a temperature. NWS uses null to mean it has no figure.
    const expanded = expandSeries({
      values: [
        { validTime: '2026-09-26T06:00:00+00:00/PT1H', value: null },
        { validTime: '2026-09-26T07:00:00+00:00/PT1H', value: 5 },
      ],
    });
    expect(expanded.size).toBe(1);
    expect(expanded.get(Date.UTC(2026, 8, 26, 7))).toBe(5);
  });

  it('applies the conversion once per interval, not once per hour', () => {
    const expanded = expandSeries(
      { values: [{ validTime: '2026-09-26T06:00:00+00:00/PT2H', value: 100 }] },
      celsiusToF
    );
    expect([...expanded.values()]).toEqual([212, 212]);
  });
});

describe('celsiusToF', () => {
  it('converts the fixed points', () => {
    expect(celsiusToF(0)).toBe(32);
    expect(celsiusToF(100)).toBe(212);
    expect(celsiusToF(-40)).toBe(-40);
  });
});

describe('the recorded FWD/88,112 response', () => {
  it('publishes wet bulb globe temperature, which is the measure Texas policy uses', () => {
    // This is why the policy can be stated in the same unit as the school's own
    // written plan instead of in heat index, which is a different measurement.
    const withWbgt = readings.filter((r) => r.wbgtF !== null);
    expect(withWbgt.length).toBeGreaterThan(100);
  });

  it('spans the thresholds a Texas heat policy is written around', () => {
    // UIL modifies practice at 79.7F (Class 2) and 82.0F (Class 3). A forecast that
    // never crossed either would make every assertion below vacuous.
    const wbgt = readings.map((r) => r.wbgtF).filter((v): v is number => v !== null);
    expect(Math.min(...wbgt)).toBeLessThan(79.7);
    expect(Math.max(...wbgt)).toBeGreaterThan(82.0);
  });

  it('reports each measure independently, so a gap in one is not a gap in all', () => {
    // The series do not cover the same span. In this response precipitation runs in
    // PT6H blocks that reach 5 hours past where the hourly measures stop, so those
    // hours exist with a precipitation chance and nulls for everything else. An hour
    // has to survive as exactly that rather than being dropped or zero-filled.
    const partial = readings.filter((r) => r.precipChance !== null && r.wbgtF === null);
    expect(partial).toHaveLength(5);
    for (const r of partial) {
      expect(r.temperatureF).toBeNull();
      expect(r.heatIndexF).toBeNull();
      expect(r.humidity).toBeNull();
    }
  });

  it('covers the span the forecast actually reaches', () => {
    // 192 hourly slots, 187 of which carry the hourly measures. Pinned so that a
    // parser change which silently drops or duplicates hours is visible.
    expect(readings).toHaveLength(192);
    expect(readings.filter((r) => r.wbgtF !== null)).toHaveLength(187);
    expect(readings.filter((r) => r.temperatureF !== null)).toHaveLength(187);
  });

  it('returns one reading per hour, in order, with no repeats', () => {
    const times = readings.map((r) => r.time.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(times).size).toBe(times.length);
    for (const t of times) expect(t % 3_600_000).toBe(0);
  });

  it('converts to Fahrenheit at the boundary', () => {
    // The fixture is degC throughout; a reading still in Celsius would show up as a
    // September afternoon in Texas at 26 degrees.
    const peak = Math.max(...readings.map((r) => r.temperatureF ?? -Infinity));
    expect(peak).toBeGreaterThan(80);
    expect(peak).toBeLessThan(120);
  });

  it('marks every reading as a forecast', () => {
    for (const r of readings) expect(r.source).toBe('FORECAST');
  });
});

describe('gridpoint formatting', () => {
  it('round-trips', () => {
    expect(formatGridpoint('FWD', 88, 112)).toBe('FWD/88,112');
    expect(parseGridpoint('FWD/88,112')).toEqual({ gridId: 'FWD', gridX: 88, gridY: 112 });
  });

  it('rejects anything that is not a gridpoint', () => {
    expect(parseGridpoint('FWD')).toBeNull();
    expect(parseGridpoint('88,112')).toBeNull();
    expect(parseGridpoint('fwd/88,112')).toBeNull();
  });
});

describe('MockWeatherSource', () => {
  it('shifts the recorded forecast onto the current day without reshaping it', () => {
    const original = readings;
    const shifted = shiftToToday(original, new Date('2027-03-04T09:00:00Z'));
    expect(shifted[0].time.toISOString()).toBe('2027-03-04T00:00:00.000Z');
    expect(shifted).toHaveLength(original.length);
    // Same spacing throughout, so gaps in the real forecast survive the shift.
    for (let i = 1; i < original.length; i++) {
      expect(shifted[i].time.getTime() - shifted[i - 1].time.getTime()).toBe(
        original[i].time.getTime() - original[i - 1].time.getTime()
      );
    }
    expect(shifted[10].wbgtF).toBe(original[10].wbgtF);
  });

  it('returns only the window asked for', async () => {
    const now = new Date('2027-03-04T00:00:00Z');
    const source = new MockWeatherSource(now);
    const from = new Date('2027-03-05T00:00:00Z');
    const to = new Date('2027-03-06T00:00:00Z');
    const got = await source.getHourly(from, to);
    expect(got.length).toBeGreaterThan(0);
    for (const r of got) {
      expect(r.time.getTime()).toBeGreaterThanOrEqual(from.getTime());
      expect(r.time.getTime()).toBeLessThan(to.getTime());
    }
  });
});
