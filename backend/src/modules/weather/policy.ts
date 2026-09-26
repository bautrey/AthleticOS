// backend/src/modules/weather/policy.ts
//
// A school's heat policy, and the evaluation of a forecast against it.
//
// The one rule this file exists to hold: there is no default threshold.
//
// TCA is a private school, so UIL's mandatory wet bulb globe temperature limits
// (79.7F for Class 2, 82.0F for Class 3, in force since 2026-08-01) do not bind
// them; TAPPS publishes a plan that is explicitly Recommended rather than required.
// The number that governs a practice at TCA is therefore TCA's to state. A number
// we picked would look identical on screen to one their athletic trainer wrote, and
// the first time it differed from their actual policy we would be quietly overriding
// a safety decision that was never ours.
//
// So a school with no configured threshold gets conditions reported and nothing
// raised. `evaluate` returns no breach rather than falling back.
//
// Note also that everything here reads a *forecast*. It is a planning signal, which
// is the thing that was missing - the 3pm phone call for a 3:30 practice. It is not
// the on-site reading a heat policy is administered from, and anything that displays
// these numbers has to say which it is showing.

import { z } from 'zod';
import type { HourlyReading } from './source.js';

/** Which measure the school's written policy is stated in. */
export const heatMeasureSchema = z.enum(['WBGT', 'HEAT_INDEX']);
export type HeatMeasure = z.infer<typeof heatMeasureSchema>;

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected a 24-hour HH:MM time');

export const weatherPolicySchema = z.object({
  /**
   * Null means the school has not stated a policy. Nothing is raised until it does.
   * Deliberately nullable rather than optional-with-a-default.
   */
  thresholdF: z.number().min(0).max(150).nullable().default(null),
  measure: heatMeasureSchema.default('WBGT'),
  /** How many days ahead to warn. Three gives time to rebook a gym and tell parents. */
  lookaheadDays: z.number().int().min(1).max(7).default(3),
  /** The part of the day that practices fall in, in the school's own timezone. */
  practiceWindow: z
    .object({ start: timeOfDay, end: timeOfDay })
    .default({ start: '15:00', end: '18:30' })
    .refine((w) => w.start < w.end, { message: 'practiceWindow.start must be before end' }),
});

export type WeatherPolicy = z.infer<typeof weatherPolicySchema>;

/**
 * Read the weather policy out of School.settings.
 *
 * Unparseable settings yield the no-policy default rather than throwing: a typo in
 * one school's JSON should stop that school from raising alerts, not stop the job.
 * The caller logs the reason.
 */
export function readPolicy(settings: unknown): { policy: WeatherPolicy; error: string | null } {
  const raw = (settings as { weather?: unknown } | null)?.weather;
  const parsed = weatherPolicySchema.safeParse(raw ?? {});
  if (parsed.success) return { policy: parsed.data, error: null };
  return {
    policy: weatherPolicySchema.parse({}),
    error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  };
}

/** Whether the school has said anything for us to act on. */
export function hasThreshold(policy: WeatherPolicy): boolean {
  return policy.thresholdF !== null;
}

/** The reading a policy keyed on this measure looks at. Null when unreported. */
export function measuredValue(reading: HourlyReading, measure: HeatMeasure): number | null {
  return measure === 'WBGT' ? reading.wbgtF : reading.heatIndexF;
}

export interface WindowAssessment {
  /** Local calendar date, "2026-09-26". */
  date: string;
  /** Highest value of the policy's measure inside the practice window. */
  peakF: number | null;
  /** The hour the peak fell in. */
  peakAt: Date | null;
  measure: HeatMeasure;
  /** True only when a threshold is configured and the peak reaches it. */
  breach: boolean;
  /** Hours inside the window that reported the measure at all. */
  hoursObserved: number;
}

/**
 * Assess one day's practice window.
 *
 * `readings` may cover any span; only hours inside the window count. An hour is
 * inside when its start falls in [start, end) in the school's timezone.
 */
export function assessWindow(
  readings: HourlyReading[],
  date: string,
  policy: WeatherPolicy,
  timezone: string
): WindowAssessment {
  const [startH, startM] = policy.practiceWindow.start.split(':').map(Number);
  const [endH, endM] = policy.practiceWindow.end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  let peakF: number | null = null;
  let peakAt: Date | null = null;
  let hoursObserved = 0;

  for (const reading of readings) {
    const local = localParts(reading.time, timezone);
    if (local.date !== date) continue;
    const minutes = local.hour * 60 + local.minute;
    if (minutes < startMinutes || minutes >= endMinutes) continue;

    const value = measuredValue(reading, policy.measure);
    if (value === null) continue;
    hoursObserved++;
    if (peakF === null || value > peakF) {
      peakF = value;
      peakAt = reading.time;
    }
  }

  return {
    date,
    peakF,
    peakAt,
    measure: policy.measure,
    // No threshold means no breach. This is the guard the whole file is built around.
    breach: policy.thresholdF !== null && peakF !== null && peakF >= policy.thresholdF,
    hoursObserved,
  };
}

/** The local calendar date and clock time of an instant, in a named timezone. */
export function localParts(
  when: Date,
  timezone: string
): { date: string; hour: number; minute: number } {
  // Intl is the only thing in the runtime that knows when Texas changed its clocks.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(when);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  // en-CA renders midnight as "24" in some ICU versions; normalise it to 0.
  const hour = Number(get('hour')) % 24;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour,
    minute: Number(get('minute')),
  };
}

/**
 * How far the named zone is ahead of UTC at a given instant, in milliseconds.
 *
 * Derived by formatting the instant in the zone and reading the result back as if
 * it were UTC. Doing it this way rather than from a table means the answer is right
 * on both sides of a daylight saving change without this file knowing when those are.
 */
function zoneOffsetMs(when: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(when);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asIfUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second')
  );
  // Whole seconds: Intl drops milliseconds, so compare against a truncated instant.
  return asIfUtc - Math.floor(when.getTime() / 1000) * 1000;
}

/**
 * The instant at which a local wall-clock time occurs, e.g. 3pm on 2026-09-30 in
 * Chicago.
 *
 * Two passes, because the offset has to be read at an instant and the instant is
 * what is being solved for. The first guess treats the wall time as UTC; if the
 * zone's offset differs at the corrected instant - which happens only around a
 * daylight saving change - the correction is applied again.
 */
export function zonedTimeToUtc(date: string, time: string, timezone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute);

  const firstOffset = zoneOffsetMs(new Date(asIfUtc), timezone);
  const candidate = new Date(asIfUtc - firstOffset);
  const secondOffset = zoneOffsetMs(candidate, timezone);
  return secondOffset === firstOffset ? candidate : new Date(asIfUtc - secondOffset);
}

/** The UTC span of one day's practice window. */
export function windowBounds(
  date: string,
  policy: WeatherPolicy,
  timezone: string
): { start: Date; end: Date } {
  return {
    start: zonedTimeToUtc(date, policy.practiceWindow.start, timezone),
    end: zonedTimeToUtc(date, policy.practiceWindow.end, timezone),
  };
}

/** The next `days` local calendar dates starting from `from`, inclusive. */
export function upcomingDates(from: Date, days: number, timezone: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    out.push(localParts(new Date(from.getTime() + i * 86_400_000), timezone).date);
  }
  return out;
}
