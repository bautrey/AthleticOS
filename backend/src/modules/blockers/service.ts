// backend/src/modules/blockers/service.ts
import { Prisma, Blocker, BlockerScope } from '@prisma/client';
import { prisma } from '../../common/db.js';
import { NotFoundError, ValidationError } from '../../common/errors.js';
import type { CreateBlockerInput, UpdateBlockerInput, BlockerQuery } from './schemas.js';

interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ConflictingEventsCount {
  games: number;
  practices: number;
  total: number;
}

/**
 * Clean irrelevant foreign keys based on scope
 */
function cleanDataForScope<
  T extends { scope?: BlockerScope; teamId?: string | null; facilityId?: string | null }
>(data: T): T {
  const cleaned = { ...data };

  if (cleaned.scope === 'SCHOOL_WIDE') {
    cleaned.teamId = null;
    cleaned.facilityId = null;
  } else if (cleaned.scope === 'TEAM') {
    cleaned.facilityId = null;
  } else if (cleaned.scope === 'FACILITY') {
    cleaned.teamId = null;
  }

  return cleaned;
}

/**
 * Build Prisma where clause for Game based on blocker scope
 */
function buildGameWhereClause(blocker: Blocker): Prisma.GameWhereInput {
  switch (blocker.scope) {
    case 'SCHOOL_WIDE':
      return {
        season: { team: { schoolId: blocker.schoolId } },
      };
    case 'TEAM':
      return {
        season: { teamId: blocker.teamId! },
      };
    case 'FACILITY':
      return {
        facilityId: blocker.facilityId,
      };
  }
}

/**
 * Build Prisma where clause for Practice based on blocker scope
 */
function buildPracticeWhereClause(blocker: Blocker): Prisma.PracticeWhereInput {
  switch (blocker.scope) {
    case 'SCHOOL_WIDE':
      return {
        season: { team: { schoolId: blocker.schoolId } },
      };
    case 'TEAM':
      return {
        season: { teamId: blocker.teamId! },
      };
    case 'FACILITY':
      return {
        facilityId: blocker.facilityId,
      };
  }
}

/**
 * Count events that conflict with a blocker
 */
async function countConflictingEvents(blocker: Blocker): Promise<ConflictingEventsCount> {
  const gameWhere = buildGameWhereClause(blocker);
  const practiceWhere = buildPracticeWhereClause(blocker);

  const [gamesCount, practicesCount] = await Promise.all([
    prisma.game.count({
      where: {
        ...gameWhere,
        datetime: {
          gte: blocker.startDatetime,
          lt: blocker.endDatetime,
        },
      },
    }),
    prisma.practice.count({
      where: {
        ...practiceWhere,
        datetime: {
          gte: blocker.startDatetime,
          lt: blocker.endDatetime,
        },
      },
    }),
  ]);

  return {
    games: gamesCount,
    practices: practicesCount,
    total: gamesCount + practicesCount,
  };
}

export const blockerService = {
  /**
   * List blockers with filtering and pagination
   */
  async list(schoolId: string, query: BlockerQuery): Promise<PaginatedResult<Blocker>> {
    const { page, limit, from, to, scope, type, teamId, facilityId } = query;

    const where: Prisma.BlockerWhereInput = {
      schoolId,
      ...(scope && { scope }),
      ...(type && { type }),
    };

    // Date range overlap: blocker overlaps with [from, to]
    if (from || to) {
      where.AND = [];
      if (from) {
        where.AND.push({ endDatetime: { gte: from } });
      }
      if (to) {
        where.AND.push({ startDatetime: { lte: to } });
      }
    }

    // Team filter: include team-specific AND school-wide
    if (teamId) {
      where.OR = [{ teamId }, { scope: 'SCHOOL_WIDE' }];
    }

    // Facility filter: include facility-specific AND school-wide
    if (facilityId) {
      where.OR = [{ facilityId }, { scope: 'SCHOOL_WIDE' }];
    }

    const [blockers, total] = await Promise.all([
      prisma.blocker.findMany({
        where,
        orderBy: { startDatetime: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.blocker.count({ where }),
    ]);

    return {
      data: blockers,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get a single blocker by ID
   */
  async getById(schoolId: string, id: string): Promise<Blocker> {
    const blocker = await prisma.blocker.findFirst({
      where: { id, schoolId },
    });

    if (!blocker) {
      throw new NotFoundError('Blocker', id);
    }

    return blocker;
  },

  /**
   * Create a new blocker
   */
  async create(
    schoolId: string,
    data: CreateBlockerInput,
    userId: string
  ): Promise<{ blocker: Blocker; conflictingEvents: ConflictingEventsCount }> {
    // Validate team belongs to school
    if (data.teamId) {
      const team = await prisma.team.findFirst({
        where: { id: data.teamId, schoolId },
      });
      if (!team) {
        throw new NotFoundError('Team', data.teamId);
      }
    }

    // Validate facility belongs to school
    if (data.facilityId) {
      const facility = await prisma.facility.findFirst({
        where: { id: data.facilityId, schoolId },
      });
      if (!facility) {
        throw new NotFoundError('Facility', data.facilityId);
      }
    }

    // Clear irrelevant foreign keys based on scope
    const cleanedData = cleanDataForScope(data);

    // Build unchecked create input to use direct foreign key IDs
    const createInput: Prisma.BlockerUncheckedCreateInput = {
      type: cleanedData.type,
      name: cleanedData.name,
      description: cleanedData.description,
      scope: cleanedData.scope,
      teamId: cleanedData.teamId,
      facilityId: cleanedData.facilityId,
      startDatetime: cleanedData.startDatetime,
      endDatetime: cleanedData.endDatetime,
      schoolId,
      createdBy: userId,
    };

    const blocker = await prisma.blocker.create({
      data: createInput,
    });

    // Calculate conflicting events
    const conflictingEvents = await countConflictingEvents(blocker);

    return { blocker, conflictingEvents };
  },

  /**
   * Create or update the blocker a job owns, identified by its sourceKey.
   *
   * A job that scans a rolling window re-evaluates the same day on every run - a
   * three-day forecast assesses Thursday on Tuesday, Wednesday and Thursday. Without
   * a key to write against, each pass would add another blocker for the same closure
   * and send another alert.
   *
   * `created` tells the caller whether this is news. Notifying only on creation, or
   * on a change to when the closure runs, is what keeps a daily job from mailing
   * every coach every morning about a closure they already know about.
   */
  async upsertSourced(
    schoolId: string,
    sourceKey: string,
    data: CreateBlockerInput,
    createdBy: string
  ): Promise<{ blocker: Blocker; conflictingEvents: ConflictingEventsCount; created: boolean; changed: boolean }> {
    if (data.facilityId) {
      const facility = await prisma.facility.findFirst({
        where: { id: data.facilityId, schoolId },
      });
      if (!facility) throw new NotFoundError('Facility', data.facilityId);
    }
    if (data.teamId) {
      const team = await prisma.team.findFirst({ where: { id: data.teamId, schoolId } });
      if (!team) throw new NotFoundError('Team', data.teamId);
    }

    const cleaned = cleanDataForScope(data);
    const existing = await prisma.blocker.findUnique({ where: { sourceKey } });

    // A sourceKey is owned by one school. Finding it on another is a key-construction
    // bug, and silently rewriting that school's blocker would be worse than failing.
    if (existing && existing.schoolId !== schoolId) {
      throw new ValidationError(`sourceKey "${sourceKey}" already belongs to another school`);
    }

    const changed =
      existing !== null &&
      (existing.startDatetime.getTime() !== cleaned.startDatetime.getTime() ||
        existing.endDatetime.getTime() !== cleaned.endDatetime.getTime() ||
        existing.name !== cleaned.name);

    const blocker = await prisma.blocker.upsert({
      where: { sourceKey },
      create: {
        type: cleaned.type,
        name: cleaned.name,
        description: cleaned.description,
        scope: cleaned.scope,
        teamId: cleaned.teamId,
        facilityId: cleaned.facilityId,
        startDatetime: cleaned.startDatetime,
        endDatetime: cleaned.endDatetime,
        schoolId,
        sourceKey,
        createdBy,
      },
      update: {
        name: cleaned.name,
        description: cleaned.description,
        startDatetime: cleaned.startDatetime,
        endDatetime: cleaned.endDatetime,
      },
    });

    return {
      blocker,
      conflictingEvents: await countConflictingEvents(blocker),
      created: existing === null,
      changed,
    };
  },

  /**
   * Withdraw the job-owned blockers under `prefix` that the job no longer asserts.
   *
   * A forecast that drops back below the threshold has to take its blocker with it,
   * or the schedule keeps showing a closure that is no longer predicted. Only rows
   * carrying a sourceKey are touched, so a blocker a person typed is never removed
   * by a job.
   */
  async withdrawSourced(schoolId: string, prefix: string, keepKeys: string[]): Promise<number> {
    const result = await prisma.blocker.deleteMany({
      where: {
        schoolId,
        sourceKey: { startsWith: prefix, notIn: keepKeys },
      },
    });
    return result.count;
  },

  /**
   * Update an existing blocker
   */
  async update(
    schoolId: string,
    id: string,
    data: UpdateBlockerInput
  ): Promise<{ blocker: Blocker; conflictingEvents: ConflictingEventsCount }> {
    // Verify blocker exists and belongs to school
    const existing = await this.getById(schoolId, id);

    // Validate team if changing
    if (data.teamId) {
      const team = await prisma.team.findFirst({
        where: { id: data.teamId, schoolId },
      });
      if (!team) {
        throw new NotFoundError('Team', data.teamId);
      }
    }

    // Validate facility if changing
    if (data.facilityId) {
      const facility = await prisma.facility.findFirst({
        where: { id: data.facilityId, schoolId },
      });
      if (!facility) {
        throw new NotFoundError('Facility', data.facilityId);
      }
    }

    // Validate datetime range if both provided
    if (data.endDatetime || data.startDatetime) {
      const start = data.startDatetime || existing.startDatetime;
      const end = data.endDatetime || existing.endDatetime;
      if (end <= start) {
        throw new ValidationError('End datetime must be after start datetime');
      }
    }

    // Clean data based on final scope
    const finalScope = data.scope || existing.scope;
    const cleanedData = cleanDataForScope({ ...data, scope: finalScope });

    const blocker = await prisma.blocker.update({
      where: { id },
      data: cleanedData,
    });

    const conflictingEvents = await countConflictingEvents(blocker);

    return { blocker, conflictingEvents };
  },

  /**
   * Delete a blocker
   */
  async delete(schoolId: string, id: string): Promise<void> {
    // Verify blocker exists and belongs to school
    await this.getById(schoolId, id);

    await prisma.blocker.delete({
      where: { id },
    });
  },
};
