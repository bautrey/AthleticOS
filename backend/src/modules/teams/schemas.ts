// backend/src/modules/teams/schemas.ts
import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
  sport: z.string().min(1).max(100),
  level: z.enum(['VARSITY', 'JV', 'FRESHMAN']).default('VARSITY'),
});

export const updateTeamSchema = createTeamSchema.partial();

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
