// backend/src/modules/conflicts/service.test.ts
// Uses real database per NO MOCKS policy
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../common/db.js';
import { conflictService } from './service.js';
import { NotFoundError } from '../../common/errors.js';

// Test data IDs
let schoolId: string;
let teamId: string;
let facilityId: string;
let otherFacilityId: string;
let seasonId: string;
let otherSeasonId: string;
let userId: string;

describe('ConflictService', () => {
  beforeAll(async () => {
    await prisma.$connect();

    // Create a test user
    const user = await prisma.user.create({
      data: {
        email: `conflict-test-${Date.now()}@test.com`,
        passwordHash: 'test-hash',
      },
    });
    userId = user.id;

    // Create a test school
    const school = await prisma.school.create({
      data: {
        name: 'Conflict Test School',
        timezone: 'America/New_York',
      },
    });
    schoolId = school.id;

    // Create school user association
    await prisma.schoolUser.create({
      data: {
        schoolId: school.id,
        userId: user.id,
        role: 'ADMIN',
      },
    });

    // Create test teams
    const team = await prisma.team.create({
      data: {
        schoolId: school.id,
        name: 'Test Basketball',
        sport: 'Basketball',
        level: 'VARSITY',
      },
    });
    teamId = team.id;

    const otherTeam = await prisma.team.create({
      data: {
        schoolId: school.id,
        name: 'Test Soccer',
        sport: 'Soccer',
        level: 'VARSITY',
      },
    });
    // otherTeamId available for future tests if needed

    // Create test facilities
    const facility = await prisma.facility.create({
      data: {
        schoolId: school.id,
        name: 'Main Gym',
        type: 'GYM',
      },
    });
    facilityId = facility.id;

    const otherFacility = await prisma.facility.create({
      data: {
        schoolId: school.id,
        name: 'Soccer Field',
        type: 'FIELD',
      },
    });
    otherFacilityId = otherFacility.id;

    // Create test seasons
    const season = await prisma.season.create({
      data: {
        teamId: team.id,
        name: 'Basketball 2026',
        year: 2026,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    });
    seasonId = season.id;

    const otherSeason = await prisma.season.create({
      data: {
        teamId: otherTeam.id,
        name: 'Soccer 2026',
        year: 2026,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    });
    otherSeasonId = otherSeason.id;
  });

  afterAll(async () => {
    // Clean up test data in reverse dependency order
    await prisma.conflictOverride.deleteMany({ where: { schoolId } });
    await prisma.blocker.deleteMany({ where: { schoolId } });
    await prisma.game.deleteMany({ where: { season: { team: { schoolId } } } });
    await prisma.practice.deleteMany({ where: { season: { team: { schoolId } } } });
    await prisma.season.deleteMany({ where: { team: { schoolId } } });
    await prisma.facility.deleteMany({ where: { schoolId } });
    await prisma.team.deleteMany({ where: { schoolId } });
    await prisma.schoolUser.deleteMany({ where: { schoolId } });
    await prisma.school.delete({ where: { id: schoolId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up before each test
    await prisma.conflictOverride.deleteMany({ where: { schoolId } });
    await prisma.blocker.deleteMany({ where: { schoolId } });
    await prisma.game.deleteMany({ where: { season: { team: { schoolId } } } });
    await prisma.practice.deleteMany({ where: { season: { team: { schoolId } } } });
  });

  describe('checkEventConflicts - Time Overlap', () => {
    it('detects conflict when event is fully inside blocker', async () => {
      // Blocker: May 15-22
      await prisma.blocker.create({
        data: {
          schoolId,
          type: 'EXAM',
          name: 'Final Exams',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-05-15T00:00:00Z'),
          endDatetime: new Date('2026-05-22T23:59:59Z'),
          createdBy: userId,
        },
      });

      // Event: May 18 (inside blocker)
      const result = await conflictService.checkEventConflicts({
        datetime: new Date('2026-05-18T14:00:00Z'),
        seasonId,
      });

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].blockerName).toBe('Final Exams');
    });

    it('detects conflict when event overlaps blocker start', async () => {
      // Blocker: May 15-22
      await prisma.blocker.create({
        data: {
          schoolId,
          type: 'EXAM',
          name: 'Final Exams',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-05-15T08:00:00Z'),
          endDatetime: new Date('2026-05-22T17:00:00Z'),
          createdBy: userId,
        },
      });

      // Event: May 15 morning (overlaps with blocker start) - 2 hour default duration
      const result = await conflictService.checkEventConflicts({
        datetime: new Date('2026-05-15T07:00:00Z'),
        seasonId,
      });

      expect(result.hasConflicts).toBe(true);
    });

    it('detects conflict when event overlaps blocker end', async () => {
      // Blocker: May 15-22
      await prisma.blocker.create({
        data: {
          schoolId,
          type: 'EXAM',
          name: 'Final Exams',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-05-15T08:00:00Z'),
          endDatetime: new Date('2026-05-22T17:00:00Z'),
          createdBy: userId,
        },
      });

      // Event: May 22 afternoon (overlaps with blocker end)
      const result = await conflictService.checkEventConflicts({
        datetime: new Date('2026-05-22T16:00:00Z'),
        seasonId,
      });

      expect(result.hasConflicts).toBe(true);
    });

    it('no conflict when event is fully outside blocker', async () => {
      // Blocker: May 15-22
      await prisma.blocker.create({
        data: {
          schoolId,
          type: 'EXAM',
          name: 'Final Exams',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-05-15T08:00:00Z'),
          endDatetime: new Date('2026-05-22T17:00:00Z'),
          createdBy: userId,
        },
      });

      // Event: May 1 (before blocker)
      const result = await conflictService.checkEventConflicts({
        datetime: new Date('2026-05-01T14:00:00Z'),
        seasonId,
      });

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });

    it('no conflict at exact blocker boundary (event ends when blocker starts)', async () => {
      // Blocker: May 15 08:00 - May 22 17:00
      await prisma.blocker.create({
        data: {
          schoolId,
          type: 'EXAM',
          name: 'Final Exams',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-05-15T08:00:00Z'),
          endDatetime: new Date('2026-05-22T17:00:00Z'),
          createdBy: userId,
        },
      });

      // Event: May 15 06:00-08:00 (ends exactly when blocker starts)
      const result = await conflictService.checkEventConflicts({
        datetime: new Date('2026-05-15T06:00:00Z'),
        durationMinutes: 120, // 2 hours, ends at 08:00
        seasonId,
      });

      expect(result.hasConflicts).toBe(false);
    });
  });

  describe('checkEventConflicts - Scope Matching', () => {
    it('SCHOOL_WIDE blocker matches all events in school', async () => {
      await prisma.blocker.create({
        data: {
          schoolId,
          type: 'HOLIDAY',
          name: 'Spring Break',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-03-15T00:00:00Z'),
          endDatetime: new Date('2026-03-22T23:59:59Z'),
          createdBy: userId,
        },
      });

      // Check for basketball team
      const basketballResult = await conflictService.checkEventConflicts({
        datetime: new Date('2026-03-18T14:00:00Z'),
        seasonId,
      });

      // Check for soccer team
      const soccerResult = await conflictService.checkEventConflicts({
        datetime: new Date('2026-03-18T14:00:00Z'),
        seasonId: otherSeasonId,
      });

      expect(basketballResult.hasConflicts).toBe(true);
      expect(soccerResult.hasConflicts).toBe(true);
    });

    it('TEAM blocker only matches events for that team', async () => {
      await prisma.blocker.create({
        data: {
          schoolId,
          type: 'TRAVEL',
          name: 'Basketball Tournament',
          scope: 'TEAM',
          teamId,
          startDatetime: new Date('2026-04-01T00:00:00Z'),
          endDatetime: new Date('2026-04-05T23:59:59Z'),
          createdBy: userId,
        },
      });

      // Basketball team should have conflict
      const basketballResult = await conflictService.checkEventConflicts({
        datetime: new Date('2026-04-03T14:00:00Z'),
        seasonId,
      });

      // Soccer team should NOT have conflict
      const soccerResult = await conflictService.checkEventConflicts({
        datetime: new Date('2026-04-03T14:00:00Z'),
        seasonId: otherSeasonId,
      });

      expect(basketballResult.hasConflicts).toBe(true);
      expect(soccerResult.hasConflicts).toBe(false);
    });

    it('FACILITY blocker only matches events at that facility', async () => {
      await prisma.blocker.create({
        data: {
          schoolId,
          type: 'MAINTENANCE',
          name: 'Gym Floor Repair',
          scope: 'FACILITY',
          facilityId,
          startDatetime: new Date('2026-06-01T00:00:00Z'),
          endDatetime: new Date('2026-06-07T23:59:59Z'),
          createdBy: userId,
        },
      });

      // Event at gym should have conflict
      const gymResult = await conflictService.checkEventConflicts({
        datetime: new Date('2026-06-03T14:00:00Z'),
        seasonId,
        facilityId,
      });

      // Event at soccer field should NOT have conflict
      const fieldResult = await conflictService.checkEventConflicts({
        datetime: new Date('2026-06-03T14:00:00Z'),
        seasonId,
        facilityId: otherFacilityId,
      });

      // Event with no facility should NOT have conflict
      const noFacilityResult = await conflictService.checkEventConflicts({
        datetime: new Date('2026-06-03T14:00:00Z'),
        seasonId,
      });

      expect(gymResult.hasConflicts).toBe(true);
      expect(fieldResult.hasConflicts).toBe(false);
      expect(noFacilityResult.hasConflicts).toBe(false);
    });
  });

  describe('checkEventConflicts - Reason Generation', () => {
    it.each([
      ['EXAM', 'School-wide exam period: Finals'],
      ['MAINTENANCE', 'Facility facility maintenance: Gym Repairs'],
      ['EVENT', 'Team school event: Team Building'],
      ['TRAVEL', 'Team travel blackout: Road Trip'],
      ['HOLIDAY', 'School-wide school holiday: Winter Break'],
      ['WEATHER', 'School-wide weather closure: Snow Day'],
      ['CUSTOM', 'School-wide blocked period: Custom Block'],
    ])('generates correct reason for %s blocker type', async (type, expectedReason) => {
      const scope = type === 'MAINTENANCE' ? 'FACILITY' : type === 'EVENT' || type === 'TRAVEL' ? 'TEAM' : 'SCHOOL_WIDE';
      const name = expectedReason.split(': ')[1];

      await prisma.blocker.create({
        data: {
          schoolId,
          type: type as any,
          name,
          scope: scope as any,
          teamId: scope === 'TEAM' ? teamId : null,
          facilityId: scope === 'FACILITY' ? facilityId : null,
          startDatetime: new Date('2026-07-01T00:00:00Z'),
          endDatetime: new Date('2026-07-07T23:59:59Z'),
          createdBy: userId,
        },
      });

      const result = await conflictService.checkEventConflicts({
        datetime: new Date('2026-07-03T14:00:00Z'),
        seasonId,
        facilityId: scope === 'FACILITY' ? facilityId : undefined,
      });

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts[0].reason).toBe(expectedReason);

      // Clean up for next iteration
      await prisma.blocker.deleteMany({ where: { schoolId } });
    });
  });

  describe('checkGameConflicts', () => {
    it('checks conflicts for existing game', async () => {
      // Create a blocker
      await prisma.blocker.create({
        data: {
          schoolId,
          type: 'EXAM',
          name: 'Midterms',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-03-15T00:00:00Z'),
          endDatetime: new Date('2026-03-20T23:59:59Z'),
          createdBy: userId,
        },
      });

      // Create a game during the blocker
      const game = await prisma.game.create({
        data: {
          seasonId,
          opponent: 'Lincoln High',
          datetime: new Date('2026-03-17T18:00:00Z'),
          homeAway: 'HOME',
          status: 'SCHEDULED',
        },
      });

      const result = await conflictService.checkGameConflicts(game.id);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts[0].blockerName).toBe('Midterms');
    });

    it('throws NotFoundError for nonexistent game', async () => {
      await expect(
        conflictService.checkGameConflicts('nonexistent-id')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('checkPracticeConflicts', () => {
    it('checks conflicts for existing practice with duration', async () => {
      // Create a blocker
      await prisma.blocker.create({
        data: {
          schoolId,
          type: 'MAINTENANCE',
          name: 'Gym Cleaning',
          scope: 'FACILITY',
          facilityId,
          startDatetime: new Date('2026-08-01T00:00:00Z'),
          endDatetime: new Date('2026-08-07T23:59:59Z'),
          createdBy: userId,
        },
      });

      // Create a practice at the facility during blocker
      const practice = await prisma.practice.create({
        data: {
          seasonId,
          facilityId,
          datetime: new Date('2026-08-03T15:00:00Z'),
          durationMinutes: 90,
        },
      });

      const result = await conflictService.checkPracticeConflicts(practice.id);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts[0].blockerName).toBe('Gym Cleaning');
    });

    it('throws NotFoundError for nonexistent practice', async () => {
      await expect(
        conflictService.checkPracticeConflicts('nonexistent-id')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('findConflictingEvents', () => {
    it('finds games and practices that conflict with blocker', async () => {
      // Create games and practices
      await prisma.game.create({
        data: {
          seasonId,
          opponent: 'Riverside',
          datetime: new Date('2026-09-03T18:00:00Z'),
          homeAway: 'HOME',
          status: 'SCHEDULED',
        },
      });

      await prisma.practice.create({
        data: {
          seasonId,
          datetime: new Date('2026-09-04T15:00:00Z'),
          durationMinutes: 90,
        },
      });

      await prisma.practice.create({
        data: {
          seasonId,
          datetime: new Date('2026-09-05T15:00:00Z'),
          durationMinutes: 90,
        },
      });

      // Create a blocker that overlaps with these events
      const blocker = await prisma.blocker.create({
        data: {
          schoolId,
          type: 'EVENT',
          name: 'School Assembly',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-09-01T00:00:00Z'),
          endDatetime: new Date('2026-09-10T23:59:59Z'),
          createdBy: userId,
        },
      });

      const result = await conflictService.findConflictingEvents(blocker.id);

      expect(result.games).toHaveLength(1);
      expect(result.games[0].opponent).toBe('Riverside');
      expect(result.practices).toHaveLength(2);
      expect(result.totalCount).toBe(3);
    });

    it('throws NotFoundError for nonexistent blocker', async () => {
      await expect(
        conflictService.findConflictingEvents('nonexistent-id')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getSeasonConflictSummary', () => {
    it('returns summary of all conflicts in season', async () => {
      // Create a blocker
      await prisma.blocker.create({
        data: {
          schoolId,
          type: 'EXAM',
          name: 'Finals Week',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-12-10T00:00:00Z'),
          endDatetime: new Date('2026-12-20T23:59:59Z'),
          createdBy: userId,
        },
      });

      // Create events - some conflicting, some not
      await prisma.game.create({
        data: {
          seasonId,
          opponent: 'Central High',
          datetime: new Date('2026-12-15T18:00:00Z'), // Conflicts
          homeAway: 'HOME',
          status: 'SCHEDULED',
        },
      });

      await prisma.game.create({
        data: {
          seasonId,
          opponent: 'West High',
          datetime: new Date('2026-11-15T18:00:00Z'), // No conflict
          homeAway: 'AWAY',
          status: 'SCHEDULED',
        },
      });

      await prisma.practice.create({
        data: {
          seasonId,
          datetime: new Date('2026-12-12T15:00:00Z'), // Conflicts
          durationMinutes: 90,
        },
      });

      const result = await conflictService.getSeasonConflictSummary(seasonId);

      expect(result.gamesWithConflicts).toBe(1);
      expect(result.practicesWithConflicts).toBe(1);
      expect(result.totalConflicts).toBe(2);
      expect(result.conflictingEvents).toHaveLength(2);
    });

    it('throws NotFoundError for nonexistent season', async () => {
      await expect(
        conflictService.getSeasonConflictSummary('nonexistent-id')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('createOverride', () => {
    it('creates an override for a game with conflict', async () => {
      // Create a blocker
      const blocker = await prisma.blocker.create({
        data: {
          schoolId,
          type: 'EXAM',
          name: 'Test Exam',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-10-01T00:00:00Z'),
          endDatetime: new Date('2026-10-07T23:59:59Z'),
          createdBy: userId,
        },
      });

      // Create a conflicting game
      const game = await prisma.game.create({
        data: {
          seasonId,
          opponent: 'Override Test',
          datetime: new Date('2026-10-03T18:00:00Z'),
          homeAway: 'HOME',
          status: 'SCHEDULED',
        },
      });

      const result = await conflictService.createOverride(schoolId, {
        eventType: 'GAME',
        eventId: game.id,
        blockerId: blocker.id,
        reason: 'League-mandated game',
      }, userId);

      expect(result.id).toBeDefined();

      // Verify override was created
      const override = await prisma.conflictOverride.findUnique({
        where: { id: result.id },
      });

      expect(override?.eventType).toBe('GAME');
      expect(override?.eventId).toBe(game.id);
      expect(override?.blockerId).toBe(blocker.id);
      expect(override?.reason).toBe('League-mandated game');
      expect(override?.overriddenBy).toBe(userId);
    });

    it('creates an override for a practice', async () => {
      const blocker = await prisma.blocker.create({
        data: {
          schoolId,
          type: 'MAINTENANCE',
          name: 'Override Test Blocker',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-11-01T00:00:00Z'),
          endDatetime: new Date('2026-11-07T23:59:59Z'),
          createdBy: userId,
        },
      });

      const practice = await prisma.practice.create({
        data: {
          seasonId,
          datetime: new Date('2026-11-03T15:00:00Z'),
          durationMinutes: 90,
        },
      });

      const result = await conflictService.createOverride(schoolId, {
        eventType: 'PRACTICE',
        eventId: practice.id,
        blockerId: blocker.id,
      }, userId);

      expect(result.id).toBeDefined();
    });

    it('throws NotFoundError for nonexistent blocker', async () => {
      const game = await prisma.game.create({
        data: {
          seasonId,
          opponent: 'Test',
          datetime: new Date('2026-10-03T18:00:00Z'),
          homeAway: 'HOME',
          status: 'SCHEDULED',
        },
      });

      await expect(
        conflictService.createOverride(schoolId, {
          eventType: 'GAME',
          eventId: game.id,
          blockerId: 'nonexistent-id',
        }, userId)
      ).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for nonexistent game', async () => {
      const blocker = await prisma.blocker.create({
        data: {
          schoolId,
          type: 'EXAM',
          name: 'Test',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-10-01T00:00:00Z'),
          endDatetime: new Date('2026-10-07T23:59:59Z'),
          createdBy: userId,
        },
      });

      await expect(
        conflictService.createOverride(schoolId, {
          eventType: 'GAME',
          eventId: 'nonexistent-id',
          blockerId: blocker.id,
        }, userId)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getOverridesForEvent', () => {
    it('returns overrides for a game', async () => {
      const blocker = await prisma.blocker.create({
        data: {
          schoolId,
          type: 'EXAM',
          name: 'Test Exam',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-10-01T00:00:00Z'),
          endDatetime: new Date('2026-10-07T23:59:59Z'),
          createdBy: userId,
        },
      });

      const game = await prisma.game.create({
        data: {
          seasonId,
          opponent: 'Override Check',
          datetime: new Date('2026-10-03T18:00:00Z'),
          homeAway: 'HOME',
          status: 'SCHEDULED',
        },
      });

      await conflictService.createOverride(schoolId, {
        eventType: 'GAME',
        eventId: game.id,
        blockerId: blocker.id,
        reason: 'Important game',
      }, userId);

      const overrides = await conflictService.getOverridesForEvent('GAME', game.id);

      expect(overrides).toHaveLength(1);
      expect(overrides[0].blockerId).toBe(blocker.id);
      expect(overrides[0].reason).toBe('Important game');
    });

    it('returns empty array when no overrides exist', async () => {
      const overrides = await conflictService.getOverridesForEvent('GAME', 'some-id');
      expect(overrides).toHaveLength(0);
    });
  });
});
