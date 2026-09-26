// backend/src/modules/weather/scan.ts
//
// The daily scan. This is the piece that was missing.
//
// Everything it needs to act already existed and was never wired to a trigger: the
// rain plan could move events to a fallback space, the conflicts engine could say
// what a closure displaces, suggestSlots could find somewhere else to go, and a
// WEATHER blocker already raised an urgent WEATHER_ALERT. All of it waited on a
// person deciding, that morning, to go and look.
//
// Truman's complaint was not that nobody moved the practices. It was that the
// decision arrived at 3pm for a 3:30 practice, by which time the only indoor space
// was already taken and the parents had to be called. The forecast is what turns
// that into a Tuesday decision.
//
// Two things this deliberately does not do. It raises nothing for a school that has
// not stated a threshold, because the number is a safety decision and not ours. And
// it never moves an event: it raises the blocker and names the alternatives, and a
// person chooses. A job that quietly rebooked practices would be the 3pm phone call
// again, with nobody to ask.

import { prisma } from '../../common/db.js';
import { blockerService } from '../blockers/service.js';
import { notificationService } from '../notifications/service.js';
import { bulkOpsService } from '../bulk-ops/service.js';
import { getWeatherSource, toLocation } from './index.js';
import {
  readPolicy,
  hasThreshold,
  assessWindow,
  upcomingDates,
  windowBounds,
  type WeatherPolicy,
  type WindowAssessment,
} from './policy.js';
import type { WeatherSource } from './source.js';

/** The UTC calendar date of an instant, which is how rainPlan reads its arguments. */
function utcDate(when: Date): string {
  return when.toISOString().slice(0, 10);
}

/** Recorded as the blocker's author. The column is free text with no user FK. */
export const WEATHER_ACTOR = 'system:weather';

/** Every blocker this job owns for a school starts with this. */
export function sourceKeyPrefix(schoolId: string): string {
  return `weather:${schoolId}:`;
}

export function sourceKeyFor(schoolId: string, date: string, facilityId: string): string {
  return `${sourceKeyPrefix(schoolId)}${date}:${facilityId}`;
}

export interface AffectedFacility {
  facilityId: string;
  facilityName: string;
  /** Games and practices booked there inside the window that day. */
  eventCount: number;
  /** The configured indoor fallback, when the school has set one. */
  fallbackFacilityId: string | null;
  fallbackFacilityName: string | null;
  /**
   * Whether that fallback already has something in it. The difference between
   * "move them to the gym" and Truman's afternoon.
   */
  fallbackOccupied: boolean;
  blockerId: string;
  blockerCreated: boolean;
  /**
   * The closure already existed but now runs at a different time. Worth telling
   * people about: a coach who read "the stadium is out until 6:30" needs to know
   * when it becomes 7:00.
   */
  blockerChanged: boolean;
}

export interface DayOutcome {
  date: string;
  assessment: WindowAssessment;
  affected: AffectedFacility[];
}

export interface SchoolScanResult {
  schoolId: string;
  schoolName: string;
  /** Why nothing was assessed, when nothing was. */
  skipped: 'no-location' | null;
  /** True when the school has not stated a threshold; conditions reported only. */
  reportOnly: boolean;
  /** Set when the school's weather settings would not parse. */
  settingsError: string | null;
  days: DayOutcome[];
  blockersCreated: number;
  blockersUpdated: number;
  blockersWithdrawn: number;
  notificationsSent: number;
}

interface ScanOptions {
  /** Anchor for "today". Injected so tests are not tied to the wall clock. */
  now?: Date;
  /** Overrides the configured source. Tests pass a recorded forecast. */
  source?: WeatherSource;
  /** Skip sending notifications. Used when previewing a scan. */
  quiet?: boolean;
}

export const weatherScanService = {
  /** Scan one school. Never throws for a condition the school can fix itself. */
  async scanSchool(schoolId: string, options: ScanOptions = {}): Promise<SchoolScanResult> {
    const now = options.now ?? new Date();
    const school = await prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        timezone: true,
        settings: true,
        latitude: true,
        longitude: true,
        weatherGridpoint: true,
      },
    });

    const { policy, error: settingsError } = readPolicy(school.settings);
    const result: SchoolScanResult = {
      schoolId,
      schoolName: school.name,
      skipped: null,
      reportOnly: !hasThreshold(policy),
      settingsError,
      days: [],
      blockersCreated: 0,
      blockersUpdated: 0,
      blockersWithdrawn: 0,
      notificationsSent: 0,
    };

    const source = options.source ?? getWeatherSource(toLocation(school));
    if (!source) {
      // No coordinates. Not an error - most schools will not have them until
      // someone fills them in - and forecasting for a guessed location is worse
      // than forecasting for none.
      result.skipped = 'no-location';
      return result;
    }

    const dates = upcomingDates(now, policy.lookaheadDays, school.timezone);
    const readings = await source.getHourly(
      windowBounds(dates[0], policy, school.timezone).start,
      // One day past the last, so the final day's whole window is covered.
      windowBounds(dates[dates.length - 1], policy, school.timezone).end
    );

    const keysAsserted: string[] = [];

    for (const date of dates) {
      const assessment = assessWindow(readings, date, policy, school.timezone);
      const outcome: DayOutcome = { date, assessment, affected: [] };
      result.days.push(outcome);
      if (!assessment.breach) continue;

      outcome.affected = await this.raiseForDay(school, policy, date, assessment, result);
      for (const facility of outcome.affected) {
        keysAsserted.push(sourceKeyFor(schoolId, date, facility.facilityId));
      }
    }

    // A forecast that dropped back below the threshold takes its blocker with it.
    // Only rows this job owns are touched; a blocker a person typed is never
    // removed by a job.
    result.blockersWithdrawn = await blockerService.withdrawSourced(
      schoolId,
      sourceKeyPrefix(schoolId),
      keysAsserted,
      // Only the days this run assessed. A scan that looked three days ahead is
      // in no position to retract last month's closure, which is a record of
      // what happened rather than a forecast it still asserts.
      {
        from: windowBounds(dates[0], policy, school.timezone).start,
        to: windowBounds(dates[dates.length - 1], policy, school.timezone).end,
      }
    );

    if (!options.quiet) {
      result.notificationsSent = await this.notify(school, policy, result);
    }

    return result;
  },

  /**
   * Raise a blocker per outdoor facility that has something booked in the window.
   *
   * Scoped to the facility rather than the whole school: a heat closure stops the
   * stadium, and the gym next to it is exactly where those teams need to go.
   */
  async raiseForDay(
    school: { id: string; name: string; timezone: string },
    policy: WeatherPolicy,
    date: string,
    assessment: WindowAssessment,
    tally: SchoolScanResult
  ): Promise<AffectedFacility[]> {
    const { start, end } = windowBounds(date, policy, school.timezone);

    const outdoor = await prisma.facility.findMany({
      where: { schoolId: school.id, isOutdoor: true },
      select: {
        id: true,
        name: true,
        rainFallbackId: true,
        rainFallback: { select: { id: true, name: true } },
      },
    });
    if (outdoor.length === 0) return [];

    const outdoorIds = outdoor.map((f) => f.id);
    const where = {
      facilityId: { in: outdoorIds },
      datetime: { gte: start, lt: end },
      season: { team: { schoolId: school.id } },
    };
    const [games, practices] = await Promise.all([
      prisma.game.groupBy({ by: ['facilityId'], where, _count: { _all: true } }),
      prisma.practice.groupBy({ by: ['facilityId'], where, _count: { _all: true } }),
    ]);

    const counts = new Map<string, number>();
    for (const row of [...games, ...practices]) {
      if (!row.facilityId) continue;
      counts.set(row.facilityId, (counts.get(row.facilityId) ?? 0) + row._count._all);
    }

    // A closure nobody had booked anything under is not worth anyone's attention.
    const withEvents = outdoor.filter((f) => (counts.get(f.id) ?? 0) > 0);
    if (withEvents.length === 0) return [];

    // One rain-plan dry run for the whole day answers "is the fallback free" for
    // every facility at once, reusing the check the manual rain plan already does.
    // rainPlan takes calendar dates and treats them as whole UTC days. An 18:30
    // Central practice window is 23:30 UTC and a later one crosses midnight, so
    // asking for one UTC day both misses the far end of the window and drags in
    // events from a neighbouring day. Ask for the days the window touches, then
    // keep only the moves actually inside it.
    const rain = await bulkOpsService.rainPlan(school.id, {
      fromDate: utcDate(start),
      toDate: utcDate(new Date(end.getTime() - 1)),
      dryRun: true,
    });
    const occupiedFallbacks = new Set(
      rain.moves
        .filter((m) => {
          const at = new Date(m.datetime).getTime();
          return at >= start.getTime() && at < end.getTime();
        })
        .filter((m) => m.fallbackOccupied)
        .map((m) => m.originalFacilityId)
    );

    const affected: AffectedFacility[] = [];
    for (const facility of withEvents) {
      const sourceKey = sourceKeyFor(school.id, date, facility.id);
      const measure = policy.measure === 'WBGT' ? 'Heat' : 'Heat index';

      const { blocker, created, changed } = await blockerService.upsertSourced(
        school.id,
        sourceKey,
        {
          type: 'WEATHER',
          name: `${measure} closure: ${facility.name}`.slice(0, 100),
          description: describe(assessment, policy),
          scope: 'FACILITY',
          facilityId: facility.id,
          startDatetime: start,
          endDatetime: end,
        },
        WEATHER_ACTOR
      );

      if (created) tally.blockersCreated++;
      else if (changed) tally.blockersUpdated++;

      affected.push({
        facilityId: facility.id,
        facilityName: facility.name,
        eventCount: counts.get(facility.id) ?? 0,
        fallbackFacilityId: facility.rainFallback?.id ?? null,
        fallbackFacilityName: facility.rainFallback?.name ?? null,
        fallbackOccupied: occupiedFallbacks.has(facility.id),
        blockerId: blocker.id,
        blockerCreated: created,
        blockerChanged: changed,
      });
    }

    return affected;
  },

  /**
   * One notification per school per run, covering everything newly raised.
   *
   * Silent when nothing is new. A daily job over a rolling three-day window sees
   * Thursday three times, and mailing every coach each morning about a closure they
   * already acted on is how an alert stops being read.
   */
  async notify(
    school: { id: string; timezone: string },
    policy: WeatherPolicy,
    result: SchoolScanResult
  ): Promise<number> {
    // Newly raised OR moved. upsertSourced returns `changed` precisely so a
    // closure whose window shifts is not silently different from the one people
    // were already told about; reading only `blockerCreated` left that promise
    // unkept.
    const isNews = (f: AffectedFacility) => f.blockerCreated || f.blockerChanged;
    const fresh = result.days.filter((d) => d.affected.some(isNews));
    if (fresh.length === 0) return 0;

    await notificationService.emit({
      trigger: 'WEATHER_ALERT',
      schoolId: school.id,
      eventType: 'BLOCKER',
      metadata: {
        action: 'weather_scan',
        measure: policy.measure,
        thresholdF: policy.thresholdF,
        // Everything a reader needs to decide, including where they could go.
        days: fresh.map((day) => ({
          date: day.date,
          peakF: day.assessment.peakF,
          facilities: day.affected
            .filter(isNews)
            .map((f) => ({
              name: f.facilityName,
              events: f.eventCount,
              fallback: f.fallbackFacilityName,
              fallbackOccupied: f.fallbackOccupied,
            })),
        })),
      },
    });

    return 1;
  },

  /** Scan every school. One school's failure does not stop the others. */
  async scanAll(options: ScanOptions = {}): Promise<{
    results: SchoolScanResult[];
    failures: Array<{ schoolId: string; errorKind: string }>;
  }> {
    const schools = await prisma.school.findMany({ select: { id: true } });
    const results: SchoolScanResult[] = [];
    const failures: Array<{ schoolId: string; errorKind: string }> = [];

    for (const school of schools) {
      try {
        results.push(await this.scanSchool(school.id, options));
      } catch (err) {
        failures.push({
          schoolId: school.id,
          errorKind: err instanceof Error ? err.name : 'unknown',
        });
      }
    }

    return { results, failures };
  },
};

/**
 * What the blocker says on the schedule.
 *
 * Names the measure and that it is a forecast. A number on a schedule with no
 * qualifier reads as a measurement, and this one is a prediction made days out - the
 * reading a heat policy is actually administered from is taken on the field, within
 * 15 minutes of practice.
 */
function describe(assessment: WindowAssessment, policy: WeatherPolicy): string {
  const measure = policy.measure === 'WBGT' ? 'wet bulb globe temperature' : 'heat index';
  const peak = assessment.peakF === null ? 'unknown' : `${assessment.peakF.toFixed(1)}F`;
  return (
    `Forecast ${measure} peaks at ${peak}, at or above the ${policy.thresholdF}F ` +
    `threshold set by the school. Forecast only - confirm with an on-site reading ` +
    `before practice.`
  ).slice(0, 500);
}
