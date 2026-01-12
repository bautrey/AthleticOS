// backend/src/modules/facilities/schemas.ts
import { z } from 'zod';

export const createFacilitySchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['GYM', 'FIELD', 'POOL', 'COURT', 'TRACK', 'OTHER']).default('GYM'),
  capacity: z.number().int().positive().optional(),
});

export const updateFacilitySchema = createFacilitySchema.partial();

export type CreateFacilityInput = z.infer<typeof createFacilitySchema>;
export type UpdateFacilityInput = z.infer<typeof updateFacilitySchema>;
