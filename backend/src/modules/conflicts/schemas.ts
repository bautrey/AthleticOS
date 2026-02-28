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
});

export type ConflictsListQuery = z.infer<typeof conflictsListQuerySchema>;

export const batchOverrideSchema = z.object({
  overrides: z.array(z.object({
    eventType: z.enum(['GAME', 'PRACTICE']),
    eventId: z.string().min(1),
    blockerId: z.string().min(1),
  })).min(1).max(100),
  reason: z.string().min(1),
});

export type BatchOverrideInput = z.infer<typeof batchOverrideSchema>;
