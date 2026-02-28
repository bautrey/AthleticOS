// backend/src/modules/events/schemas.ts
import { z } from 'zod';

export const upcomingEventsSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});
