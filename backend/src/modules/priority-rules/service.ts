// backend/src/modules/priority-rules/service.ts

import { PriorityRule } from '@prisma/client';
import { prisma } from '../../common/db.js';
import type {
  UpdatePriorityRulesInput,
  CalculatePriorityInput,
  ComparePriorityInput,
  AuditQuery,
} from './schemas.js';

// Default configuration used when no PriorityRule exists for a school
const DEFAULTS = {
  teamLevelWeight: 30,
  seasonStatusWeight: 25,
  eventTypeWeight: 25,
  homeAwayWeight: 20,
  teamLevelScores: { VARSITY: 100, JV: 60, FRESHMAN: 30 },
  seasonStatusScores: { IN_SEASON: 100, OFF_SEASON: 30 },
  eventTypeScores: { GAME: 100, PRACTICE: 40 },
  homeAwayScores: { HOME: 100, AWAY: 20, NEUTRAL: 50 },
  facilityOverrides: {},
};

interface PriorityBreakdown {
  teamLevel: { weight: number; factorScore: number; weighted: number };
  seasonStatus: { weight: number; factorScore: number; weighted: number };
  eventType: { weight: number; factorScore: number; weighted: number };
  homeAway: { weight: number; factorScore: number; weighted: number };
}

interface PriorityResult {
  score: number;
  breakdown: PriorityBreakdown;
  explanation: string;
}

interface CompareResult {
  eventA: PriorityResult;
  eventB: PriorityResult;
  winner: 'eventA' | 'eventB' | 'tie';
  margin: number;
  explanation: string;
  suggestion: string;
}

/**
 * Deep equality check for JSON values (order-insensitive for objects).
 * Needed because PostgreSQL JSONB does not preserve key order.
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((val: any, i: number) => deepEqual(val, b[i]));
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(key => key in b && deepEqual(a[key], b[key]));
}

function buildExplanation(input: CalculatePriorityInput, score: number): string {
  const level = input.teamLevel.charAt(0) + input.teamLevel.slice(1).toLowerCase();
  const season = input.seasonStatus === 'IN_SEASON' ? 'in-season' : 'off-season';
  const event = input.eventType.toLowerCase();
  const home = input.homeAway.toLowerCase();
  return `${level} (${season} ${home} ${event}) -- priority score: ${score}`;
}

export const priorityRuleService = {
  /**
   * Get priority rules for a school (returns defaults if none configured)
   */
  async get(schoolId: string): Promise<PriorityRule | (typeof DEFAULTS & { id: null; schoolId: string; createdAt: Date; updatedAt: Date })> {
    const rule = await prisma.priorityRule.findUnique({
      where: { schoolId },
    });

    if (!rule) {
      return { id: null, schoolId, ...DEFAULTS, createdAt: new Date(), updatedAt: new Date() } as any;
    }

    return rule;
  },

  /**
   * Create or update priority rules with audit trail
   */
  async upsert(
    schoolId: string,
    data: UpdatePriorityRulesInput,
    userId: string
  ): Promise<{ rule: PriorityRule; audits: Array<{ fieldChanged: string; oldValue: any; newValue: any }> }> {
    const existing = await prisma.priorityRule.findUnique({ where: { schoolId } });
    const audits: Array<{ fieldChanged: string; oldValue: any; newValue: any }> = [];

    // Build audit entries by comparing old vs new
    const oldValues = existing || DEFAULTS;
    const fieldsToAudit = [
      'teamLevelWeight', 'seasonStatusWeight', 'eventTypeWeight', 'homeAwayWeight',
      'teamLevelScores', 'seasonStatusScores', 'eventTypeScores', 'homeAwayScores',
      'facilityOverrides',
    ] as const;

    for (const field of fieldsToAudit) {
      const oldVal = (oldValues as any)[field];
      const newVal = (data as any)[field];
      if (!deepEqual(oldVal, newVal)) {
        audits.push({ fieldChanged: field, oldValue: oldVal, newValue: newVal });
      }
    }

    const rule = await prisma.priorityRule.upsert({
      where: { schoolId },
      update: { ...data },
      create: { schoolId, ...data },
    });

    // Create audit entries
    if (audits.length > 0) {
      await prisma.priorityRuleAudit.createMany({
        data: audits.map(a => ({
          priorityRuleId: rule.id,
          changedBy: userId,
          fieldChanged: a.fieldChanged,
          oldValue: a.oldValue,
          newValue: a.newValue,
        })),
      });
    }

    return { rule, audits };
  },

  /**
   * Calculate priority score for an event
   */
  async calculate(schoolId: string, input: CalculatePriorityInput): Promise<PriorityResult> {
    const rule = await this.get(schoolId);

    // Check for facility-specific overrides
    let weights = {
      teamLevel: rule.teamLevelWeight,
      seasonStatus: rule.seasonStatusWeight,
      eventType: rule.eventTypeWeight,
      homeAway: rule.homeAwayWeight,
    };
    let scores = {
      teamLevel: rule.teamLevelScores as Record<string, number>,
      seasonStatus: rule.seasonStatusScores as Record<string, number>,
      eventType: rule.eventTypeScores as Record<string, number>,
      homeAway: rule.homeAwayScores as Record<string, number>,
    };

    if (input.facilityId) {
      const overrides = (rule.facilityOverrides as Record<string, any>)?.[input.facilityId];
      if (overrides) {
        if (overrides.teamLevelWeight !== undefined) weights.teamLevel = overrides.teamLevelWeight;
        if (overrides.seasonStatusWeight !== undefined) weights.seasonStatus = overrides.seasonStatusWeight;
        if (overrides.eventTypeWeight !== undefined) weights.eventType = overrides.eventTypeWeight;
        if (overrides.homeAwayWeight !== undefined) weights.homeAway = overrides.homeAwayWeight;
        if (overrides.teamLevelScores) scores.teamLevel = overrides.teamLevelScores;
        if (overrides.seasonStatusScores) scores.seasonStatus = overrides.seasonStatusScores;
        if (overrides.eventTypeScores) scores.eventType = overrides.eventTypeScores;
        if (overrides.homeAwayScores) scores.homeAway = overrides.homeAwayScores;
      }
    }

    const breakdown: PriorityBreakdown = {
      teamLevel: {
        weight: weights.teamLevel,
        factorScore: scores.teamLevel[input.teamLevel] || 0,
        weighted: (weights.teamLevel / 100) * (scores.teamLevel[input.teamLevel] || 0),
      },
      seasonStatus: {
        weight: weights.seasonStatus,
        factorScore: scores.seasonStatus[input.seasonStatus] || 0,
        weighted: (weights.seasonStatus / 100) * (scores.seasonStatus[input.seasonStatus] || 0),
      },
      eventType: {
        weight: weights.eventType,
        factorScore: scores.eventType[input.eventType] || 0,
        weighted: (weights.eventType / 100) * (scores.eventType[input.eventType] || 0),
      },
      homeAway: {
        weight: weights.homeAway,
        factorScore: scores.homeAway[input.homeAway] || 0,
        weighted: (weights.homeAway / 100) * (scores.homeAway[input.homeAway] || 0),
      },
    };

    const score = Math.round(
      breakdown.teamLevel.weighted +
      breakdown.seasonStatus.weighted +
      breakdown.eventType.weighted +
      breakdown.homeAway.weighted
    );

    const explanation = buildExplanation(input, score);

    return { score, breakdown, explanation };
  },

  /**
   * Compare two events and recommend which has priority
   */
  async compare(schoolId: string, input: ComparePriorityInput): Promise<CompareResult> {
    const [resultA, resultB] = await Promise.all([
      this.calculate(schoolId, {
        teamLevel: input.eventA.teamLevel,
        seasonStatus: input.eventA.seasonStatus,
        eventType: input.eventA.eventType,
        homeAway: input.eventA.homeAway,
        facilityId: input.facilityId,
      }),
      this.calculate(schoolId, {
        teamLevel: input.eventB.teamLevel,
        seasonStatus: input.eventB.seasonStatus,
        eventType: input.eventB.eventType,
        homeAway: input.eventB.homeAway,
        facilityId: input.facilityId,
      }),
    ]);

    const winner = resultA.score > resultB.score ? 'eventA' as const :
                   resultB.score > resultA.score ? 'eventB' as const : 'tie' as const;
    const margin = Math.abs(resultA.score - resultB.score);

    const explanation = winner === 'tie'
      ? `Both events have equal priority (score: ${resultA.score})`
      : `${winner === 'eventA' ? 'Event A' : 'Event B'} has priority (${Math.max(resultA.score, resultB.score)} vs ${Math.min(resultA.score, resultB.score)})`;

    const loser = winner === 'eventA' ? 'Event B' : winner === 'eventB' ? 'Event A' : null;
    const suggestion = loser
      ? `${loser} should find an alternative time slot`
      : 'Both events have equal priority -- manual resolution recommended';

    return {
      eventA: resultA,
      eventB: resultB,
      winner,
      margin,
      explanation,
      suggestion,
    };
  },

  /**
   * Get audit log for priority rule changes
   */
  async getAudits(schoolId: string, query: AuditQuery) {
    const rule = await prisma.priorityRule.findUnique({ where: { schoolId } });
    if (!rule) {
      return { data: [], meta: { page: query.page, limit: query.limit, total: 0, totalPages: 0 } };
    }

    const { page, limit } = query;
    const [audits, total] = await Promise.all([
      prisma.priorityRuleAudit.findMany({
        where: { priorityRuleId: rule.id },
        orderBy: { changedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.priorityRuleAudit.count({ where: { priorityRuleId: rule.id } }),
    ]);

    return {
      data: audits,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /**
   * Determine season status for a team at a given date
   */
  async getSeasonStatus(teamId: string, eventDate: Date): Promise<'IN_SEASON' | 'OFF_SEASON'> {
    const season = await prisma.season.findFirst({
      where: {
        teamId,
        startDate: { lte: eventDate },
        endDate: { gte: eventDate },
      },
    });
    return season ? 'IN_SEASON' : 'OFF_SEASON';
  },
};
