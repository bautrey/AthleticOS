// backend/src/modules/resources/schemas.ts
import { z } from 'zod';

export const createResourceSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['BUS', 'REFEREE', 'EQUIPMENT', 'OTHER']),
  metadata: z.record(z.unknown()).optional(),
});

export const updateResourceSchema = createResourceSchema.partial();

export const assignResourceSchema = z.object({
  resourceId: z.string(),
  eventType: z.enum(['GAME', 'PRACTICE']),
  eventId: z.string(),
});

export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
