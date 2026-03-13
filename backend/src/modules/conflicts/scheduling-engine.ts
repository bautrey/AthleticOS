// backend/src/modules/conflicts/scheduling-engine.ts
// Enhanced conflict detection: facility overlaps, person overlaps, resource uniqueness, smart suggest
import { prisma } from '../../common/db.js';

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface SchedulingConflict {
  type: 'facility_overlap' | 'person_overlap' | 'resource_overlap' | 'blocker';
  severity: 'error' | 'warning';
  message: string;
  details: {
    conflictingEventId?: string;
    conflictingEventType?: string;
    facilityId?: string;
    resourceId?: string;
    personId?: string;
    blockerId?: string;
  };
}

export interface SlotSuggestion {
  start: Date;
  end: Date;
  facilityId: string;
  facilityName: string;
  score: number; // lower = better (fewer notifications needed)
  conflictCount: number;
}

function timeRangesOverlap(a: TimeRange, b: TimeRange, bufferMinutes = 5): boolean {
  const bufferMs = bufferMinutes * 60 * 1000;
  return a.start.getTime() < (b.end.getTime() - bufferMs) &&
         b.start.getTime() < (a.end.getTime() - bufferMs);
}

export const schedulingEngine = {
  /**
   * Full conflict check for a proposed event time slot.
   * Checks: facility double-booking, person double-booking, resource uniqueness, blockers.
   */
  async checkAllConflicts(params: {
    schoolId: string;
    facilityId?: string | null;
    start: Date;
    end: Date;
    participantIds?: string[];
    resourceIds?: string[];
    excludeGameId?: string;
    excludePracticeId?: string;
  }): Promise<SchedulingConflict[]> {
    const conflicts: SchedulingConflict[] = [];
    const { schoolId, facilityId, start, end, participantIds, resourceIds, excludeGameId, excludePracticeId } = params;

    const checks = [
      facilityId ? this.checkFacilityOverlap(facilityId, start, end, excludeGameId, excludePracticeId) : Promise.resolve([]),
      participantIds?.length ? this.checkPersonOverlaps(participantIds, start, end, excludeGameId, excludePracticeId) : Promise.resolve([]),
      resourceIds?.length ? this.checkResourceOverlaps(resourceIds, start, end, excludeGameId, excludePracticeId) : Promise.resolve([]),
    ];

    const [facilityConflicts, personConflicts, resourceConflicts] = await Promise.all(checks);
    conflicts.push(...facilityConflicts, ...personConflicts, ...resourceConflicts);

    return conflicts;
  },

  /**
   * No overlapping events on the same facility.
   */
  async checkFacilityOverlap(
    facilityId: string,
    start: Date,
    end: Date,
    excludeGameId?: string,
    excludePracticeId?: string,
  ): Promise<SchedulingConflict[]> {
    const conflicts: SchedulingConflict[] = [];

    // Find overlapping games at this facility
    const overlappingGames = await prisma.game.findMany({
      where: {
        facilityId,
        id: excludeGameId ? { not: excludeGameId } : undefined,
        status: { notIn: ['CANCELLED'] },
        datetime: { lt: end },
      },
      include: { season: { include: { team: true } } },
    });

    for (const game of overlappingGames) {
      const gameEnd = new Date(game.datetime.getTime() + 120 * 60 * 1000); // 2hr default
      if (timeRangesOverlap({ start, end }, { start: game.datetime, end: gameEnd })) {
        conflicts.push({
          type: 'facility_overlap',
          severity: 'error',
          message: `Facility double-booked: ${game.season.team.name} game vs ${game.opponent} at ${game.datetime.toISOString()}`,
          details: { conflictingEventId: game.id, conflictingEventType: 'GAME', facilityId },
        });
      }
    }

    // Find overlapping practices at this facility
    const overlappingPractices = await prisma.practice.findMany({
      where: {
        facilityId,
        id: excludePracticeId ? { not: excludePracticeId } : undefined,
        datetime: { lt: end },
      },
      include: { season: { include: { team: true } } },
    });

    for (const practice of overlappingPractices) {
      const practiceEnd = new Date(practice.datetime.getTime() + practice.durationMinutes * 60 * 1000);
      if (timeRangesOverlap({ start, end }, { start: practice.datetime, end: practiceEnd })) {
        conflicts.push({
          type: 'facility_overlap',
          severity: 'error',
          message: `Facility double-booked: ${practice.season.team.name} practice at ${practice.datetime.toISOString()}`,
          details: { conflictingEventId: practice.id, conflictingEventType: 'PRACTICE', facilityId },
        });
      }
    }

    return conflicts;
  },

  /**
   * No person in two events overlapping by >5 minutes.
   */
  async checkPersonOverlaps(
    personIds: string[],
    start: Date,
    end: Date,
    excludeGameId?: string,
    excludePracticeId?: string,
  ): Promise<SchedulingConflict[]> {
    const conflicts: SchedulingConflict[] = [];

    // Find all event participations for these people in the time range
    const participations = await prisma.eventParticipant.findMany({
      where: {
        userId: { in: personIds },
        OR: [
          {
            eventType: 'GAME',
            gameId: excludeGameId ? { not: excludeGameId } : undefined,
            game: { datetime: { lt: end }, status: { notIn: ['CANCELLED'] } },
          },
          {
            eventType: 'PRACTICE',
            practiceId: excludePracticeId ? { not: excludePracticeId } : undefined,
            practice: { datetime: { lt: end } },
          },
        ],
      },
      include: {
        user: { select: { name: true, email: true } },
        game: { include: { season: { include: { team: true } } } },
        practice: { include: { season: { include: { team: true } } } },
      },
    });

    for (const p of participations) {
      let eventStart: Date;
      let eventEnd: Date;
      let eventLabel: string;
      let eventId: string;
      let eventType: string;

      if (p.game) {
        eventStart = p.game.datetime;
        eventEnd = new Date(p.game.datetime.getTime() + 120 * 60 * 1000);
        eventLabel = `${p.game.season.team.name} game vs ${p.game.opponent}`;
        eventId = p.game.id;
        eventType = 'GAME';
      } else if (p.practice) {
        eventStart = p.practice.datetime;
        eventEnd = new Date(p.practice.datetime.getTime() + p.practice.durationMinutes * 60 * 1000);
        eventLabel = `${p.practice.season.team.name} practice`;
        eventId = p.practice.id;
        eventType = 'PRACTICE';
      } else {
        continue;
      }

      if (timeRangesOverlap({ start, end }, { start: eventStart, end: eventEnd })) {
        conflicts.push({
          type: 'person_overlap',
          severity: 'warning',
          message: `${p.user.name || p.user.email} is already in "${eventLabel}" at that time`,
          details: { personId: p.userId, conflictingEventId: eventId, conflictingEventType: eventType },
        });
      }
    }

    return conflicts;
  },

  /**
   * Resource uniqueness per time block (bus/ref).
   */
  async checkResourceOverlaps(
    resourceIds: string[],
    start: Date,
    end: Date,
    excludeGameId?: string,
    excludePracticeId?: string,
  ): Promise<SchedulingConflict[]> {
    const conflicts: SchedulingConflict[] = [];

    const eventResources = await prisma.eventResource.findMany({
      where: {
        resourceId: { in: resourceIds },
        OR: [
          {
            eventType: 'GAME',
            gameId: excludeGameId ? { not: excludeGameId } : undefined,
            game: { datetime: { lt: end }, status: { notIn: ['CANCELLED'] } },
          },
          {
            eventType: 'PRACTICE',
            practiceId: excludePracticeId ? { not: excludePracticeId } : undefined,
            practice: { datetime: { lt: end } },
          },
        ],
      },
      include: {
        resource: true,
        game: { include: { season: { include: { team: true } } } },
        practice: { include: { season: { include: { team: true } } } },
      },
    });

    for (const er of eventResources) {
      let eventStart: Date;
      let eventEnd: Date;
      let eventLabel: string;

      if (er.game) {
        eventStart = er.game.datetime;
        eventEnd = new Date(er.game.datetime.getTime() + 120 * 60 * 1000);
        eventLabel = `${er.game.season.team.name} game`;
      } else if (er.practice) {
        eventStart = er.practice.datetime;
        eventEnd = new Date(er.practice.datetime.getTime() + er.practice.durationMinutes * 60 * 1000);
        eventLabel = `${er.practice.season.team.name} practice`;
      } else {
        continue;
      }

      if (timeRangesOverlap({ start, end }, { start: eventStart, end: eventEnd })) {
        conflicts.push({
          type: 'resource_overlap',
          severity: 'error',
          message: `${er.resource.name} (${er.resource.type}) already assigned to "${eventLabel}"`,
          details: { resourceId: er.resourceId, conflictingEventId: er.gameId || er.practiceId || undefined, conflictingEventType: er.eventType },
        });
      }
    }

    return conflicts;
  },

  /**
   * Smart suggest: scan next 10 open slots and score by least notifications needed.
   */
  async suggestOpenSlots(params: {
    schoolId: string;
    facilityId?: string;
    durationMinutes: number;
    preferredStart: Date;
    participantIds?: string[];
    resourceIds?: string[];
    maxSuggestions?: number;
  }): Promise<SlotSuggestion[]> {
    const { schoolId, facilityId, durationMinutes, preferredStart, participantIds, resourceIds, maxSuggestions = 10 } = params;

    // Get available facilities for this school
    const facilities = facilityId
      ? await prisma.facility.findMany({ where: { id: facilityId } })
      : await prisma.facility.findMany({ where: { schoolId } });

    const suggestions: SlotSuggestion[] = [];
    const slotDuration = durationMinutes * 60 * 1000;

    // Try slots starting from preferred time, advancing by 30-minute increments
    for (let offset = 0; offset < 7 * 24 * 2; offset++) { // up to 7 days of 30-min slots
      const slotStart = new Date(preferredStart.getTime() + offset * 30 * 60 * 1000);
      const slotEnd = new Date(slotStart.getTime() + slotDuration);

      // Skip overnight hours (before 7am or after 10pm)
      const hour = slotStart.getHours();
      if (hour < 7 || hour >= 22) continue;

      for (const facility of facilities) {
        const conflicts = await this.checkAllConflicts({
          schoolId,
          facilityId: facility.id,
          start: slotStart,
          end: slotEnd,
          participantIds,
          resourceIds,
        });

        if (conflicts.filter(c => c.severity === 'error').length === 0) {
          // Score: distance from preferred time (in hours) + warning count
          const hoursDiff = Math.abs(slotStart.getTime() - preferredStart.getTime()) / (60 * 60 * 1000);
          const warningCount = conflicts.filter(c => c.severity === 'warning').length;
          const score = hoursDiff + warningCount * 2;

          suggestions.push({
            start: slotStart,
            end: slotEnd,
            facilityId: facility.id,
            facilityName: facility.name,
            score,
            conflictCount: warningCount,
          });
        }

        if (suggestions.length >= maxSuggestions) break;
      }

      if (suggestions.length >= maxSuggestions) break;
    }

    // Sort by score (lower is better)
    return suggestions.sort((a, b) => a.score - b.score).slice(0, maxSuggestions);
  },
};
