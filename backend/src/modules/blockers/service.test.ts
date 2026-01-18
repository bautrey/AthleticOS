// backend/src/modules/blockers/service.test.ts
// Uses real database per NO MOCKS policy
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../common/db.js';
import { blockerService } from './service.js';
import { NotFoundError } from '../../common/errors.js';

// Test data IDs - we'll create these in beforeAll
let schoolId: string;
let teamId: string;
let facilityId: string;
let seasonId: string;
let userId: string;

describe('BlockerService', () => {
  beforeAll(async () => {
    await prisma.$connect();

    // Create a test user
    const user = await prisma.user.create({
      data: {
        email: `blocker-test-${Date.now()}@test.com`,
        passwordHash: 'test-hash',
      },
    });
    userId = user.id;

    // Create a test school
    const school = await prisma.school.create({
      data: {
        name: 'Blocker Test School',
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

    // Create a test team
    const team = await prisma.team.create({
      data: {
        schoolId: school.id,
        name: 'Test Basketball',
        sport: 'Basketball',
        level: 'VARSITY',
      },
    });
    teamId = team.id;

    // Create a test facility
    const facility = await prisma.facility.create({
      data: {
        schoolId: school.id,
        name: 'Test Gym',
        type: 'GYM',
      },
    });
    facilityId = facility.id;

    // Create a test season for conflict testing
    const season = await prisma.season.create({
      data: {
        teamId: team.id,
        name: 'Test Season 2026',
        year: 2026,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    });
    seasonId = season.id;
  });

  afterAll(async () => {
    // Clean up test data in reverse dependency order
    await prisma.blocker.deleteMany({ where: { schoolId } });
    await prisma.game.deleteMany({ where: { seasonId } });
    await prisma.practice.deleteMany({ where: { seasonId } });
    await prisma.season.deleteMany({ where: { teamId } });
    await prisma.facility.deleteMany({ where: { schoolId } });
    await prisma.team.deleteMany({ where: { schoolId } });
    await prisma.schoolUser.deleteMany({ where: { schoolId } });
    await prisma.school.delete({ where: { id: schoolId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up blockers before each test
    await prisma.blocker.deleteMany({ where: { schoolId } });
    // Clean up games and practices before each test
    await prisma.game.deleteMany({ where: { seasonId } });
    await prisma.practice.deleteMany({ where: { seasonId } });
  });

  describe('create', () => {
    it('creates a school-wide blocker', async () => {
      const result = await blockerService.create(
        schoolId,
        {
          type: 'EXAM',
          name: 'Final Exams',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-05-15T08:00:00Z'),
          endDatetime: new Date('2026-05-22T17:00:00Z'),
        },
        userId
      );

      expect(result.blocker.id).toBeDefined();
      expect(result.blocker.type).toBe('EXAM');
      expect(result.blocker.name).toBe('Final Exams');
      expect(result.blocker.scope).toBe('SCHOOL_WIDE');
      expect(result.blocker.schoolId).toBe(schoolId);
      expect(result.blocker.teamId).toBeNull();
      expect(result.blocker.facilityId).toBeNull();
      expect(result.blocker.createdBy).toBe(userId);
      expect(result.conflictingEvents.total).toBe(0);
    });

    it('creates a team-specific blocker', async () => {
      const result = await blockerService.create(
        schoolId,
        {
          type: 'TRAVEL',
          name: 'Away Tournament',
          scope: 'TEAM',
          teamId,
          startDatetime: new Date('2026-03-01T08:00:00Z'),
          endDatetime: new Date('2026-03-03T18:00:00Z'),
        },
        userId
      );

      expect(result.blocker.scope).toBe('TEAM');
      expect(result.blocker.teamId).toBe(teamId);
      expect(result.blocker.facilityId).toBeNull();
    });

    it('creates a facility-specific blocker', async () => {
      const result = await blockerService.create(
        schoolId,
        {
          type: 'MAINTENANCE',
          name: 'Floor Refinishing',
          scope: 'FACILITY',
          facilityId,
          startDatetime: new Date('2026-06-01T00:00:00Z'),
          endDatetime: new Date('2026-06-07T23:59:59Z'),
        },
        userId
      );

      expect(result.blocker.scope).toBe('FACILITY');
      expect(result.blocker.facilityId).toBe(facilityId);
      expect(result.blocker.teamId).toBeNull();
    });

    it('clears facilityId when scope is TEAM', async () => {
      const result = await blockerService.create(
        schoolId,
        {
          type: 'TRAVEL',
          name: 'Away Game',
          scope: 'TEAM',
          teamId,
          facilityId, // Should be cleared
          startDatetime: new Date('2026-04-01T08:00:00Z'),
          endDatetime: new Date('2026-04-01T18:00:00Z'),
        },
        userId
      );

      expect(result.blocker.teamId).toBe(teamId);
      expect(result.blocker.facilityId).toBeNull();
    });

    it('throws NotFoundError for invalid team', async () => {
      await expect(
        blockerService.create(
          schoolId,
          {
            type: 'TRAVEL',
            name: 'Invalid Team Blocker',
            scope: 'TEAM',
            teamId: 'nonexistent-team-id',
            startDatetime: new Date('2026-04-01T08:00:00Z'),
            endDatetime: new Date('2026-04-02T18:00:00Z'),
          },
          userId
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for invalid facility', async () => {
      await expect(
        blockerService.create(
          schoolId,
          {
            type: 'MAINTENANCE',
            name: 'Invalid Facility Blocker',
            scope: 'FACILITY',
            facilityId: 'nonexistent-facility-id',
            startDatetime: new Date('2026-04-01T08:00:00Z'),
            endDatetime: new Date('2026-04-02T18:00:00Z'),
          },
          userId
        )
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getById', () => {
    it('returns blocker by id', async () => {
      const created = await blockerService.create(
        schoolId,
        {
          type: 'HOLIDAY',
          name: 'Winter Break',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-12-20T00:00:00Z'),
          endDatetime: new Date('2027-01-05T23:59:59Z'),
        },
        userId
      );

      const found = await blockerService.getById(schoolId, created.blocker.id);
      expect(found.id).toBe(created.blocker.id);
      expect(found.name).toBe('Winter Break');
    });

    it('throws NotFoundError for nonexistent blocker', async () => {
      await expect(
        blockerService.getById(schoolId, 'nonexistent-id')
      ).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for blocker in different school', async () => {
      const created = await blockerService.create(
        schoolId,
        {
          type: 'EVENT',
          name: 'School Event',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-09-01T08:00:00Z'),
          endDatetime: new Date('2026-09-01T18:00:00Z'),
        },
        userId
      );

      await expect(
        blockerService.getById('different-school-id', created.blocker.id)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      // Create multiple blockers for list testing
      await blockerService.create(
        schoolId,
        {
          type: 'EXAM',
          name: 'Midterms',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-03-15T00:00:00Z'),
          endDatetime: new Date('2026-03-20T23:59:59Z'),
        },
        userId
      );

      await blockerService.create(
        schoolId,
        {
          type: 'TRAVEL',
          name: 'Team Trip',
          scope: 'TEAM',
          teamId,
          startDatetime: new Date('2026-04-01T00:00:00Z'),
          endDatetime: new Date('2026-04-03T23:59:59Z'),
        },
        userId
      );

      await blockerService.create(
        schoolId,
        {
          type: 'MAINTENANCE',
          name: 'Gym Maintenance',
          scope: 'FACILITY',
          facilityId,
          startDatetime: new Date('2026-05-01T00:00:00Z'),
          endDatetime: new Date('2026-05-07T23:59:59Z'),
        },
        userId
      );
    });

    it('lists all blockers for school', async () => {
      const result = await blockerService.list(schoolId, { page: 1, limit: 50 });
      expect(result.data).toHaveLength(3);
      expect(result.meta.total).toBe(3);
    });

    it('filters by scope', async () => {
      const result = await blockerService.list(schoolId, {
        page: 1,
        limit: 50,
        scope: 'SCHOOL_WIDE',
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].scope).toBe('SCHOOL_WIDE');
    });

    it('filters by type', async () => {
      const result = await blockerService.list(schoolId, {
        page: 1,
        limit: 50,
        type: 'EXAM',
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe('EXAM');
    });

    it('filters by teamId (includes school-wide)', async () => {
      const result = await blockerService.list(schoolId, {
        page: 1,
        limit: 50,
        teamId,
      });
      // Should return team-specific + school-wide
      expect(result.data.length).toBeGreaterThanOrEqual(2);
    });

    it('filters by date range', async () => {
      const result = await blockerService.list(schoolId, {
        page: 1,
        limit: 50,
        from: new Date('2026-04-01T00:00:00Z'),
        to: new Date('2026-04-30T23:59:59Z'),
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Team Trip');
    });

    it('paginates results', async () => {
      const page1 = await blockerService.list(schoolId, { page: 1, limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.meta.page).toBe(1);
      expect(page1.meta.totalPages).toBe(2);

      const page2 = await blockerService.list(schoolId, { page: 2, limit: 2 });
      expect(page2.data).toHaveLength(1);
    });

    it('orders by startDatetime ascending', async () => {
      const result = await blockerService.list(schoolId, { page: 1, limit: 50 });
      expect(result.data[0].name).toBe('Midterms');
      expect(result.data[1].name).toBe('Team Trip');
      expect(result.data[2].name).toBe('Gym Maintenance');
    });
  });

  describe('update', () => {
    it('updates blocker name', async () => {
      const created = await blockerService.create(
        schoolId,
        {
          type: 'EVENT',
          name: 'Original Name',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-10-01T08:00:00Z'),
          endDatetime: new Date('2026-10-01T18:00:00Z'),
        },
        userId
      );

      const updated = await blockerService.update(schoolId, created.blocker.id, {
        name: 'Updated Name',
      });

      expect(updated.blocker.name).toBe('Updated Name');
      expect(updated.blocker.type).toBe('EVENT'); // Unchanged
    });

    it('updates blocker scope and clears irrelevant fields', async () => {
      const created = await blockerService.create(
        schoolId,
        {
          type: 'TRAVEL',
          name: 'Trip',
          scope: 'TEAM',
          teamId,
          startDatetime: new Date('2026-11-01T08:00:00Z'),
          endDatetime: new Date('2026-11-02T18:00:00Z'),
        },
        userId
      );

      const updated = await blockerService.update(schoolId, created.blocker.id, {
        scope: 'SCHOOL_WIDE',
      });

      expect(updated.blocker.scope).toBe('SCHOOL_WIDE');
      expect(updated.blocker.teamId).toBeNull();
    });

    it('throws NotFoundError for nonexistent blocker', async () => {
      await expect(
        blockerService.update(schoolId, 'nonexistent-id', { name: 'New Name' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('deletes a blocker', async () => {
      const created = await blockerService.create(
        schoolId,
        {
          type: 'CUSTOM',
          name: 'To Delete',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-08-01T08:00:00Z'),
          endDatetime: new Date('2026-08-01T18:00:00Z'),
        },
        userId
      );

      await blockerService.delete(schoolId, created.blocker.id);

      await expect(
        blockerService.getById(schoolId, created.blocker.id)
      ).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for nonexistent blocker', async () => {
      await expect(
        blockerService.delete(schoolId, 'nonexistent-id')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('conflictingEvents', () => {
    it('counts conflicting games for school-wide blocker', async () => {
      // Create a game in the blocked period
      await prisma.game.create({
        data: {
          seasonId,
          opponent: 'Test Opponent',
          datetime: new Date('2026-05-16T14:00:00Z'),
          homeAway: 'HOME',
          status: 'SCHEDULED',
        },
      });

      const result = await blockerService.create(
        schoolId,
        {
          type: 'EXAM',
          name: 'Finals',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-05-15T00:00:00Z'),
          endDatetime: new Date('2026-05-22T23:59:59Z'),
        },
        userId
      );

      expect(result.conflictingEvents.games).toBe(1);
      expect(result.conflictingEvents.total).toBe(1);
    });

    it('counts conflicting practices for team blocker', async () => {
      // Create practices in the blocked period
      await prisma.practice.create({
        data: {
          seasonId,
          datetime: new Date('2026-06-15T15:00:00Z'),
          durationMinutes: 90,
        },
      });
      await prisma.practice.create({
        data: {
          seasonId,
          datetime: new Date('2026-06-16T15:00:00Z'),
          durationMinutes: 90,
        },
      });

      const result = await blockerService.create(
        schoolId,
        {
          type: 'TRAVEL',
          name: 'Tournament',
          scope: 'TEAM',
          teamId,
          startDatetime: new Date('2026-06-14T00:00:00Z'),
          endDatetime: new Date('2026-06-20T23:59:59Z'),
        },
        userId
      );

      expect(result.conflictingEvents.practices).toBe(2);
      expect(result.conflictingEvents.total).toBe(2);
    });

    it('counts conflicting events for facility blocker', async () => {
      // Create a practice at the facility
      await prisma.practice.create({
        data: {
          seasonId,
          facilityId,
          datetime: new Date('2026-07-15T10:00:00Z'),
          durationMinutes: 120,
        },
      });

      const result = await blockerService.create(
        schoolId,
        {
          type: 'MAINTENANCE',
          name: 'Repairs',
          scope: 'FACILITY',
          facilityId,
          startDatetime: new Date('2026-07-14T00:00:00Z'),
          endDatetime: new Date('2026-07-17T23:59:59Z'),
        },
        userId
      );

      expect(result.conflictingEvents.practices).toBe(1);
    });

    it('returns zero conflicts when no events overlap', async () => {
      const result = await blockerService.create(
        schoolId,
        {
          type: 'HOLIDAY',
          name: 'Summer Break',
          scope: 'SCHOOL_WIDE',
          startDatetime: new Date('2026-06-01T00:00:00Z'),
          endDatetime: new Date('2026-08-15T23:59:59Z'),
        },
        userId
      );

      expect(result.conflictingEvents.games).toBe(0);
      expect(result.conflictingEvents.practices).toBe(0);
      expect(result.conflictingEvents.total).toBe(0);
    });
  });
});
