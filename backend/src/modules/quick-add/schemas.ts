// backend/src/modules/quick-add/schemas.ts
import { z } from 'zod';

export const quickAddSchema = z.object({
  text: z.string().min(3).max(200),
  weekStartDate: z.string(),
  seasonId: z.string().optional(),
});

export type QuickAddInput = z.infer<typeof quickAddSchema>;
