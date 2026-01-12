// backend/src/modules/games/schemas.ts
import { z } from 'zod';

export const createGameSchema = z.object({
  facilityId: z.string().optional(),
  opponent: z.string().min(1).max(255),
  datetime: z.string().datetime(),
  homeAway: z.enum(['HOME', 'AWAY', 'NEUTRAL']).default('HOME'),
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'CANCELLED', 'POSTPONED', 'COMPLETED']).default('SCHEDULED'),
  notes: z.string().max(1000).optional(),
});

export const updateGameSchema = createGameSchema.partial();

export type CreateGameInput = z.infer<typeof createGameSchema>;
export type UpdateGameInput = z.infer<typeof updateGameSchema>;
