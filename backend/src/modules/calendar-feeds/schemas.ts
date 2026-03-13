// backend/src/modules/calendar-feeds/schemas.ts
import { z } from 'zod';

export const createFeedSchema = z.object({
  type: z.enum(['TEAM', 'USER']),
  teamId: z.string().optional(),
});

export const feedParamsSchema = z.object({
  id: z.string(),
});

export const feedTokenSchema = z.object({
  token: z.string(),
});

export type CreateFeedInput = z.infer<typeof createFeedSchema>;
