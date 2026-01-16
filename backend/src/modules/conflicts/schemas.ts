// backend/src/modules/conflicts/schemas.ts
import { z } from 'zod';

export const createOverrideSchema = z.object({
  eventType: z.enum(['GAME', 'PRACTICE']),
  eventId: z.string().min(1),
  blockerId: z.string().min(1),
  reason: z.string().optional(),
});

export type CreateOverrideInput = z.infer<typeof createOverrideSchema>;
