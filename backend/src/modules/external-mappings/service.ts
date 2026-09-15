// backend/src/modules/external-mappings/service.ts
//
// Identity mapping between AthleticOS records and records in an external system.
//
// The rule this module exists to enforce: a name never links anything. Names are
// used once, to propose a pair to a person; what gets stored and relied on is an
// id. Either side can rename freely afterwards and the link survives.

import type { ExternalSystem, ExternalEntityType, MatchMethod } from '@prisma/client';
import { prisma } from '../../common/db.js';
import { rankByName, type NameCandidate } from '../../common/text-match.js';

export interface MappingKey {
  system: ExternalSystem;
  entityType: ExternalEntityType;
}

export interface LinkInput extends MappingKey {
  entityId: string;
  externalId: string;
  externalLabel?: string | null;
  matchMethod?: MatchMethod;
}

export interface MappingSuggestion {
  external: NameCandidate;
  matches: Array<{ local: NameCandidate; score: number; exact: boolean }>;
}

export const externalMappingService = {
  /** The AthleticOS id for an external record, or null if it has never been linked. */
  async resolveLocalId(
    schoolId: string,
    key: MappingKey,
    externalId: string
  ): Promise<string | null> {
    const row = await prisma.externalMapping.findUnique({
      where: {
        unique_external_entity: {
          schoolId,
          system: key.system,
          entityType: key.entityType,
          externalId,
        },
      },
      select: { entityId: true },
    });
    return row?.entityId ?? null;
  },

  /** The external id for an AthleticOS record, or null. */
  async resolveExternalId(
    schoolId: string,
    key: MappingKey,
    entityId: string
  ): Promise<string | null> {
    const row = await prisma.externalMapping.findUnique({
      where: {
        unique_local_entity: {
          schoolId,
          system: key.system,
          entityType: key.entityType,
          entityId,
        },
      },
      select: { externalId: true },
    });
    return row?.externalId ?? null;
  },

  /**
   * Resolve many external ids at once.
   *
   * A sync pass touches every team in a response, and doing that one query at a
   * time turns a single sync into hundreds of round trips.
   */
  async resolveLocalIds(
    schoolId: string,
    key: MappingKey,
    externalIds: string[]
  ): Promise<Map<string, string>> {
    if (externalIds.length === 0) return new Map();
    const rows = await prisma.externalMapping.findMany({
      where: {
        schoolId,
        system: key.system,
        entityType: key.entityType,
        externalId: { in: externalIds },
      },
      select: { externalId: true, entityId: true },
    });
    return new Map(rows.map((r) => [r.externalId, r.entityId]));
  },

  /**
   * Record a link, replacing whatever either side pointed at before.
   *
   * Re-linking is a correction, not an error: someone mapped the wrong pair and is
   * fixing it. Both old rows are cleared first because the two unique constraints
   * would otherwise reject the write, and a failed correction is worse than a
   * replaced one. Done in a transaction so a correction cannot half-apply and leave
   * the entity unmapped.
   */
  async link(schoolId: string, input: LinkInput, userId: string) {
    const { system, entityType, entityId, externalId } = input;

    return prisma.$transaction(async (tx) => {
      await tx.externalMapping.deleteMany({
        where: {
          schoolId,
          system,
          entityType,
          OR: [{ entityId }, { externalId }],
        },
      });

      return tx.externalMapping.create({
        data: {
          schoolId,
          system,
          entityType,
          entityId,
          externalId,
          externalLabel: input.externalLabel ?? null,
          matchMethod: input.matchMethod ?? 'MANUAL',
          confirmedBy: userId,
          confirmedAt: new Date(),
        },
      });
    });
  },

  /** Remove a link. Returns how many rows went, so a caller can tell a no-op apart. */
  async unlink(schoolId: string, key: MappingKey, entityId: string): Promise<number> {
    const { count } = await prisma.externalMapping.deleteMany({
      where: { schoolId, system: key.system, entityType: key.entityType, entityId },
    });
    return count;
  },

  async list(schoolId: string, key: MappingKey) {
    return prisma.externalMapping.findMany({
      where: { schoolId, system: key.system, entityType: key.entityType },
      orderBy: { createdAt: 'asc' },
    });
  },

  /** Stamp a successful sync, for showing staleness in a reconciliation screen. */
  async markSynced(schoolId: string, key: MappingKey, entityIds: string[]): Promise<number> {
    if (entityIds.length === 0) return 0;
    const { count } = await prisma.externalMapping.updateMany({
      where: {
        schoolId,
        system: key.system,
        entityType: key.entityType,
        entityId: { in: entityIds },
      },
      data: { lastSyncedAt: new Date() },
    });
    return count;
  },

  /**
   * Propose pairings for external records that have no link yet.
   *
   * Already-linked records on either side are excluded, so a reconciliation screen
   * only ever shows outstanding work and cannot suggest stealing a local record
   * that is already spoken for.
   *
   * These are proposals. Nothing here writes a mapping.
   */
  async suggestLinks(
    schoolId: string,
    key: MappingKey,
    externalRecords: NameCandidate[],
    localRecords: NameCandidate[],
    options: { minScore?: number; limit?: number } = {}
  ): Promise<MappingSuggestion[]> {
    const existing = await prisma.externalMapping.findMany({
      where: { schoolId, system: key.system, entityType: key.entityType },
      select: { entityId: true, externalId: true },
    });
    const linkedExternal = new Set(existing.map((e) => e.externalId));
    const linkedLocal = new Set(existing.map((e) => e.entityId));

    const availableLocal = localRecords.filter((l) => !linkedLocal.has(l.id));

    return externalRecords
      .filter((e) => !linkedExternal.has(e.id))
      .map((external) => ({
        external,
        matches: rankByName(external.name, availableLocal, options).map((m) => ({
          local: m.candidate,
          score: m.score,
          exact: m.exact,
        })),
      }));
  },
};
