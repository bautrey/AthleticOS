// backend/src/modules/schools/schemas.ts
import { z } from 'zod';

export const createSchoolSchema = z.object({
  name: z.string().min(1).max(255),
  timezone: z.string().default('America/New_York'),
  settings: z.record(z.unknown()).optional(),
});

export const updateSchoolSchema = createSchoolSchema.partial();

export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
