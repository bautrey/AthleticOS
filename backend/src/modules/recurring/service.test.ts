// backend/src/modules/recurring/service.test.ts
// Uses real database per NO MOCKS policy.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../common/db.js';
import { recurringService } from './service.js';
import { NotFoundError, ValidationError } from '../../common/errors.js';

// Test-data IDs created in beforeAll.
let schoolId: string;
let otherSchoolId: string;
let teamId: string;
let otherTeamId: string;
let seasonId: string;
let otherSeasonId: string;
let facilityId: string;
let userId: string;

// All dates in UTC. Season Jan 4 (Mon) 2027 → Jan 31 2027 (4 full weeks).
// Season is intentionally in the future so updateSeries / deleteSeries
// "future practices only" filters can be exercised.
const SEASON_START = '2027-01-04T00:00:00.000Z';
const SEASON_END = '2027-01-31T23:59:59.999Z';

describe('recurringService', () => {
  beforeAll(async () => {
    await prisma.$connect();

    const user = await prisma.user.create({
      data: { email: `recurring-${Date.now()}@test.com`, passwordHash: 'x' },
    });
    userId = user.id;

    const school = await prisma.school.create({
      data: { name: 'Recurring Test School', timezone: 'America/New_York' },
    });
    schoolId = school.id;

    const other = await prisma.school.create({
      data: { name: 'Recurring Other School', timezone: 'America/New_York' },
    });
    otherSchoolId = other.id;

    const team = await prisma.team.create({
      data: { schoolId, name: 'Rec Team', sport: 'Basketball', level: 'VARSITY' },
    });
    teamId = team.id;

    const otherTeam = await prisma.team.create({
      data: {
        schoolId: otherSchoolId,
        name: 'Other School Team',
        sport: 'Basketball',
        level: 'VARSITY',
      },
    });
    otherTeamId = otherTeam.id;

    const season = await prisma.season.create({
      data: {
        teamId,
        name: 'Rec Season',
        year: 2026,
        startDate: new Date(SEASON_START),
        endDate: new Date(SEASON_END),
      },
    });
    seasonId = season.id;

    const otherSeason = await prisma.season.create({
      data: {
        teamId: otherTeamId,
        name: 'Other Season',
        year: 2026,
        startDate: new Date(SEASON_START),
        endDate: new Date(SEASON_END),
      },
    });
    otherSeasonId = otherSeason.id;

    const facility = await prisma.facility.create({
      data: { schoolId, name: 'Rec Gym', type: 'GYM' },
    });
    facilityId = facility.id;
  });

  afterAll(async () => {
    await prisma.practice.deleteMany({
      where: { season: { team: { schoolId: { in: [schoolId, otherSchoolId] } } } },
    });
    await prisma.blocker.deleteMany({
      where: { schoolId: { in: [schoolId, otherSchoolId] } },
    });
    await prisma.season.deleteMany({ where: { id: { in: [seasonId, otherSeasonId] } } });
    await prisma.team.deleteMany({ where: { id: { in: [teamId, otherTeamId] } } });
    await prisma.facility.deleteMany({ where: { schoolId } });
    await prisma.school.deleteMany({ where: { id: { in: [schoolId, otherSchoolId] } } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.practice.deleteMany({
      where: { season: { team: { schoolId: { in: [schoolId, otherSchoolId] } } } },
    });
    await prisma.blocker.deleteMany({
      where: { schoolId: { in: [schoolId, otherSchoolId] } },
    });
  });

  describe('generateDates', () => {
    it('generates one occurrence per matching day per week in the season', async () => {
      // Mon Jan 5 → Feb 1 is exactly 4 Mondays and 4 Wednesdays.
      const dates = await recurringService.generateDates(seasonId, ['MON', 'WED']);
      expect(dates).toHaveLength(8);
      const mondays = dates.filter((d) => d.getUTCDay() === 1);
      const wednesdays = dates.filter((d) => d.getUTCDay() === 3);
      expect(mondays).toHaveLength(4);
      expect(wednesdays).toHaveLength(4);
    });

    it('includes the start date when it matches the requested day', async () => {
      // Jan 4 2027 is a Monday — should appear in the list when MON is selected.
      const dates = await recurringService.generateDates(seasonId, ['MON']);
      expect(dates[0].toISOString()).toMatch(/^2027-01-04/);
    });

    it('includes the end date when it matches (boundary)', async () => {
      // Season ends Jan 31 (Sunday). SUN selection should include it.
      const dates = await recurringService.generateDates(seasonId, ['SUN']);
      expect(dates[dates.length - 1].toISOString()).toMatch(/^2027-01-31/);
    });

    it('returns empty array when no days match', async () => {
      // A 1-day season on a Monday — request only Sundays.
      const tinySeason = await prisma.season.create({
        data: {
          teamId,
          name: 'Tiny Season',
          year: 2027,
          startDate: new Date('2027-01-04T00:00:00.000Z'),
          endDate: new Date('2027-01-04T23:59:59.999Z'),
        },
      });
      try {
        const dates = await recurringService.generateDates(tinySeason.id, ['SUN']);
        expect(dates).toEqual([]);
      } finally {
        await prisma.season.delete({ where: { id: tinySeason.id } });
      }
    });

    it('throws NotFoundError for an unknown season', async () => {
      await expect(
        recurringService.generateDates('00000000-0000-0000-0000-000000000000', ['MON'])
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('excludeBlockerDates', () => {
    it('marks dates whose practice window overlaps a blocker as excluded', async () => {
      // Blocker covers Wed Jan 6 2027, 14:00-18:00 UTC.
      await prisma.blocker.create({
        data: {
          schoolId,
          type: 'EXAM',
          name: 'Midterm',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2027-01-06T14:00:00.000Z'),
          endDatetime: new Date('2027-01-06T18:00:00.000Z'),
          createdBy: userId,
        },
      });

      const dates = await recurringService.generateDates(seasonId, ['MON', 'WED']);
      // Practice window 15:00-17:00 UTC — overlaps the blocker on Jan 6 2027.
      const annotated = await recurringService.excludeBlockerDates(
        schoolId,
        dates,
        '15:00',
        '17:00'
      );

      const excluded = annotated.filter((d) => d.status === 'excluded');
      expect(excluded).toHaveLength(1);
      expect(excluded[0].date.toISOString()).toMatch(/^2027-01-06/);
      expect(excluded[0].reason).toContain('Midterm');

      // All other dates remain ok.
      expect(annotated.filter((d) => d.status === 'ok')).toHaveLength(dates.length - 1);
    });

    it('does NOT exclude when the blocker ends before the practice starts (touching only)', async () => {
      // Blocker ends exactly at 15:00; practice starts at 15:00 — no real overlap.
      await prisma.blocker.create({
        data: {
          schoolId,
          type: 'EVENT',
          name: 'Touching Blocker',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2027-01-06T13:00:00.000Z'),
          endDatetime: new Date('2027-01-06T15:00:00.000Z'),
          createdBy: userId,
        },
      });

      const dates = await recurringService.generateDates(seasonId, ['WED']);
      const annotated = await recurringService.excludeBlockerDates(
        schoolId,
        dates,
        '15:00',
        '17:00'
      );
      expect(annotated.every((d) => d.status === 'ok')).toBe(true);
    });

    it('excludes a multi-day blocker for every overlapping practice', async () => {
      // Blocker spans Jan 4-11 2027 (covers Mondays Jan 4 and Jan 11 + Wed Jan 6).
      await prisma.blocker.create({
        data: {
          schoolId,
          type: 'HOLIDAY',
          name: 'Big Break',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2027-01-04T00:00:00.000Z'),
          endDatetime: new Date('2027-01-11T23:59:59.999Z'),
          createdBy: userId,
        },
      });

      const dates = await recurringService.generateDates(seasonId, ['MON', 'WED']);
      const annotated = await recurringService.excludeBlockerDates(
        schoolId,
        dates,
        '15:00',
        '17:00'
      );

      const excluded = annotated.filter((d) => d.status === 'excluded');
      // Mon Jan 5, Wed Jan 7, Mon Jan 12 — all overlap.
      expect(excluded.length).toBeGreaterThanOrEqual(3);
    });

    it('returns [] for empty input', async () => {
      const annotated = await recurringService.excludeBlockerDates(
        schoolId,
        [],
        '15:00',
        '17:00'
      );
      expect(annotated).toEqual([]);
    });

    it('attaches the correct day-of-week label', async () => {
      const dates = await recurringService.generateDates(seasonId, ['MON', 'FRI']);
      const annotated = await recurringService.excludeBlockerDates(
        schoolId,
        dates,
        '15:00',
        '17:00'
      );
      annotated.forEach((d) => {
        const expected = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.date.getUTCDay()];
        expect(d.dayOfWeek).toBe(expected);
      });
    });
  });

  describe('createRecurringSeries', () => {
    it('dryRun returns a preview and persists nothing', async () => {
      const before = await prisma.practice.count({ where: { seasonId } });
      const preview = await recurringService.createRecurringSeries(schoolId, {
        seasonId,
        days: ['MON', 'WED'],
        startTime: '15:00',
        endTime: '17:00',
        excludeBlockers: true,
        dryRun: true,
      });

      expect(preview.totalGenerated).toBe(8);
      expect(preview.totalOk).toBe(8);
      expect(preview.totalExcluded).toBe(0);
      expect((preview as { practices?: unknown }).practices).toBeUndefined();
      const after = await prisma.practice.count({ where: { seasonId } });
      expect(after).toBe(before);
    });

    it('creates practices with a shared recurrenceGroupId when not dryRun', async () => {
      const result = await recurringService.createRecurringSeries(schoolId, {
        seasonId,
        facilityId,
        days: ['TUE'],
        startTime: '15:30',
        endTime: '17:00',
        excludeBlockers: true,
        dryRun: false,
      });

      expect(result.practices?.length).toBe(4); // 4 Tuesdays in 4 weeks
      const persisted = await prisma.practice.findMany({
        where: { seasonId },
        orderBy: { datetime: 'asc' },
      });
      expect(persisted).toHaveLength(4);
      const groupIds = new Set(persisted.map((p) => p.recurrenceGroupId));
      expect(groupIds.size).toBe(1);
      expect([...groupIds][0]).toBeTruthy();
      // All persisted practices share the right duration + start time.
      persisted.forEach((p) => {
        expect(p.durationMinutes).toBe(90);
        expect(p.datetime.getUTCHours()).toBe(15);
        expect(p.datetime.getUTCMinutes()).toBe(30);
        expect(p.facilityId).toBe(facilityId);
      });
    });

    it('skips blocker-excluded dates when excludeBlockers is true', async () => {
      // Block all of Jan 11 2027 (a Monday).
      await prisma.blocker.create({
        data: {
          schoolId,
          type: 'HOLIDAY',
          name: 'MLK Day',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2027-01-11T00:00:00.000Z'),
          endDatetime: new Date('2027-01-11T23:59:59.999Z'),
          createdBy: userId,
        },
      });

      const result = await recurringService.createRecurringSeries(schoolId, {
        seasonId,
        days: ['MON'],
        startTime: '15:00',
        endTime: '17:00',
        excludeBlockers: true,
        dryRun: false,
      });

      expect(result.totalExcluded).toBe(1);
      expect(result.practices?.length).toBe(3); // 4 Mondays - 1 blocked = 3 created
      const persisted = await prisma.practice.findMany({ where: { seasonId } });
      expect(persisted).toHaveLength(3);
      // Jan 11 should NOT be among the persisted dates.
      expect(persisted.some((p) => p.datetime.toISOString().startsWith('2027-01-11'))).toBe(false);
    });

    it('honors excludeBlockers=false (creates practices through blockers)', async () => {
      await prisma.blocker.create({
        data: {
          schoolId,
          type: 'HOLIDAY',
          name: 'Ignored',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2027-01-11T00:00:00.000Z'),
          endDatetime: new Date('2027-01-11T23:59:59.999Z'),
          createdBy: userId,
        },
      });

      const result = await recurringService.createRecurringSeries(schoolId, {
        seasonId,
        days: ['MON'],
        startTime: '15:00',
        endTime: '17:00',
        excludeBlockers: false,
        dryRun: false,
      });

      expect(result.totalExcluded).toBe(0);
      expect(result.practices?.length).toBe(4);
    });

    it('rejects end time <= start time', async () => {
      await expect(
        recurringService.createRecurringSeries(schoolId, {
          seasonId,
          days: ['MON'],
          startTime: '17:00',
          endTime: '15:00',
          excludeBlockers: true,
          dryRun: true,
        })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects creating practices in another school\'s season', async () => {
      await expect(
        recurringService.createRecurringSeries(schoolId, {
          seasonId: otherSeasonId,
          days: ['MON'],
          startTime: '15:00',
          endTime: '17:00',
          excludeBlockers: true,
          dryRun: true,
        })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws NotFoundError for unknown season', async () => {
      await expect(
        recurringService.createRecurringSeries(schoolId, {
          seasonId: '00000000-0000-0000-0000-000000000000',
          days: ['MON'],
          startTime: '15:00',
          endTime: '17:00',
          excludeBlockers: true,
          dryRun: true,
        })
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('updateSeries', () => {
    async function seedSeries() {
      const result = await recurringService.createRecurringSeries(schoolId, {
        seasonId,
        facilityId,
        days: ['MON', 'WED'],
        startTime: '15:00',
        endTime: '16:30',
        excludeBlockers: false,
        dryRun: false,
      });
      const persisted = await prisma.practice.findMany({ where: { seasonId } });
      return { groupId: persisted[0].recurrenceGroupId!, total: result.practices?.length ?? 0 };
    }

    it('only updates future practices (leaves past ones unchanged)', async () => {
      const { groupId } = await seedSeries();

      // Push half the practices into the past so we can prove the filter works.
      const all = await prisma.practice.findMany({
        where: { recurrenceGroupId: groupId },
        orderBy: { datetime: 'asc' },
      });
      const pastIds = all.slice(0, 4).map((p) => p.id);
      const futureIds = all.slice(4).map((p) => p.id);
      const longAgo = new Date('2020-01-01T15:00:00.000Z');
      for (const id of pastIds) {
        await prisma.practice.update({ where: { id }, data: { datetime: longAgo } });
      }

      const result = await recurringService.updateSeries(schoolId, groupId, { notes: 'Updated' });
      expect(result.updated).toBe(futureIds.length);

      const past = await prisma.practice.findMany({ where: { id: { in: pastIds } } });
      const future = await prisma.practice.findMany({ where: { id: { in: futureIds } } });
      past.forEach((p) => expect(p.notes).toBeNull());
      future.forEach((p) => expect(p.notes).toBe('Updated'));
    });

    it('updates datetime and durationMinutes when startTime / endTime change', async () => {
      const { groupId } = await seedSeries();

      const result = await recurringService.updateSeries(schoolId, groupId, {
        startTime: '16:00',
        endTime: '18:00',
      });
      expect(result.updated).toBeGreaterThan(0);

      const practices = await prisma.practice.findMany({ where: { recurrenceGroupId: groupId } });
      practices.forEach((p) => {
        expect(p.datetime.getUTCHours()).toBe(16);
        expect(p.datetime.getUTCMinutes()).toBe(0);
        expect(p.durationMinutes).toBe(120);
      });
    });

    it('rejects an inverted time window', async () => {
      const { groupId } = await seedSeries();
      await expect(
        recurringService.updateSeries(schoolId, groupId, {
          startTime: '18:00',
          endTime: '16:00',
        })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws NotFoundError for an unknown group', async () => {
      await expect(
        recurringService.updateSeries(schoolId, '00000000-0000-0000-0000-000000000000', {
          notes: 'x',
        })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('refuses to update a group that belongs to a different school', async () => {
      // Create a group in otherSchool, then try to update it from schoolId.
      const otherResult = await recurringService.createRecurringSeries(otherSchoolId, {
        seasonId: otherSeasonId,
        days: ['MON'],
        startTime: '15:00',
        endTime: '17:00',
        excludeBlockers: false,
        dryRun: false,
      });
      const otherGroup = (
        await prisma.practice.findMany({ where: { seasonId: otherSeasonId } })
      )[0].recurrenceGroupId!;
      expect(otherResult.practices?.length).toBeGreaterThan(0);

      await expect(
        recurringService.updateSeries(schoolId, otherGroup, { notes: 'no' })
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('deleteSeries', () => {
    async function seedSeries() {
      await recurringService.createRecurringSeries(schoolId, {
        seasonId,
        days: ['MON'],
        startTime: '15:00',
        endTime: '16:30',
        excludeBlockers: false,
        dryRun: false,
      });
      const persisted = await prisma.practice.findMany({ where: { seasonId } });
      return persisted[0].recurrenceGroupId!;
    }

    it('deletes only future practices in the group', async () => {
      const groupId = await seedSeries();
      const all = await prisma.practice.findMany({
        where: { recurrenceGroupId: groupId },
        orderBy: { datetime: 'asc' },
      });
      const pastIds = all.slice(0, 2).map((p) => p.id);
      const futureIds = all.slice(2).map((p) => p.id);
      const longAgo = new Date('2020-01-01T15:00:00.000Z');
      for (const id of pastIds) {
        await prisma.practice.update({ where: { id }, data: { datetime: longAgo } });
      }

      const result = await recurringService.deleteSeries(schoolId, groupId);
      expect(result.deleted).toBe(futureIds.length);

      const remaining = await prisma.practice.findMany({
        where: { recurrenceGroupId: groupId },
      });
      expect(remaining.map((p) => p.id).sort()).toEqual(pastIds.sort());
    });

    it('returns { deleted: 0 } when all practices are in the past', async () => {
      const groupId = await seedSeries();
      const all = await prisma.practice.findMany({ where: { recurrenceGroupId: groupId } });
      const longAgo = new Date('2020-01-01T15:00:00.000Z');
      for (const p of all) {
        await prisma.practice.update({ where: { id: p.id }, data: { datetime: longAgo } });
      }
      const result = await recurringService.deleteSeries(schoolId, groupId);
      expect(result.deleted).toBe(0);
    });

    it('throws NotFoundError for an unknown group', async () => {
      await expect(
        recurringService.deleteSeries(schoolId, '00000000-0000-0000-0000-000000000000')
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('refuses to delete a group owned by a different school', async () => {
      await recurringService.createRecurringSeries(otherSchoolId, {
        seasonId: otherSeasonId,
        days: ['MON'],
        startTime: '15:00',
        endTime: '17:00',
        excludeBlockers: false,
        dryRun: false,
      });
      const otherGroup = (
        await prisma.practice.findMany({ where: { seasonId: otherSeasonId } })
      )[0].recurrenceGroupId!;

      await expect(
        recurringService.deleteSeries(schoolId, otherGroup)
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
