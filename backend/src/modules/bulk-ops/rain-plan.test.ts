// backend/src/modules/bulk-ops/rain-plan.test.ts
//
// Uses a real database per the NO MOCKS policy.
//
// Three properties, each of which the rain plan got wrong before the weather work
// gave anyone a reason to look at it closely:
//
//   1. Whether a space is outdoors is a fact about the space, not about its type.
//      Selecting on FacilityType rains out indoor courts and misses outdoor spaces
//      recorded as OTHER.
//   2. The execute path has to move the events it previewed. It re-found each
//      facility by name, so two facilities sharing a name moved the wrong events.
//   3. Moving everything into the fallback without checking the fallback is free is
//      how Truman's afternoon went wrong: soccer and track were both sent to the
//      ATC, where JV volleyball already was.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../common/db.js';
import { bulkOpsService } from './service.js';

let schoolId: string;
let teamId: string;
let seasonId: string;
let indoorId: string;
let fieldId: string;
let outdoorCourtId: string;
let indoorCourtId: string;

const FROM = '2027-04-05';
const TO = '2027-04-06';
const WHEN = new Date('2027-04-05T21:00:00Z');

describe('rainPlan', () => {
  beforeAll(async () => {
    await prisma.$connect();

    const school = await prisma.school.create({
      data: { name: `Rain Plan Test ${Date.now()}`, timezone: 'America/Chicago' },
    });
    schoolId = school.id;

    const indoor = await prisma.facility.create({
      data: { schoolId, name: 'Main Gym', type: 'GYM', isOutdoor: false },
    });
    indoorId = indoor.id;

    const field = await prisma.facility.create({
      data: { schoolId, name: 'Stadium Turf', type: 'FIELD', isOutdoor: true, rainFallbackId: indoorId },
    });
    fieldId = field.id;

    // Same name, opposite exposure. This is the pair that broke the execute path.
    const outdoorCourt = await prisma.facility.create({
      data: { schoolId, name: 'Tennis Courts', type: 'COURT', isOutdoor: true, rainFallbackId: indoorId },
    });
    outdoorCourtId = outdoorCourt.id;

    const indoorCourt = await prisma.facility.create({
      data: { schoolId, name: 'Tennis Courts', type: 'COURT', isOutdoor: false, rainFallbackId: indoorId },
    });
    indoorCourtId = indoorCourt.id;

    const team = await prisma.team.create({
      data: { schoolId, name: 'Rain Test Soccer', sport: 'Soccer', level: 'VARSITY' },
    });
    teamId = team.id;

    const season = await prisma.season.create({
      data: {
        teamId,
        name: 'Spring 2027',
        year: 2027,
        startDate: new Date('2027-03-01T00:00:00Z'),
        endDate: new Date('2027-05-31T00:00:00Z'),
      },
    });
    seasonId = season.id;
  });

  beforeEach(async () => {
    await prisma.practice.deleteMany({ where: { seasonId } });
    await prisma.game.deleteMany({ where: { seasonId } });
  });

  afterAll(async () => {
    await prisma.practice.deleteMany({ where: { seasonId } });
    await prisma.game.deleteMany({ where: { seasonId } });
    await prisma.season.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { schoolId } });
    await prisma.facility.updateMany({ where: { schoolId }, data: { rainFallbackId: null } });
    await prisma.facility.deleteMany({ where: { schoolId } });
    await prisma.school.delete({ where: { id: schoolId } });
    await prisma.$disconnect();
  });

  it('selects by isOutdoor, not by facility type', async () => {
    // Both are COURT. One is outside and gets rained out; the other is not and must
    // be left where it is. No arrangement of FacilityType can express that.
    const outside = await prisma.practice.create({
      data: { seasonId, facilityId: outdoorCourtId, datetime: WHEN, durationMinutes: 90 },
    });
    const inside = await prisma.practice.create({
      data: { seasonId, facilityId: indoorCourtId, datetime: WHEN, durationMinutes: 90 },
    });

    const result = await bulkOpsService.rainPlan(schoolId, {
      fromDate: FROM,
      toDate: TO,
      dryRun: true,
    });

    const movedIds = result.moves.map((m) => m.id);
    expect(movedIds).toContain(outside.id);
    expect(movedIds).not.toContain(inside.id);
  });

  it('moves the events it previewed, even when two facilities share a name', async () => {
    const outside = await prisma.practice.create({
      data: { seasonId, facilityId: outdoorCourtId, datetime: WHEN, durationMinutes: 90 },
    });
    const inside = await prisma.practice.create({
      data: { seasonId, facilityId: indoorCourtId, datetime: WHEN, durationMinutes: 90 },
    });

    await bulkOpsService.rainPlan(schoolId, { fromDate: FROM, toDate: TO, dryRun: false });

    expect((await prisma.practice.findUniqueOrThrow({ where: { id: outside.id } })).facilityId).toBe(
      indoorId
    );
    // The indoor court was never in the preview and must not have moved.
    expect((await prisma.practice.findUniqueOrThrow({ where: { id: inside.id } })).facilityId).toBe(
      indoorCourtId
    );
  });

  it('carries the facility id on each move rather than only its name', async () => {
    await prisma.practice.create({
      data: { seasonId, facilityId: fieldId, datetime: WHEN, durationMinutes: 90 },
    });
    const result = await bulkOpsService.rainPlan(schoolId, {
      fromDate: FROM,
      toDate: TO,
      dryRun: true,
    });
    expect(result.moves[0]).toMatchObject({
      originalFacilityId: fieldId,
      fallbackFacilityId: indoorId,
    });
  });

  it('says when the fallback is already taken instead of moving on top of it', async () => {
    // Truman's afternoon: the field is unusable, the gym is the fallback, and the gym
    // already has a practice in it. Moving silently produces the double-booking the
    // conflicts engine then has to report.
    const displaced = await prisma.practice.create({
      data: { seasonId, facilityId: fieldId, datetime: WHEN, durationMinutes: 90 },
    });
    await prisma.practice.create({
      data: { seasonId, facilityId: indoorId, datetime: WHEN, durationMinutes: 90 },
    });

    const result = await bulkOpsService.rainPlan(schoolId, {
      fromDate: FROM,
      toDate: TO,
      dryRun: true,
    });

    const move = result.moves.find((m) => m.id === displaced.id);
    expect(move?.fallbackOccupied).toBe(true);
    expect(result.occupiedCount).toBe(1);
  });

  it('reports a free fallback as free', async () => {
    await prisma.practice.create({
      data: { seasonId, facilityId: fieldId, datetime: WHEN, durationMinutes: 90 },
    });
    const result = await bulkOpsService.rainPlan(schoolId, {
      fromDate: FROM,
      toDate: TO,
      dryRun: true,
    });
    expect(result.moves[0].fallbackOccupied).toBe(false);
    expect(result.occupiedCount).toBe(0);
  });

  it('keeps the opponent on a game move', async () => {
    // RainPlanDialog renders `m.opponent ? 'vs '+m.opponent : m.type`, so dropping
    // it turns every row into a bare "game".
    const season = await prisma.season.findFirstOrThrow({ where: { id: seasonId } });
    await prisma.game.create({
      data: { seasonId: season.id, facilityId: fieldId, opponent: 'Prestonwood', datetime: WHEN },
    });
    const result = await bulkOpsService.rainPlan(schoolId, {
      fromDate: FROM,
      toDate: TO,
      dryRun: true,
    });
    expect(result.moves.find((m) => m.type === 'game')?.opponent).toBe('Prestonwood');
  });

  it('sees the fallback fill up as it plans, not just before it starts', async () => {
    // Two rained-out practices at the same hour with the same empty fallback.
    // Checking only against what was ALREADY booked reported both as free and
    // planned them into the same gym - the collision the field exists to warn about.
    await prisma.practice.create({
      data: { seasonId, facilityId: fieldId, datetime: WHEN, durationMinutes: 90 },
    });
    await prisma.practice.create({
      data: { seasonId, facilityId: outdoorCourtId, datetime: WHEN, durationMinutes: 90 },
    });

    const result = await bulkOpsService.rainPlan(schoolId, {
      fromDate: FROM,
      toDate: TO,
      dryRun: true,
    });

    expect(result.moves).toHaveLength(2);
    // The first one into an empty gym is free; the second lands on the first.
    expect(result.moves.filter((m) => m.fallbackOccupied)).toHaveLength(1);
    expect(result.occupiedCount).toBe(1);
  });

  it('leaves the schedule alone on a dry run', async () => {
    const practice = await prisma.practice.create({
      data: { seasonId, facilityId: fieldId, datetime: WHEN, durationMinutes: 90 },
    });
    await bulkOpsService.rainPlan(schoolId, { fromDate: FROM, toDate: TO, dryRun: true });
    expect(
      (await prisma.practice.findUniqueOrThrow({ where: { id: practice.id } })).facilityId
    ).toBe(fieldId);
  });
});
