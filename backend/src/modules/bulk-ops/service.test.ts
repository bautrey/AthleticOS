// backend/src/modules/bulk-ops/service.test.ts
// Uses real database per NO MOCKS policy.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../common/db.js';
import { bulkOpsService } from './service.js';
import { ValidationError } from '../../common/errors.js';

const NS = `bulk-ops-${Date.now()}`;

let schoolId: string;
let otherSchoolId: string;
let userId: string;
let teamAId: string;
let teamBId: string;
let otherTeamId: string;
let seasonAId: string;
let seasonBId: string;
let otherSeasonId: string;
let outdoorFacilityId: string;
let indoorFallbackId: string;
let gymFacilityId: string;
let outdoorWithoutFallbackId: string;
let otherSchoolOutdoorId: string;
let otherSchoolFallbackId: string;

describe('bulkOpsService', () => {
  beforeAll(async () => {
    await prisma.$connect();

    const user = await prisma.user.create({
      data: { email: `${NS}@test.com`, passwordHash: 'x' },
    });
    userId = user.id;

    const school = await prisma.school.create({
      data: { name: 'Bulk Ops School', timezone: 'America/New_York' },
    });
    schoolId = school.id;

    const otherSchool = await prisma.school.create({
      data: { name: 'Other School', timezone: 'America/New_York' },
    });
    otherSchoolId = otherSchool.id;

    // Membership is required so that notificationService.emit() has a recipient
    // when the bulk operations call it on commit.
    await prisma.schoolUser.create({
      data: { userId, schoolId, role: 'ADMIN' },
    });

    const teamA = await prisma.team.create({
      data: { schoolId, name: 'Soccer A', sport: 'Soccer', level: 'VARSITY' },
    });
    teamAId = teamA.id;
    const teamB = await prisma.team.create({
      data: { schoolId, name: 'Basketball B', sport: 'Basketball', level: 'JV' },
    });
    teamBId = teamB.id;
    const otherTeam = await prisma.team.create({
      data: {
        schoolId: otherSchoolId,
        name: 'Other Soccer',
        sport: 'Soccer',
        level: 'VARSITY',
      },
    });
    otherTeamId = otherTeam.id;

    const seasonA = await prisma.season.create({
      data: {
        teamId: teamAId,
        name: 'Bulk Season A',
        year: 2027,
        startDate: new Date('2027-03-01'),
        endDate: new Date('2027-12-31'),
      },
    });
    seasonAId = seasonA.id;
    const seasonB = await prisma.season.create({
      data: {
        teamId: teamBId,
        name: 'Bulk Season B',
        year: 2027,
        startDate: new Date('2027-03-01'),
        endDate: new Date('2027-12-31'),
      },
    });
    seasonBId = seasonB.id;
    const otherSeason = await prisma.season.create({
      data: {
        teamId: otherTeamId,
        name: 'Other Season',
        year: 2027,
        startDate: new Date('2027-03-01'),
        endDate: new Date('2027-12-31'),
      },
    });
    otherSeasonId = otherSeason.id;

    // Indoor fallback first so the outdoor field can reference it.
    const fallback = await prisma.facility.create({
      data: { schoolId, name: 'Indoor Gym Fallback', type: 'GYM' },
    });
    indoorFallbackId = fallback.id;

    const outdoor = await prisma.facility.create({
      data: {
        schoolId,
        name: 'Soccer Field A',
        type: 'FIELD',
        rainFallbackId: indoorFallbackId,
      },
    });
    outdoorFacilityId = outdoor.id;

    const gym = await prisma.facility.create({
      data: { schoolId, name: 'Main Gym', type: 'GYM' },
    });
    gymFacilityId = gym.id;

    const outdoorNoFallback = await prisma.facility.create({
      data: { schoolId, name: 'Lonely Field', type: 'FIELD' },
    });
    outdoorWithoutFallbackId = outdoorNoFallback.id;

    // Other school facility — to assert cross-school isolation.
    const otherFallback = await prisma.facility.create({
      data: { schoolId: otherSchoolId, name: 'Other Gym', type: 'GYM' },
    });
    otherSchoolFallbackId = otherFallback.id;
    const otherOutdoor = await prisma.facility.create({
      data: {
        schoolId: otherSchoolId,
        name: 'Other Field',
        type: 'FIELD',
        rainFallbackId: otherSchoolFallbackId,
      },
    });
    otherSchoolOutdoorId = otherOutdoor.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({
      where: { schoolId: { in: [schoolId, otherSchoolId] } },
    });
    await prisma.notificationPreference.deleteMany({
      where: { schoolId: { in: [schoolId, otherSchoolId] } },
    });
    await prisma.game.deleteMany({
      where: { season: { team: { schoolId: { in: [schoolId, otherSchoolId] } } } },
    });
    await prisma.practice.deleteMany({
      where: { season: { team: { schoolId: { in: [schoolId, otherSchoolId] } } } },
    });
    await prisma.season.deleteMany({
      where: { id: { in: [seasonAId, seasonBId, otherSeasonId] } },
    });
    await prisma.team.deleteMany({
      where: { id: { in: [teamAId, teamBId, otherTeamId] } },
    });
    // Clear rainFallbackId references before deleting facilities.
    await prisma.facility.updateMany({
      where: { schoolId: { in: [schoolId, otherSchoolId] } },
      data: { rainFallbackId: null },
    });
    await prisma.facility.deleteMany({
      where: { schoolId: { in: [schoolId, otherSchoolId] } },
    });
    await prisma.schoolUser.deleteMany({
      where: { schoolId: { in: [schoolId, otherSchoolId] } },
    });
    await prisma.school.deleteMany({
      where: { id: { in: [schoolId, otherSchoolId] } },
    });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany({
      where: { schoolId: { in: [schoolId, otherSchoolId] } },
    });
    await prisma.game.deleteMany({
      where: { season: { team: { schoolId: { in: [schoolId, otherSchoolId] } } } },
    });
    await prisma.practice.deleteMany({
      where: { season: { team: { schoolId: { in: [schoolId, otherSchoolId] } } } },
    });
  });

  // ─── bulkMove ───────────────────────────────────────────────────────────────
  describe('bulkMove', () => {
    async function seed() {
      const inRangeGame = await prisma.game.create({
        data: {
          seasonId: seasonAId,
          opponent: 'Lincoln',
          datetime: new Date('2027-09-15T15:00:00.000Z'),
          homeAway: 'HOME',
          status: 'SCHEDULED',
          facilityId: outdoorFacilityId,
        },
      });
      const outOfRangeGame = await prisma.game.create({
        data: {
          seasonId: seasonAId,
          opponent: 'OutOfRange',
          datetime: new Date('2027-10-15T15:00:00.000Z'),
          homeAway: 'HOME',
          status: 'SCHEDULED',
        },
      });
      const inRangePractice = await prisma.practice.create({
        data: {
          seasonId: seasonBId,
          datetime: new Date('2027-09-16T15:00:00.000Z'),
          durationMinutes: 90,
        },
      });
      const otherSchoolGame = await prisma.game.create({
        data: {
          seasonId: otherSeasonId,
          opponent: 'Other',
          datetime: new Date('2027-09-15T15:00:00.000Z'),
          homeAway: 'HOME',
          status: 'SCHEDULED',
        },
      });
      return { inRangeGame, outOfRangeGame, inRangePractice, otherSchoolGame };
    }

    it('dry-run returns a preview without persisting changes', async () => {
      const seeded = await seed();
      const result = await bulkOpsService.bulkMove(schoolId, {
        fromDate: '2027-09-01',
        toDate: '2027-09-30',
        offsetMinutes: 60,
        eventType: 'all',
        dryRun: true,
      });

      expect(result.dryRun).toBe(true);
      expect(result.count).toBe(2); // inRangeGame + inRangePractice (excludes other-school)
      // Persisted datetimes unchanged
      const game = await prisma.game.findUnique({ where: { id: seeded.inRangeGame.id } });
      expect(game?.datetime.toISOString()).toBe('2027-09-15T15:00:00.000Z');
    });

    it('shifts events by offsetMinutes when not dryRun', async () => {
      const seeded = await seed();
      const result = await bulkOpsService.bulkMove(schoolId, {
        fromDate: '2027-09-01',
        toDate: '2027-09-30',
        offsetMinutes: 60,
        eventType: 'all',
        dryRun: false,
      });
      expect(result.dryRun).toBe(false);
      expect(result.count).toBe(2);

      const game = await prisma.game.findUnique({ where: { id: seeded.inRangeGame.id } });
      const practice = await prisma.practice.findUnique({
        where: { id: seeded.inRangePractice.id },
      });
      expect(game?.datetime.toISOString()).toBe('2027-09-15T16:00:00.000Z');
      expect(practice?.datetime.toISOString()).toBe('2027-09-16T16:00:00.000Z');

      // Out-of-range game should be untouched.
      const out = await prisma.game.findUnique({ where: { id: seeded.outOfRangeGame.id } });
      expect(out?.datetime.toISOString()).toBe('2027-10-15T15:00:00.000Z');
    });

    it('does not move events from another school', async () => {
      const seeded = await seed();
      await bulkOpsService.bulkMove(schoolId, {
        fromDate: '2027-09-01',
        toDate: '2027-09-30',
        offsetMinutes: 60,
        eventType: 'all',
        dryRun: false,
      });
      const other = await prisma.game.findUnique({ where: { id: seeded.otherSchoolGame.id } });
      expect(other?.datetime.toISOString()).toBe('2027-09-15T15:00:00.000Z');
    });

    it('filters by eventType=game (skips practices)', async () => {
      const seeded = await seed();
      const result = await bulkOpsService.bulkMove(schoolId, {
        fromDate: '2027-09-01',
        toDate: '2027-09-30',
        offsetMinutes: 60,
        eventType: 'game',
        dryRun: false,
      });
      expect(result.count).toBe(1);
      const practice = await prisma.practice.findUnique({
        where: { id: seeded.inRangePractice.id },
      });
      expect(practice?.datetime.toISOString()).toBe('2027-09-16T15:00:00.000Z');
    });

    it('filters by teamId', async () => {
      await seed();
      const result = await bulkOpsService.bulkMove(schoolId, {
        fromDate: '2027-09-01',
        toDate: '2027-09-30',
        offsetMinutes: 60,
        eventType: 'all',
        teamId: teamAId,
        dryRun: true,
      });
      expect(result.count).toBe(1);
      expect(result.moves[0].teamName).toBe('Soccer A');
    });

    it('filters by facilityId', async () => {
      await seed();
      const result = await bulkOpsService.bulkMove(schoolId, {
        fromDate: '2027-09-01',
        toDate: '2027-09-30',
        offsetMinutes: 60,
        eventType: 'all',
        facilityId: outdoorFacilityId,
        dryRun: true,
      });
      expect(result.count).toBe(1);
      expect(result.moves[0].facilityName).toBe('Soccer Field A');
    });

    it('supports negative offsets (shift earlier)', async () => {
      const seeded = await seed();
      await bulkOpsService.bulkMove(schoolId, {
        fromDate: '2027-09-01',
        toDate: '2027-09-30',
        offsetMinutes: -30,
        eventType: 'all',
        dryRun: false,
      });
      const game = await prisma.game.findUnique({ where: { id: seeded.inRangeGame.id } });
      expect(game?.datetime.toISOString()).toBe('2027-09-15T14:30:00.000Z');
    });

    it('rejects fromDate after toDate', async () => {
      await expect(
        bulkOpsService.bulkMove(schoolId, {
          fromDate: '2027-09-30',
          toDate: '2027-09-01',
          offsetMinutes: 60,
          eventType: 'all',
          dryRun: true,
        })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('emits a SCHEDULE_CHANGE notification on commit (and only on commit)', async () => {
      await seed();
      await bulkOpsService.bulkMove(schoolId, {
        fromDate: '2027-09-01',
        toDate: '2027-09-30',
        offsetMinutes: 60,
        eventType: 'all',
        dryRun: true,
      });
      let notifs = await prisma.notification.count({ where: { schoolId } });
      expect(notifs).toBe(0);

      await bulkOpsService.bulkMove(schoolId, {
        fromDate: '2027-09-01',
        toDate: '2027-09-30',
        offsetMinutes: 60,
        eventType: 'all',
        dryRun: false,
      });
      notifs = await prisma.notification.count({ where: { schoolId } });
      expect(notifs).toBeGreaterThan(0);
    });
  });

  // ─── rainPlan ───────────────────────────────────────────────────────────────
  describe('rainPlan', () => {
    async function seed() {
      // Game at outdoor field (has fallback).
      const outdoorGame = await prisma.game.create({
        data: {
          seasonId: seasonAId,
          opponent: 'Rainy Opponent',
          datetime: new Date('2027-09-15T15:00:00.000Z'),
          homeAway: 'HOME',
          status: 'SCHEDULED',
          facilityId: outdoorFacilityId,
        },
      });
      // Practice at outdoor field (has fallback).
      const outdoorPractice = await prisma.practice.create({
        data: {
          seasonId: seasonBId,
          datetime: new Date('2027-09-15T17:00:00.000Z'),
          durationMinutes: 90,
          facilityId: outdoorFacilityId,
        },
      });
      // Game at indoor gym — should NOT be moved.
      const indoorGame = await prisma.game.create({
        data: {
          seasonId: seasonAId,
          opponent: 'Indoor Opponent',
          datetime: new Date('2027-09-15T18:00:00.000Z'),
          homeAway: 'HOME',
          status: 'SCHEDULED',
          facilityId: gymFacilityId,
        },
      });
      // Practice at outdoor facility WITHOUT a rain fallback — skipped.
      const noFallbackPractice = await prisma.practice.create({
        data: {
          seasonId: seasonAId,
          datetime: new Date('2027-09-15T19:00:00.000Z'),
          durationMinutes: 60,
          facilityId: outdoorWithoutFallbackId,
        },
      });
      return { outdoorGame, outdoorPractice, indoorGame, noFallbackPractice };
    }

    it('dry-run lists outdoor events that would be moved to fallback', async () => {
      await seed();
      const result = await bulkOpsService.rainPlan(schoolId, {
        fromDate: '2027-09-15',
        toDate: '2027-09-15',
        dryRun: true,
      });
      expect(result.dryRun).toBe(true);
      expect(result.count).toBe(2); // outdoorGame + outdoorPractice
      result.moves.forEach((m) => {
        expect(m.originalFacility).toBe('Soccer Field A');
        expect(m.fallbackFacility).toBe('Indoor Gym Fallback');
      });
    });

    it('persists facility changes when not dryRun and leaves indoor/no-fallback events alone', async () => {
      const seeded = await seed();
      await bulkOpsService.rainPlan(schoolId, {
        fromDate: '2027-09-15',
        toDate: '2027-09-15',
        dryRun: false,
      });

      const outdoorGame = await prisma.game.findUnique({ where: { id: seeded.outdoorGame.id } });
      const outdoorPractice = await prisma.practice.findUnique({
        where: { id: seeded.outdoorPractice.id },
      });
      const indoorGame = await prisma.game.findUnique({ where: { id: seeded.indoorGame.id } });
      const noFallback = await prisma.practice.findUnique({
        where: { id: seeded.noFallbackPractice.id },
      });

      expect(outdoorGame?.facilityId).toBe(indoorFallbackId);
      expect(outdoorPractice?.facilityId).toBe(indoorFallbackId);
      expect(indoorGame?.facilityId).toBe(gymFacilityId); // unchanged
      expect(noFallback?.facilityId).toBe(outdoorWithoutFallbackId); // unchanged
    });

    it('does not touch outdoor events at another school', async () => {
      const otherGame = await prisma.game.create({
        data: {
          seasonId: otherSeasonId,
          opponent: 'Cross-school',
          datetime: new Date('2027-09-15T15:00:00.000Z'),
          homeAway: 'HOME',
          status: 'SCHEDULED',
          facilityId: otherSchoolOutdoorId,
        },
      });
      await bulkOpsService.rainPlan(schoolId, {
        fromDate: '2027-09-15',
        toDate: '2027-09-15',
        dryRun: false,
      });
      const after = await prisma.game.findUnique({ where: { id: otherGame.id } });
      expect(after?.facilityId).toBe(otherSchoolOutdoorId);
    });

    it('returns count=0 with a helpful message when the school has no fallbacks', async () => {
      // Strip fallback temporarily so the school has none.
      await prisma.facility.update({
        where: { id: outdoorFacilityId },
        data: { rainFallbackId: null },
      });
      try {
        await seed();
        const result = await bulkOpsService.rainPlan(schoolId, {
          fromDate: '2027-09-15',
          toDate: '2027-09-15',
          dryRun: true,
        });
        expect(result.count).toBe(0);
        expect(result.moves).toEqual([]);
        expect(result.message).toMatch(/no outdoor facilities/i);
      } finally {
        await prisma.facility.update({
          where: { id: outdoorFacilityId },
          data: { rainFallbackId: indoorFallbackId },
        });
      }
    });

    it('rejects fromDate after toDate', async () => {
      await expect(
        bulkOpsService.rainPlan(schoolId, {
          fromDate: '2027-09-30',
          toDate: '2027-09-15',
          dryRun: true,
        })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('emits a notification on commit (not on dry-run)', async () => {
      await seed();
      await bulkOpsService.rainPlan(schoolId, {
        fromDate: '2027-09-15',
        toDate: '2027-09-15',
        dryRun: true,
      });
      expect(await prisma.notification.count({ where: { schoolId } })).toBe(0);

      await bulkOpsService.rainPlan(schoolId, {
        fromDate: '2027-09-15',
        toDate: '2027-09-15',
        dryRun: false,
      });
      expect(await prisma.notification.count({ where: { schoolId } })).toBeGreaterThan(0);
    });
  });
});
