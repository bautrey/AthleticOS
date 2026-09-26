// backend/src/modules/weather/nws-source.ts
//
// api.weather.gov. No API key, no account, US coverage only.
//
// Two calls. `/points/{lat},{lon}` maps a location onto a forecast office and grid
// cell, which never changes for a fixed location, so it is resolved once and cached
// on the School. `/gridpoints/{office}/{x},{y}` then returns every forecast series
// for that cell, including wetBulbGlobeTemperature - the measure UIL mandates and
// TAPPS recommends, which is why the policy can be stated in the same unit the
// school's own written plan uses.
//
// NWS asks for a descriptive User-Agent identifying the application and a contact,
// and rate-limits anonymous clients. One school is one call per run, so the budget
// is not a concern; the cache below exists so that a run scanning several schools
// in the same grid cell does not repeat itself.

import { config } from '../../config.js';
import { recordApiCall, classifyError } from '../blackbaud/audit.js';
import type { HourlyReading, SchoolLocation, WeatherSource } from './source.js';
import {
  readingsFromGridpoint,
  formatGridpoint,
  parseGridpoint,
  type GridpointProperties,
} from './gridpoint.js';

const BASE_URL = 'https://api.weather.gov';

/**
 * NWS asks that this identify the application and give them someone to contact if
 * it misbehaves. A generic agent string gets served 403s.
 */
const USER_AGENT = `AthleticOS/1.0 (${config.NWS_CONTACT_EMAIL})`;

/** Grid cell responses are cached this long. The forecast updates about hourly. */
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
  at: number;
  readings: HourlyReading[];
}

const gridCache = new Map<string, CacheEntry>();

/** Drop everything cached. Tests call this; nothing in production does. */
export function clearWeatherCache(): void {
  gridCache.clear();
}

export class NwsSource implements WeatherSource {
  readonly name = 'nws';
  readonly kind = 'FORECAST' as const;

  constructor(
    private location: SchoolLocation,
    /** Called when a gridpoint is resolved for the first time, to cache it. */
    private onGridpointResolved?: (gridpoint: string) => Promise<void>
  ) {}

  async getHourly(from: Date, to: Date): Promise<HourlyReading[]> {
    const gridpoint = await this.resolveGridpoint();
    const cached = gridCache.get(gridpoint);
    const readings =
      cached && Date.now() - cached.at < CACHE_TTL_MS
        ? cached.readings
        : await this.fetchGrid(gridpoint);

    return readings.filter((r) => r.time >= from && r.time < to);
  }

  /** The cached gridpoint, or a `/points` lookup that caches one. */
  private async resolveGridpoint(): Promise<string> {
    const cached = this.location.gridpoint;
    if (cached && parseGridpoint(cached)) return cached;

    const { latitude, longitude } = this.location;
    // NWS rejects more than four decimal places.
    const path = `/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const body = await this.get<{
      properties?: { gridId?: string; gridX?: number; gridY?: number };
    }>(path);

    const p = body.properties;
    if (!p?.gridId || typeof p.gridX !== 'number' || typeof p.gridY !== 'number') {
      throw new Error(`NWS /points returned no grid for ${path}`);
    }

    const gridpoint = formatGridpoint(p.gridId, p.gridX, p.gridY);
    this.location.gridpoint = gridpoint;
    await this.onGridpointResolved?.(gridpoint);
    return gridpoint;
  }

  private async fetchGrid(gridpoint: string): Promise<HourlyReading[]> {
    const parsed = parseGridpoint(gridpoint);
    if (!parsed) throw new Error(`Malformed gridpoint "${gridpoint}"`);

    const body = await this.get<{ properties?: GridpointProperties }>(
      `/gridpoints/${parsed.gridId}/${parsed.gridX},${parsed.gridY}`
    );
    const readings = readingsFromGridpoint(body.properties ?? {}, this.kind);
    gridCache.set(gridpoint, { at: Date.now(), readings });
    return readings;
  }

  /**
   * One GET, recorded in the outbound-call trail whether it succeeds or not.
   *
   * The trail never carries a body or an error message, only the shape of what
   * happened - same rule as the SKY client it shares the table with.
   */
  private async get<T>(path: string): Promise<T> {
    const startedAt = Date.now();
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      await recordApiCall({
        schoolId: this.location.schoolId,
        system: 'NWS',
        method: 'GET',
        path,
        status: null,
        errorKind: classifyError(err),
        durationMs: Date.now() - startedAt,
      });
      throw err;
    }

    await recordApiCall({
      schoolId: this.location.schoolId,
      system: 'NWS',
      method: 'GET',
      path,
      status: res.status,
      durationMs: Date.now() - startedAt,
    });

    if (!res.ok) throw new Error(`NWS ${res.status} on ${path}`);
    return (await res.json()) as T;
  }
}
