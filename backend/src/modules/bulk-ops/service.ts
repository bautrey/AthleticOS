// backend/src/modules/bulk-ops/service.ts
import { prisma } from '../../common/db.js';
import { ValidationError } from '../../common/errors.js';
import { notificationService } from '../notifications/service.js';
import type { BulkMoveInput, RainPlanInput, AutoResolveInput } from './schemas.js';

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
  originalFacility: string;
  fallbackFacility: string;
  opponent?: string;
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

    // Get outdoor facilities with rain fallbacks
    const outdoorFacilities = await prisma.facility.findMany({
      where: {
        schoolId,
        type: { in: ['FIELD', 'TRACK', 'COURT'] },
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

    if (outdoorIds.length === 0) {
      return { dryRun: input.dryRun, count: 0, moves: [], message: 'No outdoor facilities with rain fallbacks configured.' };
    }

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
          originalFacility: fb.originalName,
          fallbackFacility: fb.fallbackName,
          opponent: game.opponent,
        });
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
          originalFacility: fb.originalName,
          fallbackFacility: fb.fallbackName,
        });
      }
    }

    if (input.dryRun) {
      return { dryRun: true, count: moves.length, moves };
    }

    // Execute: update facility IDs to fallback
    const ops: any[] = [];
    for (const move of moves) {
      const fb = outdoorFacilities.find(f => f.name === move.originalFacility);
      if (!fb) continue;
      if (move.type === 'game') {
        ops.push(prisma.game.update({ where: { id: move.id }, data: { facilityId: fb.rainFallbackId! } }));
      } else {
        ops.push(prisma.practice.update({ where: { id: move.id }, data: { facilityId: fb.rainFallbackId! } }));
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

    return { dryRun: false, count: moves.length, moves };
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
