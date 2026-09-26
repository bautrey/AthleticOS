// backend/src/modules/weather/scan.test.ts
//
// Uses a real database per the NO MOCKS policy. The forecast is the one thing that
// is stubbed, because the live one changes hourly and no assertion about a specific
// temperature would survive the afternoon.
//
// The property this file is really about is the third describe block: the job runs
// daily over a rolling window, so it sees Thursday three times, and it has to say
// the same thing each time without stacking blockers or re-mailing anybody.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../common/db.js';
import { weatherScanService, sourceKeyFor, WEATHER_ACTOR } from './scan.js';
import type { HourlyReading, WeatherSource } from './source.js';
import { zonedTimeToUtc } from './policy.js';

const TZ = 'America/Chicago';

let schoolId: string;
let teamId: string;
let seasonId: string;
let stadiumId: string;
let gymId: string;
let indoorCourtId: string;

/** "Today" for every test here, so the forecast and the events line up. */
const NOW = new Date('2027-05-10T12:00:00Z');
const DAY_1 = '2027-05-10';
const DAY_2 = '2027-05-11';
const DAY_3 = '2027-05-12';

/**
 * A forecast that reports `wbgtF` at every hour of the given local dates.
 * Anything not listed is left out entirely, which is how the real one behaves past
 * the end of its range.
 */
function forecastOf(byDate: Record<string, number>): WeatherSource {
  const readings: HourlyReading[] = [];
  for (const [date, wbgtF] of Object.entries(byDate)) {
    for (let hour = 0; hour < 24; hour++) {
      readings.push({
        time: zonedTimeToUtc(date, `${String(hour).padStart(2, '0')}:00`, TZ),
        source: 'FORECAST',
        wbgtF,
        heatIndexF: wbgtF + 8,
        temperatureF: 90,
        humidity: 50,
        precipChance: 0,
      });
    }
  }
  return {
    name: 'test',
    kind: 'FORECAST',
    async getHourly(from, to) {
      return readings.filter((r) => r.time >= from && r.time < to);
    },
  };
}

/** Hot enough to breach on day 2 only. */
const HOT_ON_DAY_2 = forecastOf({ [DAY_1]: 70, [DAY_2]: 88, [DAY_3]: 71 });
const COOL = forecastOf({ [DAY_1]: 70, [DAY_2]: 70, [DAY_3]: 71 });

async function setPolicy(weather: unknown): Promise<void> {
  await prisma.school.update({
    where: { id: schoolId },
    data: { settings: (weather === undefined ? {} : { weather }) as object },
  });
}

async function weatherBlockers() {
  return prisma.blocker.findMany({
    where: { schoolId, type: 'WEATHER' },
    orderBy: { startDatetime: 'asc' },
  });
}

describe('weatherScanService', () => {
  beforeAll(async () => {
    await prisma.$connect();

    const school = await prisma.school.create({
      data: {
        name: `Weather Scan Test ${Date.now()}`,
        timezone: TZ,
        latitude: 32.9668,
        longitude: -96.8236,
      },
    });
    schoolId = school.id;

    const gym = await prisma.facility.create({
      data: { schoolId, name: 'Main Gym', type: 'GYM', isOutdoor: false },
    });
    gymId = gym.id;

    const stadium = await prisma.facility.create({
      data: {
        schoolId,
        name: 'Stadium Turf Field',
        type: 'FIELD',
        isOutdoor: true,
        rainFallbackId: gymId,
      },
    });
    stadiumId = stadium.id;

    const indoorCourt = await prisma.facility.create({
      data: { schoolId, name: 'Field House', type: 'OTHER', isOutdoor: false },
    });
    indoorCourtId = indoorCourt.id;

    const team = await prisma.team.create({
      data: { schoolId, name: 'Scan Test Soccer', sport: 'Soccer', level: 'VARSITY' },
    });
    teamId = team.id;

    const season = await prisma.season.create({
      data: {
        teamId,
        name: 'Spring 2027',
        year: 2027,
        startDate: new Date('2027-03-01T00:00:00Z'),
        endDate: new Date('2027-06-30T00:00:00Z'),
      },
    });
    seasonId = season.id;
  });

  beforeEach(async () => {
    await prisma.practice.deleteMany({ where: { seasonId } });
    await prisma.game.deleteMany({ where: { seasonId } });
    await prisma.blocker.deleteMany({ where: { schoolId } });
    await setPolicy({ thresholdF: 82, measure: 'WBGT', lookaheadDays: 3 });
  });

  afterAll(async () => {
    await prisma.blocker.deleteMany({ where: { schoolId } });
    await prisma.notification.deleteMany({ where: { schoolId } });
    await prisma.practice.deleteMany({ where: { seasonId } });
    await prisma.game.deleteMany({ where: { seasonId } });
    await prisma.season.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { schoolId } });
    await prisma.facility.updateMany({ where: { schoolId }, data: { rainFallbackId: null } });
    await prisma.facility.deleteMany({ where: { schoolId } });
    await prisma.school.delete({ where: { id: schoolId } });
    await prisma.$disconnect();
  });

  /** A practice on the stadium turf inside the default 15:00-18:30 window. */
  async function practiceOutdoors(date: string, facilityId = stadiumId) {
    return prisma.practice.create({
      data: {
        seasonId,
        facilityId,
        datetime: zonedTimeToUtc(date, '16:00', TZ),
        durationMinutes: 90,
      },
    });
  }

  describe('when the school has stated no threshold', () => {
    it('reports the conditions and raises nothing, however hot', async () => {
      // The guard the whole feature turns on. A number we chose would be
      // indistinguishable on screen from one their athletic trainer wrote.
      await setPolicy({ thresholdF: null });
      await practiceOutdoors(DAY_2);

      const result = await weatherScanService.scanSchool(schoolId, {
        now: NOW,
        source: forecastOf({ [DAY_1]: 120, [DAY_2]: 120, [DAY_3]: 120 }),
      });

      expect(result.reportOnly).toBe(true);
      expect(result.days.map((d) => d.assessment.peakF)).toEqual([120, 120, 120]);
      expect(result.days.every((d) => d.assessment.breach === false)).toBe(true);
      expect(result.blockersCreated).toBe(0);
      expect(await weatherBlockers()).toHaveLength(0);
    });

    it('does the same when the settings block is missing entirely', async () => {
      await setPolicy(undefined);
      await practiceOutdoors(DAY_2);
      const result = await weatherScanService.scanSchool(schoolId, {
        now: NOW,
        source: forecastOf({ [DAY_2]: 120 }),
      });
      expect(result.reportOnly).toBe(true);
      expect(await weatherBlockers()).toHaveLength(0);
    });

    it('reports malformed settings rather than reading a threshold out of them', async () => {
      await setPolicy({ thresholdF: 'very hot' });
      await practiceOutdoors(DAY_2);
      const result = await weatherScanService.scanSchool(schoolId, {
        now: NOW,
        source: HOT_ON_DAY_2,
      });
      expect(result.settingsError).toContain('thresholdF');
      expect(result.reportOnly).toBe(true);
      expect(await weatherBlockers()).toHaveLength(0);
    });
  });

  describe('when a threshold is breached', () => {
    it('raises a facility-scoped blocker over the practice window', async () => {
      await practiceOutdoors(DAY_2);

      const result = await weatherScanService.scanSchool(schoolId, {
        now: NOW,
        source: HOT_ON_DAY_2,
        quiet: true,
      });

      expect(result.blockersCreated).toBe(1);
      const [blocker] = await weatherBlockers();
      expect(blocker).toMatchObject({
        type: 'WEATHER',
        scope: 'FACILITY',
        facilityId: stadiumId,
        createdBy: WEATHER_ACTOR,
        sourceKey: sourceKeyFor(schoolId, DAY_2, stadiumId),
      });
      expect(blocker.startDatetime.toISOString()).toBe(
        zonedTimeToUtc(DAY_2, '15:00', TZ).toISOString()
      );
      expect(blocker.endDatetime.toISOString()).toBe(
        zonedTimeToUtc(DAY_2, '18:30', TZ).toISOString()
      );
    });

    it('says on the blocker that the number is a forecast', async () => {
      // A temperature on a schedule with no qualifier reads as a measurement. The
      // reading a heat policy is administered from is taken on the field.
      await practiceOutdoors(DAY_2);
      await weatherScanService.scanSchool(schoolId, {
        now: NOW,
        source: HOT_ON_DAY_2,
        quiet: true,
      });
      const [blocker] = await weatherBlockers();
      expect(blocker.description).toMatch(/forecast/i);
      expect(blocker.description).toMatch(/on-site/i);
      expect(blocker.description).toContain('88.0F');
    });

    it('reports what the closure displaces and where they could go', async () => {
      await practiceOutdoors(DAY_2);
      const result = await weatherScanService.scanSchool(schoolId, {
        now: NOW,
        source: HOT_ON_DAY_2,
        quiet: true,
      });

      const affected = result.days.find((d) => d.date === DAY_2)!.affected;
      expect(affected).toHaveLength(1);
      expect(affected[0]).toMatchObject({
        facilityId: stadiumId,
        facilityName: 'Stadium Turf Field',
        eventCount: 1,
        fallbackFacilityId: gymId,
        fallbackFacilityName: 'Main Gym',
        fallbackOccupied: false,
      });
    });

    it('says when the fallback is already taken', async () => {
      // Truman's afternoon exactly: the turf is out, the gym is the fallback, and
      // the gym already has something in it.
      await practiceOutdoors(DAY_2);
      await practiceOutdoors(DAY_2, gymId);

      const result = await weatherScanService.scanSchool(schoolId, {
        now: NOW,
        source: HOT_ON_DAY_2,
        quiet: true,
      });

      const affected = result.days.find((d) => d.date === DAY_2)!.affected;
      expect(affected.find((a) => a.facilityId === stadiumId)?.fallbackOccupied).toBe(true);
    });

    it('raises nothing for an outdoor facility with nothing booked in it', async () => {
      // A closure over an empty field is not worth anyone's attention.
      const result = await weatherScanService.scanSchool(schoolId, {
        now: NOW,
        source: HOT_ON_DAY_2,
        quiet: true,
      });
      expect(result.blockersCreated).toBe(0);
      expect(await weatherBlockers()).toHaveLength(0);
    });

    it('ignores indoor facilities however hot it is outside', async () => {
      await practiceOutdoors(DAY_2, indoorCourtId);
      const result = await weatherScanService.scanSchool(schoolId, {
        now: NOW,
        source: HOT_ON_DAY_2,
        quiet: true,
      });
      expect(result.blockersCreated).toBe(0);
    });

    it('ignores an outdoor event outside the practice window', async () => {
      await prisma.practice.create({
        data: {
          seasonId,
          facilityId: stadiumId,
          datetime: zonedTimeToUtc(DAY_2, '06:00', TZ),
          durationMinutes: 60,
        },
      });
      const result = await weatherScanService.scanSchool(schoolId, {
        now: NOW,
        source: HOT_ON_DAY_2,
        quiet: true,
      });
      expect(result.blockersCreated).toBe(0);
    });
  });

  describe('running daily over a rolling window', () => {
    it('produces one blocker and one alert across three runs', async () => {
      // A three-day lookahead assesses Thursday on Tuesday, Wednesday and Thursday.
      // Without a key to write against, each pass would add a blocker and mail
      // every coach again about a closure they already acted on.
      await practiceOutdoors(DAY_2);
      await prisma.notification.deleteMany({ where: { schoolId } });

      const first = await weatherScanService.scanSchool(schoolId, {
        now: NOW,
        source: HOT_ON_DAY_2,
      });
      const second = await weatherScanService.scanSchool(schoolId, {
        now: NOW,
        source: HOT_ON_DAY_2,
      });
      const third = await weatherScanService.scanSchool(schoolId, {
        now: NOW,
        source: HOT_ON_DAY_2,
      });

      expect([first.blockersCreated, second.blockersCreated, third.blockersCreated]).toEqual([
        1, 0, 0,
      ]);
      expect([first.notificationsSent, second.notificationsSent, third.notificationsSent]).toEqual(
        [1, 0, 0]
      );
      expect(await weatherBlockers()).toHaveLength(1);
    });

    it('withdraws the blocker when the forecast drops back below the threshold', async () => {
      await practiceOutdoors(DAY_2);

      await weatherScanService.scanSchool(schoolId, {
        now: NOW,
        source: HOT_ON_DAY_2,
        quiet: true,
      });
      expect(await weatherBlockers()).toHaveLength(1);

      const cooled = await weatherScanService.scanSchool(schoolId, {
        now: NOW,
        source: COOL,
        quiet: true,
      });
      expect(cooled.blockersWithdrawn).toBe(1);
      expect(await weatherBlockers()).toHaveLength(0);
    });

    it('never withdraws a blocker a person created', async () => {
      // withdrawSourced only touches rows carrying this job's sourceKey. A closure
      // someone typed in survives a scan that disagrees with it.
      const manual = await prisma.blocker.create({
        data: {
          schoolId,
          type: 'WEATHER',
          name: 'Lightning - called by the AD',
          scope: 'FACILITY',
          facilityId: stadiumId,
          startDatetime: zonedTimeToUtc(DAY_2, '15:00', TZ),
          endDatetime: zonedTimeToUtc(DAY_2, '18:30', TZ),
          createdBy: 'a-real-person',
        },
      });

      await weatherScanService.scanSchool(schoolId, { now: NOW, source: COOL, quiet: true });

      expect(await prisma.blocker.findUnique({ where: { id: manual.id } })).not.toBeNull();
    });

    it('moves the blocker rather than duplicating it when the window changes', async () => {
      await practiceOutdoors(DAY_2);
      await weatherScanService.scanSchool(schoolId, {
        now: NOW,
        source: HOT_ON_DAY_2,
        quiet: true,
      });

      await setPolicy({
        thresholdF: 82,
        measure: 'WBGT',
        lookaheadDays: 3,
        practiceWindow: { start: '14:00', end: '19:00' },
      });
      const second = await weatherScanService.scanSchool(schoolId, {
        now: NOW,
        source: HOT_ON_DAY_2,
        quiet: true,
      });

      expect(second.blockersUpdated).toBe(1);
      const blockers = await weatherBlockers();
      expect(blockers).toHaveLength(1);
      expect(blockers[0].startDatetime.toISOString()).toBe(
        zonedTimeToUtc(DAY_2, '14:00', TZ).toISOString()
      );
    });
  });

  describe('a school with no coordinates', () => {
    it('is skipped rather than forecast for a guessed location', async () => {
      const nowhere = await prisma.school.create({
        data: { name: `No Location ${Date.now()}`, timezone: TZ },
      });
      try {
        const result = await weatherScanService.scanSchool(nowhere.id, { now: NOW });
        expect(result.skipped).toBe('no-location');
        expect(result.days).toEqual([]);
        expect(result.blockersCreated).toBe(0);
      } finally {
        await prisma.school.delete({ where: { id: nowhere.id } });
      }
    });
  });
});
