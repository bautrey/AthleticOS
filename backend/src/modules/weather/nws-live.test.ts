// backend/src/modules/weather/nws-live.test.ts
//
// Hits the real api.weather.gov. Skipped unless WEATHER_LIVE_TEST=1, so the suite
// stays offline by default and nobody's build depends on the National Weather
// Service being up.
//
// Run it with:
//   WEATHER_LIVE_TEST=1 npx vitest run src/modules/weather/nws-live.test.ts
//
// Worth running whenever the parser changes, because the recorded fixture can only
// prove we still read the response we saw in September. It cannot notice NWS
// dropping a series, renaming a field, or changing its interval durations - and
// wetBulbGlobeTemperature, which the whole policy is keyed on, is not documented as
// guaranteed for every forecast office.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../common/db.js';
import { NwsSource, clearWeatherCache } from './nws-source.js';
import { readingsFromGridpoint, parseGridpoint } from './gridpoint.js';
import type { SchoolLocation } from './source.js';

const live = process.env.WEATHER_LIVE_TEST === '1';

// TCA, Addison TX. Resolves to FWD/88,112.
const TCA_LATITUDE = 32.9668;
const TCA_LONGITUDE = -96.8236;

let schoolId: string;
let TCA: SchoolLocation;

describe.skipIf(!live)('live NWS', () => {
  beforeAll(async () => {
    // A real school, so the outbound-call trail is exercised rather than silently
    // dropped on a foreign key. What we fetch on a school's behalf is meant to be
    // visible to that school, and this is the only test that proves it lands.
    const school = await prisma.school.create({
      data: {
        name: `NWS Live Test ${Date.now()}`,
        timezone: 'America/Chicago',
        latitude: TCA_LATITUDE,
        longitude: TCA_LONGITUDE,
      },
    });
    schoolId = school.id;
    TCA = {
      schoolId,
      latitude: TCA_LATITUDE,
      longitude: TCA_LONGITUDE,
      gridpoint: null,
    };
  });

  afterAll(async () => {
    await prisma.externalApiCall.deleteMany({ where: { schoolId } });
    await prisma.school.delete({ where: { id: schoolId } });
    await prisma.$disconnect();
  });

  it('resolves TCA to a gridpoint and reports it back for caching', async () => {
    clearWeatherCache();
    let cached: string | null = null;
    const source = new NwsSource({ ...TCA }, async (gridpoint) => {
      cached = gridpoint;
    });

    const from = new Date();
    const to = new Date(from.getTime() + 3 * 86_400_000);
    await source.getHourly(from, to);

    expect(cached).toBe('FWD/88,112');
    expect(parseGridpoint(cached!)).not.toBeNull();
  });

  it('still publishes the measure the policy is keyed on', async () => {
    clearWeatherCache();
    const source = new NwsSource({ ...TCA, gridpoint: 'FWD/88,112' });
    const from = new Date();
    const readings = await source.getHourly(from, new Date(from.getTime() + 3 * 86_400_000));

    expect(readings.length).toBeGreaterThan(24);
    const wbgt = readings.filter((r) => r.wbgtF !== null);
    expect(wbgt.length).toBeGreaterThan(24);

    // Plausible for north Texas rather than a unit-conversion mistake: a series
    // still in Celsius would put a summer afternoon in the twenties.
    for (const reading of wbgt) {
      expect(reading.wbgtF!).toBeGreaterThan(-20);
      expect(reading.wbgtF!).toBeLessThan(120);
    }
  });

  it('parses every interval duration the live response uses', async () => {
    // The fixture showed six different durations in one series. If a new one
    // appears that intervalHours refuses, those hours silently vanish from the
    // forecast, so assert the parser accounted for the whole response.
    const res = await fetch('https://api.weather.gov/gridpoints/FWD/88,112', {
      headers: { 'User-Agent': 'AthleticOS/1.0 (burke@autreymail.com)' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { properties?: Record<string, unknown> };
    const properties = body.properties ?? {};

    const readings = readingsFromGridpoint(properties);
    const series = properties.wetBulbGlobeTemperature as
      | { values?: Array<{ validTime: string; value: number | null }> }
      | undefined;

    const hoursDeclared = (series?.values ?? [])
      .filter((v) => v.value !== null)
      .reduce((total, v) => {
        const match = /\/P(?:(\d+)D)?(?:T(\d+)H)?$/.exec(v.validTime);
        return total + (match ? Number(match[1] ?? 0) * 24 + Number(match[2] ?? 0) : 0);
      }, 0);

    expect(readings.filter((r) => r.wbgtF !== null)).toHaveLength(hoursDeclared);
  });

  it('records what it fetched in the school\'s outbound-call trail', async () => {
    clearWeatherCache();
    await new NwsSource({ ...TCA, gridpoint: 'FWD/88,112' }).getHourly(
      new Date(),
      new Date(Date.now() + 86_400_000)
    );

    const calls = await prisma.externalApiCall.findMany({
      where: { schoolId, system: 'NWS' },
      orderBy: { createdAt: 'desc' },
    });
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]).toMatchObject({ system: 'NWS', method: 'GET', status: 200 });
    expect(calls[0].path).toContain('/gridpoints/FWD/88,112');
    expect(calls[0].durationMs).toBeGreaterThan(0);
  });
});
