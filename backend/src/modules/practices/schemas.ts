// backend/src/modules/practices/schemas.ts
import { z } from 'zod';

export const createPracticeSchema = z.object({
  facilityId: z.string().optional(),
  datetime: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(480).default(90),
  notes: z.string().max(1000).optional(),
});

export const updatePracticeSchema = createPracticeSchema.partial();

export type CreatePracticeInput = z.infer<typeof createPracticeSchema>;
export type UpdatePracticeInput = z.infer<typeof updatePracticeSchema>;
