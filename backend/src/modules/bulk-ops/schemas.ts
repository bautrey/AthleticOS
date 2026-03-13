// backend/src/modules/bulk-ops/schemas.ts
import { z } from 'zod';

export const bulkMoveSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  offsetMinutes: z.number().int(),
  eventType: z.enum(['game', 'practice', 'all']).default('all'),
  teamId: z.string().optional(),
  facilityId: z.string().optional(),
  dryRun: z.boolean().default(true),
});

export const rainPlanSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  dryRun: z.boolean().default(true),
});

export const autoResolveSchema = z.object({
  confidenceThreshold: z.enum(['high', 'medium', 'low']).default('high'),
  scope: z.enum(['all', 'facility', 'blocker']).default('all'),
  dryRun: z.boolean().default(true),
});

export type BulkMoveInput = z.infer<typeof bulkMoveSchema>;
export type RainPlanInput = z.infer<typeof rainPlanSchema>;
export type AutoResolveInput = z.infer<typeof autoResolveSchema>;
