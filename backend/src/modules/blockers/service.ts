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
