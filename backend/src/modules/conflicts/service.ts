// backend/src/modules/conflicts/service.ts
import { BlockerScope, BlockerType, EventType, Blocker } from '@prisma/client';
import { prisma } from '../../common/db.js';
import { NotFoundError } from '../../common/errors.js';
import { priorityRuleService } from '../priority-rules/service.js';

// ============ Interfaces ============

export interface EventContext {
  datetime: Date;
  durationMinutes?: number;  // For practices
  seasonId: string;
  facilityId?: string | null;
}

export interface Conflict {
  blockerId: string;
  blockerName: string;
  blockerType: BlockerType;
  blockerScope: BlockerScope;
  reason: string;
  startDatetime: Date;
  endDatetime: Date;
}

export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: Conflict[];
}

export interface CreateOverrideInput {
  eventType: EventType;
  eventId: string;
  blockerId: string;
  reason?: string;
}

export interface ConflictSuggestion {
  action: 'reschedule_lower' | 'override' | 'manual_review';
  targetEventId: string;
  targetEventName: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  priorityComparison: {
    winner: { eventId: string; name: string; score: number };
    loser: { eventId: string; name: string; score: number };
  } | null;
  eventScore: number;
}

// ============ Helper Functions ============

const typeLabels: Record<BlockerType, string> = {
  EXAM: 'exam period',
  MAINTENANCE: 'facility maintenance',
  EVENT: 'school event',
  TRAVEL: 'travel blackout',
  HOLIDAY: 'school holiday',
  WEATHER: 'weather closure',
  CUSTOM: 'blocked period',
};

function buildConflictReason(blocker: {
  name: string;
  type: BlockerType;
  scope: BlockerScope;
}): string {
  const scopePrefix =
    blocker.scope === 'SCHOOL_WIDE'
      ? 'School-wide'
      : blocker.scope === 'FACILITY'
        ? 'Facility'
        : 'Team';

  return `${scopePrefix} ${typeLabels[blocker.type]}: ${blocker.name}`;
}

// ============ Service ============

export const conflictService = {
  /**
   * Check if an event conflicts with any blockers
   */
  async checkEventConflicts(event: EventContext): Promise<ConflictCheckResult> {
    // Get the team and school from the season
    const season = await prisma.season.findUnique({
      where: { id: event.seasonId },
      include: { team: true },
    });

    if (!season) {
      throw new NotFoundError('Season', event.seasonId);
    }

    const schoolId = season.team.schoolId;
    const teamId = season.teamId;
    const facilityId = event.facilityId;

    // Calculate event end time
    const eventStart = event.datetime;
    const eventEnd = event.durationMinutes
      ? new Date(eventStart.getTime() + event.durationMinutes * 60000)
      : new Date(eventStart.getTime() + 120 * 60000); // Default 2 hours for games

    // Build scope conditions for OR clause
    const scopeConditions: Array<{ scope: BlockerScope; teamId?: string | null; facilityId?: string | null }> = [
      { scope: 'SCHOOL_WIDE' },
      { scope: 'TEAM', teamId },
    ];

    if (facilityId) {
      scopeConditions.push({ scope: 'FACILITY', facilityId });
    }

    // Find all applicable blockers that overlap with the event time
    const blockers = await prisma.blocker.findMany({
      where: {
        schoolId,
        // Time overlap: blocker overlaps with event [eventStart, eventEnd]
        startDatetime: { lt: eventEnd },
        endDatetime: { gt: eventStart },
        // Scope match
        OR: scopeConditions,
      },
    });

    const conflicts: Conflict[] = blockers.map((blocker) => ({
      blockerId: blocker.id,
      blockerName: blocker.name,
      blockerType: blocker.type,
      blockerScope: blocker.scope,
      reason: buildConflictReason(blocker),
      startDatetime: blocker.startDatetime,
      endDatetime: blocker.endDatetime,
    }));

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  },

  /**
   * Check conflicts for a game by ID
   */
  async checkGameConflicts(gameId: string): Promise<ConflictCheckResult> {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundError('Game', gameId);
    }

    return this.checkEventConflicts({
      datetime: game.datetime,
      seasonId: game.seasonId,
      facilityId: game.facilityId,
    });
  },

  /**
   * Check conflicts for a practice by ID
   */
  async checkPracticeConflicts(practiceId: string): Promise<ConflictCheckResult> {
    const practice = await prisma.practice.findUnique({
      where: { id: practiceId },
    });

    if (!practice) {
      throw new NotFoundError('Practice', practiceId);
    }

    return this.checkEventConflicts({
      datetime: practice.datetime,
      durationMinutes: practice.durationMinutes,
      seasonId: practice.seasonId,
      facilityId: practice.facilityId,
    });
  },

  /**
   * Find all events that conflict with a given blocker
   * Used when creating a new blocker to show retroactive conflicts
   */
  async findConflictingEvents(blockerId: string): Promise<{
    games: { id: string; opponent: string; datetime: Date }[];
    practices: { id: string; datetime: Date }[];
    totalCount: number;
  }> {
    const blocker = await prisma.blocker.findUnique({
      where: { id: blockerId },
    });

    if (!blocker) {
      throw new NotFoundError('Blocker', blockerId);
    }

    // Build the event query based on blocker scope
    const eventWhere = this.buildEventWhereClause(blocker);

    const [games, practices] = await Promise.all([
      prisma.game.findMany({
        where: {
          ...eventWhere,
          datetime: {
            gte: blocker.startDatetime,
            lt: blocker.endDatetime,
          },
        },
        select: { id: true, opponent: true, datetime: true },
      }),
      prisma.practice.findMany({
        where: {
          ...eventWhere,
          datetime: {
            gte: blocker.startDatetime,
            lt: blocker.endDatetime,
          },
        },
        select: { id: true, datetime: true },
      }),
    ]);

    return {
      games,
      practices,
      totalCount: games.length + practices.length,
    };
  },

  /**
   * Get conflict summary for a season
   */
  async getSeasonConflictSummary(seasonId: string): Promise<{
    gamesWithConflicts: number;
    practicesWithConflicts: number;
    totalConflicts: number;
    conflictingEvents: Array<{
      type: 'game' | 'practice';
      id: string;
      datetime: Date;
      opponent?: string;
      conflicts: Conflict[];
    }>;
  }> {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: {
        games: { select: { id: true, datetime: true, facilityId: true, opponent: true } },
        practices: { select: { id: true, datetime: true, facilityId: true, durationMinutes: true } },
      },
    });

    if (!season) {
      throw new NotFoundError('Season', seasonId);
    }

    const conflictingEvents: Array<{
      type: 'game' | 'practice';
      id: string;
      datetime: Date;
      opponent?: string;
      conflicts: Conflict[];
    }> = [];

    for (const game of season.games) {
      const result = await this.checkEventConflicts({
        datetime: game.datetime,
        seasonId,
        facilityId: game.facilityId,
      });
      if (result.hasConflicts) {
        conflictingEvents.push({
          type: 'game',
          id: game.id,
          datetime: game.datetime,
          opponent: game.opponent,
          conflicts: result.conflicts,
        });
      }
    }

    for (const practice of season.practices) {
      const result = await this.checkEventConflicts({
        datetime: practice.datetime,
        durationMinutes: practice.durationMinutes,
        seasonId,
        facilityId: practice.facilityId,
      });
      if (result.hasConflicts) {
        conflictingEvents.push({
          type: 'practice',
          id: practice.id,
          datetime: practice.datetime,
          conflicts: result.conflicts,
        });
      }
    }

    const gamesWithConflicts = conflictingEvents.filter((e) => e.type === 'game').length;
    const practicesWithConflicts = conflictingEvents.filter((e) => e.type === 'practice').length;

    return {
      gamesWithConflicts,
      practicesWithConflicts,
      totalConflicts: gamesWithConflicts + practicesWithConflicts,
      conflictingEvents,
    };
  },

  /**
   * Get conflict summary for entire school (dashboard)
   */
  async getSchoolConflictSummary(schoolId: string): Promise<{
    totalConflicts: number;
    byType: Record<string, number>;
    recentlyCreated: Array<{
      blockerId: string;
      blockerName: string;
      affectedEventsCount: number;
      createdAt: Date;
    }>;
  }> {
    // Get all blockers created in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentBlockers = await prisma.blocker.findMany({
      where: {
        schoolId,
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const recentlyCreated: Array<{
      blockerId: string;
      blockerName: string;
      affectedEventsCount: number;
      createdAt: Date;
    }> = [];

    const byType: Record<string, number> = {};
    let totalConflicts = 0;

    for (const blocker of recentBlockers) {
      const affectedEvents = await this.findConflictingEvents(blocker.id);

      if (affectedEvents.totalCount > 0) {
        totalConflicts += affectedEvents.totalCount;
        byType[blocker.type] = (byType[blocker.type] || 0) + affectedEvents.totalCount;

        recentlyCreated.push({
          blockerId: blocker.id,
          blockerName: blocker.name,
          affectedEventsCount: affectedEvents.totalCount,
          createdAt: blocker.createdAt,
        });
      }
    }

    return {
      totalConflicts,
      byType,
      recentlyCreated,
    };
  },

  /**
   * List all conflicting events for a school (paginated, for conflicts triage page)
   */
  async listAllConflicts(
    schoolId: string,
    options: {
      page: number;
      limit: number;
      eventType?: 'game' | 'practice';
      blockerType?: string;
      sortBy: string;
      sortOrder: 'asc' | 'desc';
      includeSuggestions?: boolean;
    }
  ): Promise<{
    data: Array<{
      type: 'game' | 'practice';
      id: string;
      datetime: Date;
      opponent?: string;
      teamName: string;
      teamLevel: string;
      facilityName: string | null;
      seasonId: string;
      conflicts: Conflict[];
      overrideCount: number;
      suggestion?: ConflictSuggestion;
    }>;
    meta: { page: number; limit: number; total: number; totalPages: number };
    summary: { total: number; byBlockerType: Record<string, number> };
  }> {
    const { page, limit, eventType, blockerType, sortBy, sortOrder, includeSuggestions } = options;

    // Get all seasons for this school
    const seasons = await prisma.season.findMany({
      where: { team: { schoolId } },
      include: {
        team: { select: { name: true, level: true } },
        games: {
          include: { facility: { select: { name: true } } },
          orderBy: { datetime: sortOrder },
        },
        practices: {
          include: { facility: { select: { name: true } } },
          orderBy: { datetime: sortOrder },
        },
      },
    });

    // Check each event for conflicts
    const allConflicting: Array<{
      type: 'game' | 'practice';
      id: string;
      datetime: Date;
      opponent?: string;
      teamName: string;
      teamLevel: string;
      facilityName: string | null;
      facilityId: string | null;
      seasonId: string;
      homeAway?: string;
      conflicts: Conflict[];
      overrideCount: number;
      suggestion?: ConflictSuggestion;
    }> = [];

    for (const season of seasons) {
      if (!eventType || eventType === 'game') {
        for (const game of season.games) {
          const result = await this.checkEventConflicts({
            datetime: game.datetime,
            seasonId: season.id,
            facilityId: game.facilityId,
          });
          if (result.hasConflicts) {
            const filtered = blockerType
              ? result.conflicts.filter((c) => c.blockerType === blockerType)
              : result.conflicts;
            if (filtered.length > 0) {
              const overrides = await prisma.conflictOverride.count({
                where: { eventType: 'GAME', eventId: game.id },
              });
              allConflicting.push({
                type: 'game',
                id: game.id,
                datetime: game.datetime,
                opponent: game.opponent,
                teamName: season.team.name,
                teamLevel: season.team.level,
                facilityName: game.facility?.name ?? null,
                facilityId: game.facilityId,
                seasonId: season.id,
                homeAway: (game as any).homeAway,
                conflicts: filtered,
                overrideCount: overrides,
              });
            }
          }
        }
      }

      if (!eventType || eventType === 'practice') {
        for (const practice of season.practices) {
          const result = await this.checkEventConflicts({
            datetime: practice.datetime,
            durationMinutes: practice.durationMinutes,
            seasonId: season.id,
            facilityId: practice.facilityId,
          });
          if (result.hasConflicts) {
            const filtered = blockerType
              ? result.conflicts.filter((c) => c.blockerType === blockerType)
              : result.conflicts;
            if (filtered.length > 0) {
              const overrides = await prisma.conflictOverride.count({
                where: { eventType: 'PRACTICE', eventId: practice.id },
              });
              allConflicting.push({
                type: 'practice',
                id: practice.id,
                datetime: practice.datetime,
                teamName: season.team.name,
                teamLevel: season.team.level,
                facilityName: practice.facility?.name ?? null,
                facilityId: practice.facilityId,
                seasonId: season.id,
                conflicts: filtered,
                overrideCount: overrides,
              });
            }
          }
        }
      }
    }

    // Sort
    if (sortBy === 'datetime') {
      allConflicting.sort((a, b) => {
        const diff = a.datetime.getTime() - b.datetime.getTime();
        return sortOrder === 'asc' ? diff : -diff;
      });
    }

    // Build summary
    const byBlockerType: Record<string, number> = {};
    for (const event of allConflicting) {
      for (const c of event.conflicts) {
        byBlockerType[c.blockerType] = (byBlockerType[c.blockerType] || 0) + 1;
      }
    }

    // Paginate
    const total = allConflicting.length;
    const start = (page - 1) * limit;
    const paginated = allConflicting.slice(start, start + limit);

    // Generate suggestions if requested
    if (includeSuggestions) {
      for (const item of paginated) {
        try {
          item.suggestion = await this.generateSuggestion(
            schoolId,
            {
              type: item.type,
              id: item.id,
              teamName: item.teamName,
              teamLevel: item.teamLevel,
              seasonId: item.seasonId,
              homeAway: item.homeAway,
              facilityId: item.facilityId,
            },
            item.conflicts
          );
        } catch {
          // Skip suggestion on error
        }
      }
    }

    return {
      data: paginated,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: { total, byBlockerType },
    };
  },

  /**
   * Create a conflict override (when coach saves despite conflict)
   */
  async createOverride(
    schoolId: string,
    data: CreateOverrideInput,
    userId: string
  ): Promise<{ id: string }> {
    // Verify the blocker exists
    const blocker = await prisma.blocker.findFirst({
      where: { id: data.blockerId, schoolId },
    });

    if (!blocker) {
      throw new NotFoundError('Blocker', data.blockerId);
    }

    // Verify the event exists
    if (data.eventType === 'GAME') {
      const game = await prisma.game.findUnique({
        where: { id: data.eventId },
        include: { season: { include: { team: true } } },
      });
      if (!game || game.season.team.schoolId !== schoolId) {
        throw new NotFoundError('Game', data.eventId);
      }
    } else {
      const practice = await prisma.practice.findUnique({
        where: { id: data.eventId },
        include: { season: { include: { team: true } } },
      });
      if (!practice || practice.season.team.schoolId !== schoolId) {
        throw new NotFoundError('Practice', data.eventId);
      }
    }

    const override = await prisma.conflictOverride.create({
      data: {
        schoolId,
        eventType: data.eventType,
        eventId: data.eventId,
        blockerId: data.blockerId,
        overriddenBy: userId,
        reason: data.reason,
      },
    });

    return { id: override.id };
  },

  /**
   * Get overrides for an event
   */
  async getOverridesForEvent(
    eventType: EventType,
    eventId: string
  ): Promise<Array<{ blockerId: string; reason: string | null; overriddenAt: Date }>> {
    const overrides = await prisma.conflictOverride.findMany({
      where: {
        eventType,
        eventId,
      },
      select: {
        blockerId: true,
        reason: true,
        overriddenAt: true,
      },
    });

    return overrides;
  },

  /**
   * Generate a suggestion for a conflicting event based on priority scores
   */
  async generateSuggestion(
    schoolId: string,
    event: {
      type: 'game' | 'practice';
      id: string;
      teamName: string;
      teamLevel: string;
      seasonId: string;
      homeAway?: string;
      facilityId?: string | null;
    },
    conflicts: Conflict[]
  ): Promise<ConflictSuggestion> {
    // Determine season status
    const season = await prisma.season.findUnique({
      where: { id: event.seasonId },
      include: { team: true },
    });

    let seasonStatus: 'IN_SEASON' | 'OFF_SEASON' = 'IN_SEASON';
    if (season) {
      const now = new Date();
      seasonStatus = now >= season.startDate && now <= season.endDate ? 'IN_SEASON' : 'OFF_SEASON';
    }

    // Calculate this event's priority score
    const result = await priorityRuleService.calculate(schoolId, {
      teamLevel: event.teamLevel as 'VARSITY' | 'JV' | 'FRESHMAN',
      seasonStatus,
      eventType: event.type === 'game' ? 'GAME' : 'PRACTICE',
      homeAway: (event.homeAway || 'HOME') as 'HOME' | 'AWAY' | 'NEUTRAL',
      facilityId: event.facilityId ?? undefined,
    });

    // For blocker-based conflicts, suggest override with confidence based on score
    // High-priority events (score > 70) get high confidence override suggestion
    // Medium-priority events (40-70) get medium confidence
    // Low-priority events (<40) get low confidence (manual review)
    let confidence: 'high' | 'medium' | 'low';
    let action: 'override' | 'manual_review';

    if (result.score > 70) {
      confidence = 'high';
      action = 'override';
    } else if (result.score > 40) {
      confidence = 'medium';
      action = 'override';
    } else {
      confidence = 'low';
      action = 'manual_review';
    }

    const blockerSummary = conflicts.map(c => c.blockerName).join(', ');

    return {
      action,
      targetEventId: event.id,
      targetEventName: `${event.teamName} ${event.type === 'game' ? 'Game' : 'Practice'}`,
      reason: `Score ${result.score}: ${event.teamLevel} ${event.type} vs ${blockerSummary}`,
      confidence,
      priorityComparison: null,
      eventScore: result.score,
    };
  },

  // Private helper
  buildEventWhereClause(blocker: Blocker): Record<string, unknown> {
    switch (blocker.scope) {
      case 'SCHOOL_WIDE':
        return {
          season: { team: { schoolId: blocker.schoolId } },
        };
      case 'TEAM':
        return {
          season: { teamId: blocker.teamId },
        };
      case 'FACILITY':
        return {
          facilityId: blocker.facilityId,
        };
    }
  },
};
