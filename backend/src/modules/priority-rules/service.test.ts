// backend/src/modules/priority-rules/service.test.ts
// Uses real database per NO MOCKS policy
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../common/db.js';
import { priorityRuleService } from './service.js';

let schoolId: string;
let userId: string;
let teamId: string;
let seasonId: string;

describe('PriorityRuleService', () => {
  beforeAll(async () => {
    await prisma.$connect();

    // Create a test user
    const user = await prisma.user.create({
      data: {
        email: `priority-test-${Date.now()}@test.com`,
        passwordHash: 'test-hash',
      },
    });
    userId = user.id;

    // Create a test school
    const school = await prisma.school.create({
      data: {
        name: 'Priority Test School',
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

    // Create a test team for season status tests
    const team = await prisma.team.create({
      data: {
        schoolId: school.id,
        name: 'Test Basketball',
        sport: 'Basketball',
        level: 'VARSITY',
      },
    });
    teamId = team.id;

    // Create a season (Jan-May 2026)
    const season = await prisma.season.create({
      data: {
        teamId: team.id,
        name: 'Basketball 2026',
        year: 2026,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-05-31'),
      },
    });
    seasonId = season.id;
  });

  afterAll(async () => {
    // Clean up in reverse dependency order
    await prisma.priorityRuleAudit.deleteMany({
      where: { priorityRule: { schoolId } },
    });
    await prisma.priorityRule.deleteMany({ where: { schoolId } });
    await prisma.season.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { schoolId } });
    await prisma.schoolUser.deleteMany({ where: { schoolId } });
    await prisma.school.delete({ where: { id: schoolId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up priority rules before each test
    await prisma.priorityRuleAudit.deleteMany({
      where: { priorityRule: { schoolId } },
    });
    await prisma.priorityRule.deleteMany({ where: { schoolId } });
  });

  describe('get', () => {
    it('returns default rules when none configured', async () => {
      const result = await priorityRuleService.get(schoolId);

      expect(result.id).toBeNull();
      expect(result.schoolId).toBe(schoolId);
      expect(result.teamLevelWeight).toBe(30);
      expect(result.seasonStatusWeight).toBe(25);
      expect(result.eventTypeWeight).toBe(25);
      expect(result.homeAwayWeight).toBe(20);
      expect(result.teamLevelScores).toEqual({ VARSITY: 100, JV: 60, FRESHMAN: 30 });
      expect(result.seasonStatusScores).toEqual({ IN_SEASON: 100, OFF_SEASON: 30 });
      expect(result.eventTypeScores).toEqual({ GAME: 100, PRACTICE: 40 });
      expect(result.homeAwayScores).toEqual({ HOME: 100, AWAY: 20, NEUTRAL: 50 });
    });

    it('returns configured rules when they exist', async () => {
      await prisma.priorityRule.create({
        data: {
          schoolId,
          teamLevelWeight: 40,
          seasonStatusWeight: 20,
          eventTypeWeight: 20,
          homeAwayWeight: 20,
        },
      });

      const result = await priorityRuleService.get(schoolId);

      expect(result.id).toBeDefined();
      expect(result.teamLevelWeight).toBe(40);
      expect(result.seasonStatusWeight).toBe(20);
    });
  });

  describe('upsert', () => {
    const defaultInput = {
      teamLevelWeight: 35,
      seasonStatusWeight: 25,
      eventTypeWeight: 25,
      homeAwayWeight: 15,
      teamLevelScores: { VARSITY: 100, JV: 50, FRESHMAN: 20 },
      seasonStatusScores: { IN_SEASON: 100, OFF_SEASON: 30 },
      eventTypeScores: { GAME: 100, PRACTICE: 40 },
      homeAwayScores: { HOME: 100, AWAY: 20, NEUTRAL: 50 },
      facilityOverrides: {},
    };

    it('creates new rule and generates audit entries', async () => {
      const result = await priorityRuleService.upsert(schoolId, defaultInput, userId);

      expect(result.rule.teamLevelWeight).toBe(35);
      expect(result.rule.homeAwayWeight).toBe(15);
      // Should have audits for fields that differ from defaults
      expect(result.audits.length).toBeGreaterThan(0);
      expect(result.audits.some(a => a.fieldChanged === 'teamLevelWeight')).toBe(true);

      // Verify audits persisted in DB
      const audits = await prisma.priorityRuleAudit.findMany({
        where: { priorityRuleId: result.rule.id },
      });
      expect(audits.length).toBe(result.audits.length);
    });

    it('updates existing rule and generates audits only for changed fields', async () => {
      // First create
      await priorityRuleService.upsert(schoolId, defaultInput, userId);

      // Clean audits to isolate update audits
      await prisma.priorityRuleAudit.deleteMany({
        where: { priorityRule: { schoolId } },
      });

      // Update only one field
      const updateInput = {
        ...defaultInput,
        teamLevelWeight: 40,
        homeAwayWeight: 10,
      };
      const result = await priorityRuleService.upsert(schoolId, updateInput, userId);

      expect(result.rule.teamLevelWeight).toBe(40);
      expect(result.rule.homeAwayWeight).toBe(10);
      // Only changed fields should be audited
      expect(result.audits).toHaveLength(2);
      expect(result.audits.map(a => a.fieldChanged).sort()).toEqual(['homeAwayWeight', 'teamLevelWeight']);
    });

    it('generates no audits when nothing changes', async () => {
      await priorityRuleService.upsert(schoolId, defaultInput, userId);

      // Clean audits
      await prisma.priorityRuleAudit.deleteMany({
        where: { priorityRule: { schoolId } },
      });

      // Same input again
      const result = await priorityRuleService.upsert(schoolId, defaultInput, userId);

      expect(result.audits).toHaveLength(0);
    });
  });

  describe('calculate', () => {
    it('calculates correct priority score with default weights', async () => {
      // Varsity, in-season, home game: all max scores
      const result = await priorityRuleService.calculate(schoolId, {
        teamLevel: 'VARSITY',
        seasonStatus: 'IN_SEASON',
        eventType: 'GAME',
        homeAway: 'HOME',
      });

      // 30/100*100 + 25/100*100 + 25/100*100 + 20/100*100 = 30+25+25+20 = 100
      expect(result.score).toBe(100);
      expect(result.breakdown.teamLevel.weighted).toBe(30);
      expect(result.breakdown.seasonStatus.weighted).toBe(25);
      expect(result.breakdown.eventType.weighted).toBe(25);
      expect(result.breakdown.homeAway.weighted).toBe(20);
    });

    it('calculates lower score for JV off-season away practice', async () => {
      const result = await priorityRuleService.calculate(schoolId, {
        teamLevel: 'JV',
        seasonStatus: 'OFF_SEASON',
        eventType: 'PRACTICE',
        homeAway: 'AWAY',
      });

      // 30/100*60 + 25/100*30 + 25/100*40 + 20/100*20 = 18+7.5+10+4 = 39.5 -> 40 (rounded)
      expect(result.score).toBe(40);
    });

    it('calculates correct score with custom weights', async () => {
      // Set custom weights
      await priorityRuleService.upsert(schoolId, {
        teamLevelWeight: 50,
        seasonStatusWeight: 20,
        eventTypeWeight: 20,
        homeAwayWeight: 10,
        teamLevelScores: { VARSITY: 100, JV: 60, FRESHMAN: 30 },
        seasonStatusScores: { IN_SEASON: 100, OFF_SEASON: 30 },
        eventTypeScores: { GAME: 100, PRACTICE: 40 },
        homeAwayScores: { HOME: 100, AWAY: 20, NEUTRAL: 50 },
        facilityOverrides: {},
      }, userId);

      const result = await priorityRuleService.calculate(schoolId, {
        teamLevel: 'VARSITY',
        seasonStatus: 'IN_SEASON',
        eventType: 'GAME',
        homeAway: 'HOME',
      });

      // 50/100*100 + 20/100*100 + 20/100*100 + 10/100*100 = 50+20+20+10 = 100
      expect(result.score).toBe(100);
    });

    it('includes human-readable explanation', async () => {
      const result = await priorityRuleService.calculate(schoolId, {
        teamLevel: 'VARSITY',
        seasonStatus: 'IN_SEASON',
        eventType: 'GAME',
        homeAway: 'HOME',
      });

      expect(result.explanation).toContain('Varsity');
      expect(result.explanation).toContain('in-season');
      expect(result.explanation).toContain('home');
      expect(result.explanation).toContain('game');
    });

    it('applies facility-specific overrides when present', async () => {
      const facilityId = 'test-facility-override';
      await priorityRuleService.upsert(schoolId, {
        teamLevelWeight: 30,
        seasonStatusWeight: 25,
        eventTypeWeight: 25,
        homeAwayWeight: 20,
        teamLevelScores: { VARSITY: 100, JV: 60, FRESHMAN: 30 },
        seasonStatusScores: { IN_SEASON: 100, OFF_SEASON: 30 },
        eventTypeScores: { GAME: 100, PRACTICE: 40 },
        homeAwayScores: { HOME: 100, AWAY: 20, NEUTRAL: 50 },
        facilityOverrides: {
          [facilityId]: {
            teamLevelWeight: 10,
            seasonStatusWeight: 10,
            eventTypeWeight: 10,
            homeAwayWeight: 70,
          },
        },
      }, userId);

      // With facility override, homeAway is heavily weighted
      const result = await priorityRuleService.calculate(schoolId, {
        teamLevel: 'VARSITY',
        seasonStatus: 'IN_SEASON',
        eventType: 'GAME',
        homeAway: 'AWAY', // only 20 score for AWAY
        facilityId,
      });

      // 10/100*100 + 10/100*100 + 10/100*100 + 70/100*20 = 10+10+10+14 = 44
      expect(result.score).toBe(44);
    });
  });

  describe('compare', () => {
    it('correctly identifies winner', async () => {
      const result = await priorityRuleService.compare(schoolId, {
        eventA: {
          eventType: 'GAME',
          eventId: 'event-a-id',
          teamLevel: 'VARSITY',
          seasonStatus: 'IN_SEASON',
          homeAway: 'HOME',
        },
        eventB: {
          eventType: 'PRACTICE',
          eventId: 'event-b-id',
          teamLevel: 'JV',
          seasonStatus: 'OFF_SEASON',
          homeAway: 'HOME',
        },
      });

      expect(result.winner).toBe('eventA');
      expect(result.eventA.score).toBeGreaterThan(result.eventB.score);
      expect(result.margin).toBe(result.eventA.score - result.eventB.score);
      expect(result.explanation).toContain('Event A');
      expect(result.suggestion).toContain('Event B');
    });

    it('handles ties', async () => {
      const result = await priorityRuleService.compare(schoolId, {
        eventA: {
          eventType: 'GAME',
          eventId: 'event-a-id',
          teamLevel: 'VARSITY',
          seasonStatus: 'IN_SEASON',
          homeAway: 'HOME',
        },
        eventB: {
          eventType: 'GAME',
          eventId: 'event-b-id',
          teamLevel: 'VARSITY',
          seasonStatus: 'IN_SEASON',
          homeAway: 'HOME',
        },
      });

      expect(result.winner).toBe('tie');
      expect(result.margin).toBe(0);
      expect(result.explanation).toContain('equal priority');
      expect(result.suggestion).toContain('manual resolution');
    });

    it('returns correct winner when B has higher priority', async () => {
      const result = await priorityRuleService.compare(schoolId, {
        eventA: {
          eventType: 'PRACTICE',
          eventId: 'event-a-id',
          teamLevel: 'FRESHMAN',
          seasonStatus: 'OFF_SEASON',
          homeAway: 'AWAY',
        },
        eventB: {
          eventType: 'GAME',
          eventId: 'event-b-id',
          teamLevel: 'VARSITY',
          seasonStatus: 'IN_SEASON',
          homeAway: 'HOME',
        },
      });

      expect(result.winner).toBe('eventB');
      expect(result.explanation).toContain('Event B');
      expect(result.suggestion).toContain('Event A');
    });
  });

  describe('getAudits', () => {
    it('returns empty list when no rule exists', async () => {
      const result = await priorityRuleService.getAudits(schoolId, { page: 1, limit: 50 });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('returns paginated audit history', async () => {
      // Create rule with non-default values to generate audits
      await priorityRuleService.upsert(schoolId, {
        teamLevelWeight: 35,
        seasonStatusWeight: 25,
        eventTypeWeight: 25,
        homeAwayWeight: 15,
        teamLevelScores: { VARSITY: 100, JV: 50, FRESHMAN: 20 },
        seasonStatusScores: { IN_SEASON: 100, OFF_SEASON: 30 },
        eventTypeScores: { GAME: 100, PRACTICE: 40 },
        homeAwayScores: { HOME: 100, AWAY: 20, NEUTRAL: 50 },
        facilityOverrides: {},
      }, userId);

      const result = await priorityRuleService.getAudits(schoolId, { page: 1, limit: 50 });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(50);
      expect(result.meta.total).toBeGreaterThan(0);
      // Audits should have required fields
      expect(result.data[0].fieldChanged).toBeDefined();
      expect(result.data[0].changedBy).toBe(userId);
    });

    it('respects pagination limits', async () => {
      // Create rule with many changed fields
      await priorityRuleService.upsert(schoolId, {
        teamLevelWeight: 35,
        seasonStatusWeight: 25,
        eventTypeWeight: 25,
        homeAwayWeight: 15,
        teamLevelScores: { VARSITY: 90, JV: 50, FRESHMAN: 20 },
        seasonStatusScores: { IN_SEASON: 90, OFF_SEASON: 20 },
        eventTypeScores: { GAME: 90, PRACTICE: 30 },
        homeAwayScores: { HOME: 90, AWAY: 10, NEUTRAL: 40 },
        facilityOverrides: {},
      }, userId);

      const result = await priorityRuleService.getAudits(schoolId, { page: 1, limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.totalPages).toBeGreaterThan(1);
    });
  });

  describe('getSeasonStatus', () => {
    it('returns IN_SEASON when date falls within season', async () => {
      const status = await priorityRuleService.getSeasonStatus(teamId, new Date('2026-03-15'));
      expect(status).toBe('IN_SEASON');
    });

    it('returns OFF_SEASON when date is outside season', async () => {
      const status = await priorityRuleService.getSeasonStatus(teamId, new Date('2026-08-15'));
      expect(status).toBe('OFF_SEASON');
    });

    it('returns OFF_SEASON for nonexistent team', async () => {
      const status = await priorityRuleService.getSeasonStatus('nonexistent-team', new Date('2026-03-15'));
      expect(status).toBe('OFF_SEASON');
    });
  });
});
