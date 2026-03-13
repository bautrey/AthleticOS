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

// T-025: TypedConflict interface for enhanced conflict detection
export interface TypedConflict {
  type: 'BLOCKER' | 'FACILITY' | 'PERSON' | 'RESOURCE';
  severity: 'ERROR' | 'WARNING';
  eventA: {
    id: string;
    type: 'GAME' | 'PRACTICE';
    name: string;
    datetime: string;
    facilityName?: string;
    teamName?: string;
  };
  eventB?: {
    id: string;
    type: 'GAME' | 'PRACTICE';
    name: string;
    datetime: string;
    facilityName?: string;
    teamName?: string;
  };
  blocker?: {
    id: string;
    name: string;
    type: string;
  };
  overlapMinutes: number;
  suggestion?: ConflictSuggestion;
}

// T-027: ScoredSlot interface for suggest-slots endpoint
export interface ScoredSlot {
  startTime: string;
  endTime: string;
  date: string;
  score: number;
  conflictCount: number;
  reasons: string[];
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

  // T-022: Facility double-booking detection
  async checkFacilityConflicts(
    schoolId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<TypedConflict[]> {
    // Query all games and practices in date range for this school that have a facility assigned
    const [games, practices] = await Promise.all([
      prisma.game.findMany({
        where: {
          season: { team: { schoolId } },
          facilityId: { not: null },
          datetime: { gte: dateRange.start, lt: dateRange.end },
        },
        include: {
          facility: { select: { name: true } },
          season: { include: { team: { select: { name: true } } } },
        },
      }),
      prisma.practice.findMany({
        where: {
          season: { team: { schoolId } },
          facilityId: { not: null },
          datetime: { gte: dateRange.start, lt: dateRange.end },
        },
        include: {
          facility: { select: { name: true } },
          season: { include: { team: { select: { name: true } } } },
        },
      }),
    ]);

    // Normalize all events into a common shape
    interface NormalizedEvent {
      id: string;
      type: 'GAME' | 'PRACTICE';
      name: string;
      datetime: Date;
      endTime: Date;
      facilityId: string;
      facilityName: string;
      teamName: string;
    }

    const allEvents: NormalizedEvent[] = [];

    for (const game of games) {
      if (!game.facilityId) continue;
      allEvents.push({
        id: game.id,
        type: 'GAME',
        name: `Game vs ${game.opponent}`,
        datetime: game.datetime,
        endTime: new Date(game.datetime.getTime() + 120 * 60000), // 2 hours default
        facilityId: game.facilityId,
        facilityName: game.facility?.name ?? 'Unknown',
        teamName: game.season.team.name,
      });
    }

    for (const practice of practices) {
      if (!practice.facilityId) continue;
      allEvents.push({
        id: practice.id,
        type: 'PRACTICE',
        name: `Practice`,
        datetime: practice.datetime,
        endTime: new Date(practice.datetime.getTime() + practice.durationMinutes * 60000),
        facilityId: practice.facilityId,
        facilityName: practice.facility?.name ?? 'Unknown',
        teamName: practice.season.team.name,
      });
    }

    // Group by facility
    const byFacility = new Map<string, NormalizedEvent[]>();
    for (const event of allEvents) {
      const list = byFacility.get(event.facilityId) ?? [];
      list.push(event);
      byFacility.set(event.facilityId, list);
    }

    const conflicts: TypedConflict[] = [];

    for (const [, events] of byFacility) {
      // Sort by start time
      events.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

      // Check each pair for overlaps
      for (let i = 0; i < events.length; i++) {
        for (let j = i + 1; j < events.length; j++) {
          const a = events[i];
          const b = events[j];

          // Check overlap: A starts before B ends AND B starts before A ends
          // Back-to-back is OK (a.endTime === b.datetime)
          if (a.endTime.getTime() > b.datetime.getTime() && b.endTime.getTime() > a.datetime.getTime()) {
            const overlapStart = Math.max(a.datetime.getTime(), b.datetime.getTime());
            const overlapEnd = Math.min(a.endTime.getTime(), b.endTime.getTime());
            const overlapMinutes = Math.round((overlapEnd - overlapStart) / 60000);

            conflicts.push({
              type: 'FACILITY',
              severity: 'ERROR',
              eventA: {
                id: a.id,
                type: a.type,
                name: a.name,
                datetime: a.datetime.toISOString(),
                facilityName: a.facilityName,
                teamName: a.teamName,
              },
              eventB: {
                id: b.id,
                type: b.type,
                name: b.name,
                datetime: b.datetime.toISOString(),
                facilityName: b.facilityName,
                teamName: b.teamName,
              },
              overlapMinutes,
            });
          }
        }
      }
    }

    return conflicts;
  },

  // T-023: Person overlap detection (DEFERRED to Sprint 4)
  // TODO: Implement person overlap detection - detect when a coach, athlete, or staff member
  // is assigned to multiple events at the same time. Requires person-event assignment model.

  // T-024: Resource collision detection (DEFERRED to Sprint 4)
  // TODO: Implement resource collision detection - detect when shared equipment, vehicles,
  // or other resources are double-booked across events. Requires resource-event assignment model.

  // T-026: Run all enabled conflict checks for a school
  async checkConflicts(
    schoolId: string,
    options: {
      eventId?: string;
      dateRange?: { start: Date; end: Date };
      types: Array<'blocker' | 'facility' | 'person' | 'resource'>;
    }
  ): Promise<{ conflicts: TypedConflict[]; summary: { total: number; byType: Record<string, number>; bySeverity: Record<string, number> } }> {
    const allConflicts: TypedConflict[] = [];

    // Default date range: next 90 days
    const dateRange = options.dateRange ?? {
      start: new Date(),
      end: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    };

    // Run blocker checks if requested
    if (options.types.includes('blocker')) {
      // Get all seasons for this school
      const seasons = await prisma.season.findMany({
        where: { team: { schoolId } },
        include: {
          team: { select: { name: true, level: true } },
          games: {
            where: { datetime: { gte: dateRange.start, lt: dateRange.end } },
            include: { facility: { select: { name: true } } },
          },
          practices: {
            where: { datetime: { gte: dateRange.start, lt: dateRange.end } },
            include: { facility: { select: { name: true } } },
          },
        },
      });

      for (const season of seasons) {
        for (const game of season.games) {
          if (options.eventId && game.id !== options.eventId) continue;
          const result = await this.checkEventConflicts({
            datetime: game.datetime,
            seasonId: season.id,
            facilityId: game.facilityId,
          });
          for (const conflict of result.conflicts) {
            allConflicts.push({
              type: 'BLOCKER',
              severity: 'ERROR',
              eventA: {
                id: game.id,
                type: 'GAME',
                name: `Game vs ${game.opponent}`,
                datetime: game.datetime.toISOString(),
                facilityName: game.facility?.name,
                teamName: season.team.name,
              },
              blocker: {
                id: conflict.blockerId,
                name: conflict.blockerName,
                type: conflict.blockerType,
              },
              overlapMinutes: Math.round(
                (Math.min(conflict.endDatetime.getTime(), game.datetime.getTime() + 120 * 60000) -
                  Math.max(conflict.startDatetime.getTime(), game.datetime.getTime())) / 60000
              ),
            });
          }
        }

        for (const practice of season.practices) {
          if (options.eventId && practice.id !== options.eventId) continue;
          const result = await this.checkEventConflicts({
            datetime: practice.datetime,
            durationMinutes: practice.durationMinutes,
            seasonId: season.id,
            facilityId: practice.facilityId,
          });
          for (const conflict of result.conflicts) {
            const practiceEnd = practice.datetime.getTime() + practice.durationMinutes * 60000;
            allConflicts.push({
              type: 'BLOCKER',
              severity: 'ERROR',
              eventA: {
                id: practice.id,
                type: 'PRACTICE',
                name: `Practice`,
                datetime: practice.datetime.toISOString(),
                facilityName: practice.facility?.name,
                teamName: season.team.name,
              },
              blocker: {
                id: conflict.blockerId,
                name: conflict.blockerName,
                type: conflict.blockerType,
              },
              overlapMinutes: Math.round(
                (Math.min(conflict.endDatetime.getTime(), practiceEnd) -
                  Math.max(conflict.startDatetime.getTime(), practice.datetime.getTime())) / 60000
              ),
            });
          }
        }
      }
    }

    // Run facility checks if requested
    if (options.types.includes('facility')) {
      const facilityConflicts = await this.checkFacilityConflicts(schoolId, dateRange);
      allConflicts.push(...facilityConflicts);
    }

    // person and resource are deferred - no-op for now

    // Build summary
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    for (const c of allConflicts) {
      byType[c.type] = (byType[c.type] || 0) + 1;
      bySeverity[c.severity] = (bySeverity[c.severity] || 0) + 1;
    }

    return {
      conflicts: allConflicts,
      summary: { total: allConflicts.length, byType, bySeverity },
    };
  },

  // T-027: Suggest available time slots for a conflicting event
  async suggestSlots(
    schoolId: string,
    options: {
      facilityId: string;
      date: string;
      durationMinutes: number;
      preferredTime?: string;
    }
  ): Promise<ScoredSlot[]> {
    const targetDate = new Date(options.date);
    const dayStart = new Date(targetDate);
    dayStart.setHours(7, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(22, 0, 0, 0);

    // Get all events at this facility on this day
    const [games, practices] = await Promise.all([
      prisma.game.findMany({
        where: {
          facilityId: options.facilityId,
          datetime: { gte: dayStart, lt: dayEnd },
        },
        select: { datetime: true },
      }),
      prisma.practice.findMany({
        where: {
          facilityId: options.facilityId,
          datetime: { gte: dayStart, lt: dayEnd },
        },
        select: { datetime: true, durationMinutes: true },
      }),
    ]);

    // Build list of occupied time ranges
    const occupied: Array<{ start: number; end: number }> = [];
    for (const game of games) {
      occupied.push({
        start: game.datetime.getTime(),
        end: game.datetime.getTime() + 120 * 60000,
      });
    }
    for (const practice of practices) {
      occupied.push({
        start: practice.datetime.getTime(),
        end: practice.datetime.getTime() + practice.durationMinutes * 60000,
      });
    }

    // Parse preferred time for scoring
    let preferredMs: number | null = null;
    if (options.preferredTime) {
      const [hours, minutes] = options.preferredTime.split(':').map(Number);
      const prefDate = new Date(targetDate);
      prefDate.setHours(hours, minutes, 0, 0);
      preferredMs = prefDate.getTime();
    }

    // Scan in 30-minute increments from 7am to 10pm
    const slots: ScoredSlot[] = [];
    const INCREMENT_MS = 30 * 60000;
    const durationMs = options.durationMinutes * 60000;

    for (let slotStart = dayStart.getTime(); slotStart + durationMs <= dayEnd.getTime(); slotStart += INCREMENT_MS) {
      const slotEnd = slotStart + durationMs;

      // Count conflicts for this slot
      let conflictCount = 0;
      for (const o of occupied) {
        if (slotStart < o.end && slotEnd > o.start) {
          conflictCount++;
        }
      }

      // Calculate score (0-100)
      let score = 100;
      const reasons: string[] = [];

      // Penalty for conflicts
      if (conflictCount > 0) {
        score -= conflictCount * 40;
        reasons.push(`${conflictCount} conflict${conflictCount !== 1 ? 's' : ''}`);
      } else {
        reasons.push('No conflicts');
      }

      // Bonus for proximity to preferred time
      if (preferredMs !== null) {
        const distanceHours = Math.abs(slotStart - preferredMs) / (60 * 60000);
        if (distanceHours <= 1) {
          score += 10;
          reasons.push('Close to preferred time');
        } else if (distanceHours > 3) {
          score -= 10;
          reasons.push('Far from preferred time');
        }
      }

      // Clamp score
      score = Math.max(0, Math.min(100, score));

      const slotStartDate = new Date(slotStart);
      const slotEndDate = new Date(slotEnd);

      slots.push({
        startTime: slotStartDate.toTimeString().slice(0, 5),
        endTime: slotEndDate.toTimeString().slice(0, 5),
        date: options.date,
        score,
        conflictCount,
        reasons,
      });
    }

    // Sort by score desc, return top 5
    slots.sort((a, b) => b.score - a.score);
    return slots.slice(0, 5);
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
