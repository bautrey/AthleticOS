// backend/src/modules/recurring/schemas.ts
import { z } from 'zod';

export const dayOfWeek = z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
export type DayOfWeek = z.infer<typeof dayOfWeek>;

export const createRecurringSchema = z.object({
  seasonId: z.string(),
  facilityId: z.string().optional(),
  days: z.array(dayOfWeek).min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().optional(),
  excludeBlockers: z.boolean().default(true),
  dryRun: z.boolean().default(true),
});

export const updateRecurringSchema = z.object({
  facilityId: z.string().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes: z.string().optional(),
});

export type CreateRecurringInput = z.infer<typeof createRecurringSchema>;
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>;
