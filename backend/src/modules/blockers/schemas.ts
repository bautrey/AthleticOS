// backend/src/modules/blockers/schemas.ts

import { z } from 'zod';

export const BlockerType = z.enum([
  'EXAM',
  'MAINTENANCE',
  'EVENT',
  'TRAVEL',
  'HOLIDAY',
  'WEATHER',
  'CUSTOM'
]);

export const BlockerScope = z.enum([
  'SCHOOL_WIDE',
  'TEAM',
  'FACILITY'
]);

export const createBlockerSchema = z.object({
  type: BlockerType,
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  scope: BlockerScope,
  teamId: z.string().cuid().optional().nullable(),
  facilityId: z.string().cuid().optional().nullable(),
  startDatetime: z.coerce.date(),
  endDatetime: z.coerce.date()
}).refine(
  data => data.endDatetime > data.startDatetime,
  { message: 'End datetime must be after start datetime', path: ['endDatetime'] }
).refine(
  data => data.scope !== 'TEAM' || data.teamId,
  { message: 'teamId required when scope is TEAM', path: ['teamId'] }
).refine(
  data => data.scope !== 'FACILITY' || data.facilityId,
  { message: 'facilityId required when scope is FACILITY', path: ['facilityId'] }
);

export const updateBlockerSchema = z.object({
  type: BlockerType.optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  scope: BlockerScope.optional(),
  teamId: z.string().cuid().optional().nullable(),
  facilityId: z.string().cuid().optional().nullable(),
  startDatetime: z.coerce.date().optional(),
  endDatetime: z.coerce.date().optional()
}).refine(
  data => {
    if (data.startDatetime && data.endDatetime) {
      return data.endDatetime > data.startDatetime;
    }
    return true;
  },
  { message: 'End datetime must be after start datetime', path: ['endDatetime'] }
).refine(
  data => {
    // If changing to TEAM scope, teamId must be provided
    if (data.scope === 'TEAM' && !data.teamId) {
      return false;
    }
    return true;
  },
  { message: 'teamId required when changing scope to TEAM', path: ['teamId'] }
).refine(
  data => {
    // If changing to FACILITY scope, facilityId must be provided
    if (data.scope === 'FACILITY' && !data.facilityId) {
      return false;
    }
    return true;
  },
  { message: 'facilityId required when changing scope to FACILITY', path: ['facilityId'] }
);

export const blockerQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  scope: BlockerScope.optional(),
  type: BlockerType.optional(),
  teamId: z.string().cuid().optional(),
  facilityId: z.string().cuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50)
});

export type CreateBlockerInput = z.infer<typeof createBlockerSchema>;
export type UpdateBlockerInput = z.infer<typeof updateBlockerSchema>;
export type BlockerQuery = z.infer<typeof blockerQuerySchema>;
