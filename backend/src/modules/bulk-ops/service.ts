// backend/src/modules/bulk-ops/service.ts
import { prisma } from '../../common/db.js';
import { ValidationError } from '../../common/errors.js';
import { notificationService } from '../notifications/service.js';
import type { BulkMoveInput, RainPlanInput, AutoResolveInput } from './schemas.js';
import { resolveGameDurationMinutes } from '../conflicts/schemas.js';

interface MovePreviewItem {
  id: string;
  type: 'game' | 'practice';
  teamName: string;
  originalDatetime: string;
  newDatetime: string;
  facilityName: string | null;
  opponent?: string;
}

interface RainMoveItem {
  id: string;
  type: 'game' | 'practice';
  teamName: string;
  datetime: string;
  originalFacilityId: string;
  originalFacility: string;
  fallbackFacilityId: string;
  fallbackFacility: string;
  /**
   * Whether something is already booked in the fallback at this time. Moving into
   * an occupied space is how an outdoor cancellation turns into an indoor
   * double-booking, so the preview says so rather than leaving it to be discovered.
   */
  fallbackOccupied: boolean;
  opponent?: string;
}

/** A booking already sitting in a fallback space: [start, end) in epoch millis. */
interface OccupiedSpan {
  start: number;
  end: number;
}

/**
 * Everything already booked in the given facilities over a date range.
 *
 * Read in one pass and indexed by facility so the rain plan can answer "is the gym
 * free at 3:30 on Thursday" without a query per move.
 */
async function loadFallbackOccupancy(
  schoolId: string,
  facilityIds: string[],
  fromDate: Date,
  toDate: Date,
  gameDurationMinutes: number
): Promise<Map<string, OccupiedSpan[]>> {
  const index = new Map<string, OccupiedSpan[]>();
  if (facilityIds.length === 0) return index;

  const where = {
    facilityId: { in: facilityIds },
    datetime: { gte: fromDate, lte: toDate },
    season: { team: { schoolId } },
  };
  const [games, practices] = await Promise.all([
    prisma.game.findMany({ where, select: { facilityId: true, datetime: true } }),
    prisma.practice.findMany({
      where,
      select: { facilityId: true, datetime: true, durationMinutes: true },
    }),
  ]);

  const add = (facilityId: string | null, datetime: Date, minutes: number) => {
    if (!facilityId) return;
    const start = datetime.getTime();
    const spans = index.get(facilityId) ?? [];
    spans.push({ start, end: start + minutes * 60_000 });
    index.set(facilityId, spans);
  };

  // A Game carries no duration, so its footprint comes from the school's own
  // gameDurationMinutes setting - the same resolution the conflicts engine uses,
  // rather than a second guess that could disagree with it.
  for (const game of games) add(game.facilityId, game.datetime, gameDurationMinutes);
  for (const practice of practices) add(practice.facilityId, practice.datetime, practice.durationMinutes);

  return index;
}

/** Add a span to an occupancy index, so later moves see earlier ones. */
function occupy(
  index: Map<string, OccupiedSpan[]>,
  facilityId: string,
  datetime: Date,
  durationMinutes: number
): void {
  const start = datetime.getTime();
  const spans = index.get(facilityId) ?? [];
  spans.push({ start, end: start + durationMinutes * 60_000 });
  index.set(facilityId, spans);
}

/** Whether the event would land on top of something already in the fallback. */
function isOccupied(
  index: Map<string, OccupiedSpan[]>,
  facilityId: string,
  datetime: Date,
  durationMinutes: number
): boolean {
  const start = datetime.getTime();
  const end = start + durationMinutes * 60_000;
  // Half-open: an event that starts exactly when another ends is not a collision.
  return (index.get(facilityId) ?? []).some(span => span.start < end && start < span.end);
}

export const bulkOpsService = {
  /**
   * Bulk move: find events in date range, shift by offsetMinutes.
   * dryRun returns preview only.
   */
  async bulkMove(schoolId: string, input: BulkMoveInput) {
    const fromDate = new Date(input.fromDate);
    fromDate.setUTCHours(0, 0, 0, 0);
    const toDate = new Date(input.toDate);
    toDate.setUTCHours(23, 59, 59, 999);

    if (fromDate > toDate) {
      throw new ValidationError('fromDate must be before toDate');
    }

    const preview: MovePreviewItem[] = [];

    // Build filter conditions
    const seasonFilter: Record<string, unknown> = { team: { schoolId } };
    if (input.teamId) seasonFilter.team = { ...seasonFilter.team as object, id: input.teamId };

    // Fetch games
    if (input.eventType === 'all' || input.eventType === 'game') {
      const gameWhere: Record<string, unknown> = {
        season: seasonFilter,
        datetime: { gte: fromDate, lte: toDate },
      };
      if (input.facilityId) gameWhere.facilityId = input.facilityId;

      const games = await prisma.game.findMany({
        where: gameWhere,
        include: {
          facility: { select: { name: true } },
          season: { include: { team: { select: { name: true } } } },
        },
      });

      for (const game of games) {
        const newDatetime = new Date(game.datetime.getTime() + input.offsetMinutes * 60000);
        preview.push({
          id: game.id,
          type: 'game',
          teamName: game.season.team.name,
          originalDatetime: game.datetime.toISOString(),
          newDatetime: newDatetime.toISOString(),
          facilityName: game.facility?.name ?? null,
          opponent: game.opponent,
        });
      }
    }

    // Fetch practices
    if (input.eventType === 'all' || input.eventType === 'practice') {
      const practiceWhere: Record<string, unknown> = {
        season: seasonFilter,
        datetime: { gte: fromDate, lte: toDate },
      };
      if (input.facilityId) practiceWhere.facilityId = input.facilityId;

      const practices = await prisma.practice.findMany({
        where: practiceWhere,
        include: {
          facility: { select: { name: true } },
          season: { include: { team: { select: { name: true } } } },
        },
      });

      for (const practice of practices) {
        const newDatetime = new Date(practice.datetime.getTime() + input.offsetMinutes * 60000);
        preview.push({
          id: practice.id,
          type: 'practice',
          teamName: practice.season.team.name,
          originalDatetime: practice.datetime.toISOString(),
          newDatetime: newDatetime.toISOString(),
          facilityName: practice.facility?.name ?? null,
        });
      }
    }

    if (input.dryRun) {
      return { dryRun: true, count: preview.length, moves: preview };
    }

    // Execute the moves
    const gameIds = preview.filter(p => p.type === 'game').map(p => p.id);
    const practiceIds = preview.filter(p => p.type === 'practice').map(p => p.id);

    const ops: any[] = [];

    for (const item of preview) {
      if (item.type === 'game') {
        ops.push(
          prisma.game.update({
            where: { id: item.id },
            data: { datetime: new Date(item.newDatetime) },
          })
        );
      } else {
        ops.push(
          prisma.practice.update({
            where: { id: item.id },
            data: { datetime: new Date(item.newDatetime) },
          })
        );
      }
    }

    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }

    // Emit notification
    await notificationService.emit({
      trigger: 'SCHEDULE_CHANGE',
      schoolId,
      metadata: {
        action: 'bulk_move',
        count: preview.length,
        offsetMinutes: input.offsetMinutes,
      },
    });

    return { dryRun: false, count: preview.length, moves: preview };
  },

  /**
   * Rain plan: find outdoor events, move to rain fallback facility.
   */
  async rainPlan(schoolId: string, input: RainPlanInput) {
    const fromDate = new Date(input.fromDate);
    fromDate.setUTCHours(0, 0, 0, 0);
    const toDate = new Date(input.toDate);
    toDate.setUTCHours(23, 59, 59, 999);

    if (fromDate > toDate) {
      throw new ValidationError('fromDate must be before toDate');
    }

    // Whether a space is exposed to the weather is a fact about the space, not
    // about its type: tennis courts are COURT and outdoors, a field house is OTHER
    // and indoors. Selecting on FacilityType rained out the indoor courts and
    // missed every outdoor space nobody could find a type for.
    const outdoorFacilities = await prisma.facility.findMany({
      where: {
        schoolId,
        isOutdoor: true,
        rainFallbackId: { not: null },
      },
      include: {
        rainFallback: { select: { id: true, name: true } },
      },
    });

    const facilityMap = new Map(
      outdoorFacilities.map(f => [f.id, { fallbackId: f.rainFallbackId!, fallbackName: f.rainFallback!.name, originalName: f.name }])
    );
    const outdoorIds = outdoorFacilities.map(f => f.id);
    const fallbackIds = [...new Set(outdoorFacilities.map(f => f.rainFallbackId!))];

    if (outdoorIds.length === 0) {
      return { dryRun: input.dryRun, count: 0, occupiedCount: 0, moves: [] as RainMoveItem[], message: 'No outdoor facilities with rain fallbacks configured.' };
    }

    // What is already booked in the fallback spaces over this range, so a move can
    // say whether it is landing on top of something. Read once rather than per move.
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { settings: true },
    });
    const gameDurationMinutes = resolveGameDurationMinutes(school?.settings);
    const occupied = await loadFallbackOccupancy(
      schoolId,
      fallbackIds,
      fromDate,
      toDate,
      gameDurationMinutes
    );

    const moves: RainMoveItem[] = [];

    // Fetch games at outdoor facilities
    const games = await prisma.game.findMany({
      where: {
        facilityId: { in: outdoorIds },
        datetime: { gte: fromDate, lte: toDate },
        season: { team: { schoolId } },
      },
      include: {
        season: { include: { team: { select: { name: true } } } },
      },
    });

    for (const game of games) {
      const fb = facilityMap.get(game.facilityId!);
      if (fb) {
        moves.push({
          id: game.id,
          type: 'game',
          teamName: game.season.team.name,
          datetime: game.datetime.toISOString(),
          originalFacilityId: game.facilityId!,
          originalFacility: fb.originalName,
          fallbackFacilityId: fb.fallbackId,
          fallbackFacility: fb.fallbackName,
          fallbackOccupied: isOccupied(occupied, fb.fallbackId, game.datetime, gameDurationMinutes),
          opponent: game.opponent,
        });
        // This move now occupies the fallback, so a later move landing in the
        // same space at the same time sees it. Checking only against what was
        // ALREADY booked let two rained-out events pile into one empty gym and
        // both report it free - the exact collision this field exists to warn about.
        occupy(occupied, fb.fallbackId, game.datetime, gameDurationMinutes);
      }
    }

    // Fetch practices at outdoor facilities
    const practices = await prisma.practice.findMany({
      where: {
        facilityId: { in: outdoorIds },
        datetime: { gte: fromDate, lte: toDate },
        season: { team: { schoolId } },
      },
      include: {
        season: { include: { team: { select: { name: true } } } },
      },
    });

    for (const practice of practices) {
      const fb = facilityMap.get(practice.facilityId!);
      if (fb) {
        moves.push({
          id: practice.id,
          type: 'practice',
          teamName: practice.season.team.name,
          datetime: practice.datetime.toISOString(),
          originalFacilityId: practice.facilityId!,
          originalFacility: fb.originalName,
          fallbackFacilityId: fb.fallbackId,
          fallbackFacility: fb.fallbackName,
          fallbackOccupied: isOccupied(
            occupied,
            fb.fallbackId,
            practice.datetime,
            practice.durationMinutes
          ),
        });
        occupy(occupied, fb.fallbackId, practice.datetime, practice.durationMinutes);
      }
    }

    const occupiedCount = moves.filter(m => m.fallbackOccupied).length;

    if (input.dryRun) {
      return { dryRun: true, count: moves.length, occupiedCount, moves };
    }

    // Execute: update facility IDs to fallback.
    //
    // Keyed on the id carried by the move. Re-finding the facility by name matched
    // whichever record happened to be first when two spaces share a name, so a
    // school with an indoor and an outdoor "Tennis Courts" moved the wrong events.
    const ops: any[] = [];
    for (const move of moves) {
      const data = { facilityId: move.fallbackFacilityId };
      if (move.type === 'game') {
        ops.push(prisma.game.update({ where: { id: move.id }, data }));
      } else {
        ops.push(prisma.practice.update({ where: { id: move.id }, data }));
      }
    }

    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }

    // Emit notification
    await notificationService.emit({
      trigger: 'SCHEDULE_CHANGE',
      schoolId,
      metadata: {
        action: 'rain_plan',
        count: moves.length,
      },
    });

    return { dryRun: false, count: moves.length, occupiedCount, moves };
  },

  /**
   * Auto-resolve conflicts: placeholder that returns conflicts that would be resolved
   * based on confidence threshold.
   */
  async autoResolve(schoolId: string, input: AutoResolveInput) {
    // Import conflicts service lazily to avoid circular deps
    const { conflictService } = await import('../conflicts/service.js');

    const result = await conflictService.listAllConflicts(schoolId, {
      page: 1,
      limit: 100,
      sortBy: 'datetime',
      sortOrder: 'asc',
      includeSuggestions: true,
    });

    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    const threshold = confidenceOrder[input.confidenceThreshold];

    const resolvable = result.data.filter(item => {
      if (!item.suggestion) return false;
      const itemConf = confidenceOrder[item.suggestion.confidence] || 0;
      return itemConf >= threshold;
    });

    // Filter by scope
    const filtered = input.scope === 'all'
      ? resolvable
      : resolvable; // For now, all scopes return same set (placeholder)

    return {
      dryRun: input.dryRun,
      count: filtered.length,
      conflicts: filtered.map(item => ({
        eventId: item.id,
        eventType: item.type,
        teamName: item.teamName,
        datetime: item.datetime,
        suggestion: item.suggestion,
      })),
    };
  },
};
