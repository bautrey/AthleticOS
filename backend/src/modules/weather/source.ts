// backend/src/modules/weather/source.ts
//
// What a weather reading is, independent of where it came from.
//
// Two kinds of reading exist and they do different jobs. A FORECAST tells you on
// Tuesday that Thursday afternoon is unusable, while there is still time to move a
// practice indoors. An ONSITE reading tells you at 3:15 what the field is actually
// doing, which is what a heat policy is written against - UIL requires the reading
// be taken on site within 15 minutes before practice and every 30 minutes during.
//
// The product needs both and must never present one as the other, so `source` rides
// along on every reading rather than being a property of the system that fetched it.

export type ReadingSource = 'FORECAST' | 'ONSITE';

/**
 * One hour of weather at one place.
 *
 * Everything is Fahrenheit because every Texas heat policy is written in Fahrenheit;
 * conversion happens at the edge of whichever source produced the reading.
 *
 * Any field can be null: NWS publishes each series on its own schedule, so an hour
 * that has a temperature may have no wet bulb globe temperature. Null means the
 * source did not say, and a policy keyed on a missing measure raises nothing.
 */
export interface HourlyReading {
  /** Start of the hour this reading covers, UTC. */
  time: Date;
  source: ReadingSource;
  /**
   * Wet bulb globe temperature. The measure UIL mandates and TAPPS recommends,
   * because it accounts for humidity, wind and solar load rather than humidity alone.
   */
  wbgtF: number | null;
  /** Heat index. Widely understood, and what a weather app shows. */
  heatIndexF: number | null;
  temperatureF: number | null;
  /** Percent. */
  humidity: number | null;
  /** Percent chance of precipitation. */
  precipChance: number | null;
}

export interface WeatherSource {
  /** A stable name for the trail, e.g. "nws" or "mock". */
  readonly name: string;
  readonly kind: ReadingSource;
  /**
   * Hourly readings covering [from, to). May return fewer hours than asked for:
   * forecasts run out, and a station has no future.
   */
  getHourly(from: Date, to: Date): Promise<HourlyReading[]>;
}

/** Where a school is. Resolved once and cached; see School.weatherGridpoint. */
export interface SchoolLocation {
  schoolId: string;
  latitude: number;
  longitude: number;
  /** Cached NWS gridpoint, "FWD/88,112". Null until first resolved. */
  gridpoint: string | null;
}
