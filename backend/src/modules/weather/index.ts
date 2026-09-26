// backend/src/modules/weather/index.ts
//
// Picks the source. Same downstream code either way, which is the point: when TCA
// confirms the on-site station Burke has seen on their fields, it arrives as one
// more implementation of WeatherSource and nothing that consumes a reading changes.

import { config } from '../../config.js';
import { prisma } from '../../common/db.js';
import type { SchoolLocation, WeatherSource } from './source.js';
import { MockWeatherSource } from './mock-source.js';
import { NwsSource } from './nws-source.js';

export * from './source.js';
export * from './policy.js';
export { readingsFromGridpoint, celsiusToF, intervalHours } from './gridpoint.js';

/**
 * A source for one school.
 *
 * Returns null when the school has no coordinates. That is not an error - most
 * schools will not have them until someone fills them in - and the scan skips the
 * school rather than forecasting for a place we guessed at.
 */
export function getWeatherSource(location: SchoolLocation | null): WeatherSource | null {
  // Location is checked before the mode, not after. Mock mode replays one recorded
  // grid cell, so answering for a school that has no location would hand a school in
  // Ohio the forecast for Addison, Texas and look entirely plausible doing it.
  if (!location) return null;
  if (config.WEATHER_MODE === 'mock') return new MockWeatherSource();
  return new NwsSource(location, async (gridpoint) => {
    await prisma.school.update({
      where: { id: location.schoolId },
      data: { weatherGridpoint: gridpoint },
    });
  });
}

/** The school's location, or null if it has not been set. */
export function toLocation(school: {
  id: string;
  latitude: number | null;
  longitude: number | null;
  weatherGridpoint: string | null;
}): SchoolLocation | null {
  if (school.latitude === null || school.longitude === null) return null;
  return {
    schoolId: school.id,
    latitude: school.latitude,
    longitude: school.longitude,
    gridpoint: school.weatherGridpoint,
  };
}
