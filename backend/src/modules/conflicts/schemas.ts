// backend/src/modules/conflicts/schemas.ts
import { z } from 'zod';

export const createOverrideSchema = z.object({
  eventType: z.enum(['GAME', 'PRACTICE']),
  eventId: z.string().min(1),
  blockerId: z.string().min(1),
  reason: z.string().optional(),
});

export type CreateOverrideInput = z.infer<typeof createOverrideSchema>;

export const conflictsListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  eventType: z.enum(['game', 'practice']).optional(),
  blockerType: z.enum(['EXAM', 'MAINTENANCE', 'EVENT', 'TRAVEL', 'HOLIDAY', 'WEATHER', 'CUSTOM']).optional(),
  sortBy: z.enum(['datetime', 'blockerType']).default('datetime'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const conflictsListQueryWithSuggestionsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  eventType: z.enum(['game', 'practice']).optional(),
  blockerType: z.enum(['EXAM', 'MAINTENANCE', 'EVENT', 'TRAVEL', 'HOLIDAY', 'WEATHER', 'CUSTOM']).optional(),
  sortBy: z.enum(['datetime', 'blockerType']).default('datetime'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  includeSuggestions: z.coerce.boolean().optional().default(false),
  // T-028: Filter by conflict types (comma-separated: blocker, facility, all)
  types: z.string().optional().default('blocker'),
});

export type ConflictsListQuery = z.infer<typeof conflictsListQuerySchema>;

// T-026: Check conflicts request schema
export const checkConflictsSchema = z.object({
  eventId: z.string().optional(),
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }).optional(),
  types: z.array(z.enum(['blocker', 'facility', 'person', 'resource']))
    .optional()
    .default(['blocker', 'facility']),
});

export type CheckConflictsInput = z.infer<typeof checkConflictsSchema>;

// T-027: Suggest slots request schema
export const suggestSlotsSchema = z.object({
  facilityId: z.string().min(1),
  date: z.string().min(1),
  durationMinutes: z.number().min(15).max(480),
  preferredTime: z.string().optional(),
});

export type SuggestSlotsInput = z.infer<typeof suggestSlotsSchema>;

export const applySlotSchema = z.object({
  eventType: z.enum(['GAME', 'PRACTICE']),
  eventId: z.string().min(1),
  newDatetime: z.string().datetime(),
});

export type ApplySlotInput = z.infer<typeof applySlotSchema>;

export const batchOverrideSchema = z.object({
  overrides: z.array(z.object({
    eventType: z.enum(['GAME', 'PRACTICE']),
    eventId: z.string().min(1),
    blockerId: z.string().min(1),
  })).min(1).max(100),
  reason: z.string().min(1),
});

export type BatchOverrideInput = z.infer<typeof batchOverrideSchema>;
