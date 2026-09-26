// backend/src/modules/weather/gridpoint.ts
//
// The pure half of the NWS source: turning a gridpoint response into hourly
// readings. Kept apart from the HTTP so it can be tested against a recorded
// response rather than the live forecast, which changes hourly.
//
// NWS publishes each measure as its own series of ISO-8601 intervals rather than
// as rows. A series entry looks like:
//
//   { "validTime": "2026-09-26T06:00:00+00:00/PT2H", "value": 20.55 }
//
// The duration is not fixed. In the recorded FWD response the wet bulb globe
// temperature series alone uses PT1H, PT2H, PT3H, PT4H, PT5H and PT6H, and the
// series do not agree with each other on where their boundaries fall. So a reading
// for 3pm has to be assembled by expanding every series to per-hour points and
// joining on the hour, not by zipping the arrays.

import type { HourlyReading, ReadingSource } from './source.js';

/** One entry of an NWS gridpoint series. */
export interface GridSeriesValue {
  validTime: string;
  value: number | null;
}

export interface GridSeries {
  uom?: string;
  values?: GridSeriesValue[];
}

export interface GridpointProperties {
  wetBulbGlobeTemperature?: GridSeries;
  heatIndex?: GridSeries;
  temperature?: GridSeries;
  relativeHumidity?: GridSeries;
  probabilityOfPrecipitation?: GridSeries;
}

export function celsiusToF(c: number): number {
  return c * 9 / 5 + 32;
}

/**
 * Hours covered by an ISO-8601 interval of the form "<instant>/<duration>".
 *
 * Only the duration forms NWS actually emits are accepted: whole days and whole
 * hours, optionally together ("P1DT6H"). Anything else returns null, because a
 * duration we have not seen is a shape we do not understand, and guessing at it
 * would silently spread one value across the wrong hours.
 */
export function intervalHours(validTime: string): { start: Date; hours: number } | null {
  const slash = validTime.indexOf('/');
  if (slash === -1) return null;

  const start = new Date(validTime.slice(0, slash));
  if (Number.isNaN(start.getTime())) return null;

  const duration = validTime.slice(slash + 1);
  const match = /^P(?:(\d+)D)?(?:T(\d+)H)?$/.exec(duration);
  if (!match) return null;
  const days = match[1] ? Number(match[1]) : 0;
  const hours = match[2] ? Number(match[2]) : 0;
  const total = days * 24 + hours;
  if (total <= 0) return null;

  return { start, hours: total };
}

/**
 * Expand one series into a value per hour, keyed by the hour's UTC epoch millis.
 *
 * A null value is dropped rather than recorded as a zero: NWS uses null to mean it
 * has no figure for that interval, and zero degrees is a temperature.
 */
export function expandSeries(
  series: GridSeries | undefined,
  convert: (raw: number) => number = (v) => v
): Map<number, number> {
  const out = new Map<number, number>();
  for (const entry of series?.values ?? []) {
    if (entry.value === null || entry.value === undefined) continue;
    const interval = intervalHours(entry.validTime);
    if (!interval) continue;
    const converted = convert(entry.value);
    for (let h = 0; h < interval.hours; h++) {
      out.set(interval.start.getTime() + h * 3_600_000, converted);
    }
  }
  return out;
}

/**
 * Join the series we care about into one reading per hour.
 *
 * The hours are the union across series, so an hour that only has a temperature
 * still appears, with nulls for the rest. Sorted ascending.
 */
export function readingsFromGridpoint(
  properties: GridpointProperties,
  source: ReadingSource = 'FORECAST'
): HourlyReading[] {
  const wbgt = expandSeries(properties.wetBulbGlobeTemperature, celsiusToF);
  const heat = expandSeries(properties.heatIndex, celsiusToF);
  const temp = expandSeries(properties.temperature, celsiusToF);
  const humidity = expandSeries(properties.relativeHumidity);
  const precip = expandSeries(properties.probabilityOfPrecipitation);

  const hours = new Set<number>([
    ...wbgt.keys(),
    ...heat.keys(),
    ...temp.keys(),
    ...humidity.keys(),
    ...precip.keys(),
  ]);

  return [...hours]
    .sort((a, b) => a - b)
    .map((ms) => ({
      time: new Date(ms),
      source,
      wbgtF: wbgt.get(ms) ?? null,
      heatIndexF: heat.get(ms) ?? null,
      temperatureF: temp.get(ms) ?? null,
      humidity: humidity.get(ms) ?? null,
      precipChance: precip.get(ms) ?? null,
    }));
}

/** "FWD/88,112" from a /points response. */
export function formatGridpoint(gridId: string, gridX: number, gridY: number): string {
  return `${gridId}/${gridX},${gridY}`;
}

/** The inverse, for building a gridpoint URL from the cached string. */
export function parseGridpoint(gridpoint: string): { gridId: string; gridX: number; gridY: number } | null {
  const match = /^([A-Z]{3})\/(\d+),(\d+)$/.exec(gridpoint.trim());
  if (!match) return null;
  return { gridId: match[1], gridX: Number(match[2]), gridY: Number(match[3]) };
}
