// backend/src/modules/seasons/schemas.ts
import { z } from 'zod';

export const createSeasonSchema = z.object({
  name: z.string().min(1).max(255),
  year: z.number().int().min(2000).max(2100),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export const updateSeasonSchema = createSeasonSchema.partial();

export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;
export type UpdateSeasonInput = z.infer<typeof updateSeasonSchema>;
