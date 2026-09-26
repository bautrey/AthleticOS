// backend/src/modules/weather/mock-source.ts
//
// The recorded FWD/88,112 forecast, replayed.
//
// Mirrors the mock/live split the SKY client uses (getBlackbaudClient, client.ts:279)
// so local development and the test suite never depend on the live forecast, which
// changes every hour and would make any assertion about a specific temperature rot
// within the day.
//
// The fixture's own timestamps are from the morning it was captured, so replaying it
// verbatim would put every reading in the past and the scan would find nothing. The
// series is therefore shifted so its first hour lands on the start of the current
// UTC day. Shape, spacing, gaps and the relationship between the measures are all
// preserved; only the clock moves.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import type { HourlyReading, WeatherSource } from './source.js';
import { readingsFromGridpoint, type GridpointProperties } from './gridpoint.js';

const here = dirname(fileURLToPath(import.meta.url));

export const FIXTURE_PATH = resolve(here, 'fixtures/nws-gridpoint-fwd-88-112.json');

/** The recorded response, parsed. Exported so tests can read it unshifted. */
export function loadGridpointFixture(): GridpointProperties {
  const raw = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as {
    properties?: GridpointProperties;
  };
  return raw.properties ?? {};
}

export class MockWeatherSource implements WeatherSource {
  readonly name = 'mock';
  readonly kind = 'FORECAST' as const;

  /** @param now anchor for the shift; defaults to the real clock. */
  constructor(private now: Date = new Date()) {}

  async getHourly(from: Date, to: Date): Promise<HourlyReading[]> {
    return shiftToToday(readingsFromGridpoint(loadGridpointFixture(), this.kind), this.now).filter(
      (r) => r.time >= from && r.time < to
    );
  }
}

/**
 * Move a recorded series so it starts at midnight UTC of `now`'s day, keeping every
 * interval between readings exactly as recorded.
 */
export function shiftToToday(readings: HourlyReading[], now: Date): HourlyReading[] {
  if (readings.length === 0) return [];
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const offset = startOfToday - readings[0].time.getTime();
  return readings.map((r) => ({ ...r, time: new Date(r.time.getTime() + offset) }));
}
