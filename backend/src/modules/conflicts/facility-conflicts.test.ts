// backend/src/modules/conflicts/facility-conflicts.test.ts
// Uses real database per NO MOCKS policy.
//
// checkFacilityConflicts had no coverage. It is the check behind Truman Blocker's
// actual problem at TCA - upper school, middle school and lower school programs
// competing for the same field across offseason and in season - so these tests are
// written as that scenario rather than as abstract overlap arithmetic.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../common/db.js';
import { conflictService } from './service.js';

let schoolId: string;
let userId: string;
let fieldId: string;
let gymId: string;
let footballSeasonId: string;
let soccerSeasonId: string;

/** Wide enough to contain every event these tests create. */
const WINDOW = {
  start: new Date('2026-10-01T00:00:00Z'),
  end: new Date('2026-12-01T00:00:00Z'),
};

async function makeTeamWithSeason(name: string, sport: string, level: 'VARSITY' | 'JV') {
  const team = await prisma.team.create({
    data: { schoolId, name, sport, level },
  });
  const season = await prisma.season.create({
    data: {
      teamId: team.id,
      name: `${name} 2026`,
      year: 2026,
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-03-01T00:00:00Z'),
    },
  });
  return season.id;
}

describe('checkFacilityConflicts', () => {
  beforeAll(async () => {
    await prisma.$connect();

    const user = await prisma.user.create({
      data: { email: `facility-conflict-${Date.now()}@test.com`, passwordHash: 'test-hash' },
    });
    userId = user.id;

    const school = await prisma.school.create({
      data: { name: 'Facility Conflict Test School', timezone: 'America/Chicago' },
    });
    schoolId = school.id;

    await prisma.schoolUser.create({
      data: { schoolId, userId, role: 'ADMIN' },
    });

    const field = await prisma.facility.create({
      data: { schoolId, name: 'Practice Field', type: 'FIELD' },
    });
    fieldId = field.id;

    const gym = await prisma.facility.create({
      data: { schoolId, name: 'Main Gymnasium', type: 'GYM' },
    });
    gymId = gym.id;

    footballSeasonId = await makeTeamWithSeason('Football', 'Football', 'VARSITY');
    soccerSeasonId = await makeTeamWithSeason('Girls Soccer', 'Soccer', 'JV');
  });

  beforeEach(async () => {
    await prisma.practice.deleteMany({ where: { season: { team: { schoolId } } } });
    await prisma.game.deleteMany({ where: { season: { team: { schoolId } } } });
  });

  afterAll(async () => {
    await prisma.practice.deleteMany({ where: { season: { team: { schoolId } } } });
    await prisma.game.deleteMany({ where: { season: { team: { schoolId } } } });
    await prisma.season.deleteMany({ where: { team: { schoolId } } });
    await prisma.team.deleteMany({ where: { schoolId } });
    await prisma.facility.deleteMany({ where: { schoolId } });
    await prisma.notification.deleteMany({ where: { schoolId } });
    await prisma.schoolUser.deleteMany({ where: { schoolId } });
    await prisma.school.delete({ where: { id: schoolId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('catches two teams practising on the same field at overlapping times', async () => {
    await prisma.practice.create({
      data: {
        seasonId: footballSeasonId,
        facilityId: fieldId,
        datetime: new Date('2026-10-05T21:00:00Z'), // 4:00pm CDT
        durationMinutes: 90,
      },
    });
    await prisma.practice.create({
      data: {
        seasonId: soccerSeasonId,
        facilityId: fieldId,
        datetime: new Date('2026-10-05T22:00:00Z'), // 5:00pm CDT, 30 min into football
        durationMinutes: 75,
      },
    });

    const conflicts = await conflictService.checkFacilityConflicts(schoolId, WINDOW);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('FACILITY');
    expect(conflicts[0].severity).toBe('ERROR');
    expect(conflicts[0].overlapMinutes).toBe(30);
    const names = [conflicts[0].eventA.teamName, conflicts[0].eventB?.teamName];
    expect(names).toContain('Football');
    expect(names).toContain('Girls Soccer');
  });

  it('leaves the same two practices alone when they are in different facilities', async () => {
    await prisma.practice.create({
      data: {
        seasonId: footballSeasonId,
        facilityId: fieldId,
        datetime: new Date('2026-10-05T21:00:00Z'),
        durationMinutes: 90,
      },
    });
    await prisma.practice.create({
      data: {
        seasonId: soccerSeasonId,
        facilityId: gymId,
        datetime: new Date('2026-10-05T21:00:00Z'),
        durationMinutes: 90,
      },
    });

    expect(await conflictService.checkFacilityConflicts(schoolId, WINDOW)).toEqual([]);
  });

  it('does not flag back-to-back practices that merely touch', async () => {
    await prisma.practice.create({
      data: {
        seasonId: footballSeasonId,
        facilityId: fieldId,
        datetime: new Date('2026-10-06T21:00:00Z'),
        durationMinutes: 60,
      },
    });
    await prisma.practice.create({
      data: {
        seasonId: soccerSeasonId,
        facilityId: fieldId,
        datetime: new Date('2026-10-06T22:00:00Z'), // starts exactly as football ends
        durationMinutes: 60,
      },
    });

    // A field handing off at the hour is normal scheduling, not a double-booking.
    expect(await conflictService.checkFacilityConflicts(schoolId, WINDOW)).toEqual([]);
  });

  it('ignores events with no facility assigned', async () => {
    await prisma.practice.create({
      data: { seasonId: footballSeasonId, datetime: new Date('2026-10-07T21:00:00Z'), durationMinutes: 90 },
    });
    await prisma.practice.create({
      data: { seasonId: soccerSeasonId, datetime: new Date('2026-10-07T21:00:00Z'), durationMinutes: 90 },
    });

    expect(await conflictService.checkFacilityConflicts(schoolId, WINDOW)).toEqual([]);
  });

  it('catches a game overlapping a practice on the same field', async () => {
    await prisma.game.create({
      data: {
        seasonId: footballSeasonId,
        facilityId: fieldId,
        opponent: 'Prestonwood',
        datetime: new Date('2026-10-09T23:00:00Z'),
        homeAway: 'HOME',
        status: 'SCHEDULED',
      },
    });
    await prisma.practice.create({
      data: {
        seasonId: soccerSeasonId,
        facilityId: fieldId,
        datetime: new Date('2026-10-10T00:00:00Z'), // one hour into the game
        durationMinutes: 90,
      },
    });

    const conflicts = await conflictService.checkFacilityConflicts(schoolId, WINDOW);
    expect(conflicts).toHaveLength(1);
    const types = [conflicts[0].eventA.type, conflicts[0].eventB?.type];
    expect(types).toContain('GAME');
    expect(types).toContain('PRACTICE');
  });

  it('uses the school\'s configured game length rather than a fixed two hours', async () => {
    // A 45-minute game followed by a practice 60 minutes later does not overlap.
    // Under the old hardcoded 120-minute assumption it looked like a conflict.
    await prisma.school.update({
      where: { id: schoolId },
      data: { settings: { gameDurationMinutes: 45 } },
    });

    await prisma.game.create({
      data: {
        seasonId: footballSeasonId,
        facilityId: fieldId,
        opponent: 'Greenhill',
        datetime: new Date('2026-10-12T21:00:00Z'),
        homeAway: 'HOME',
        status: 'SCHEDULED',
      },
    });
    await prisma.practice.create({
      data: {
        seasonId: soccerSeasonId,
        facilityId: fieldId,
        datetime: new Date('2026-10-12T22:00:00Z'), // 15 min after a 45-min game ends
        durationMinutes: 60,
      },
    });

    expect(await conflictService.checkFacilityConflicts(schoolId, WINDOW)).toEqual([]);

    // Same data, default length restored: now the game is still running and it collides.
    await prisma.school.update({ where: { id: schoolId }, data: { settings: {} } });
    const conflicts = await conflictService.checkFacilityConflicts(schoolId, WINDOW);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].overlapMinutes).toBe(60);
  });

  it('reports every colliding pair when three teams want one field', async () => {
    const trackSeasonId = await makeTeamWithSeason('Track', 'Track', 'VARSITY');
    for (const seasonId of [footballSeasonId, soccerSeasonId, trackSeasonId]) {
      await prisma.practice.create({
        data: {
          seasonId,
          facilityId: fieldId,
          datetime: new Date('2026-10-14T21:00:00Z'),
          durationMinutes: 90,
        },
      });
    }

    // Three mutually overlapping events are three distinct pairs to resolve.
    const conflicts = await conflictService.checkFacilityConflicts(schoolId, WINDOW);
    expect(conflicts).toHaveLength(3);
    expect(conflicts.every((c) => c.overlapMinutes === 90)).toBe(true);
  });
});
