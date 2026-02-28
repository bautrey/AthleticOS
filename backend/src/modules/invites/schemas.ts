// backend/src/modules/invites/schemas.ts
import { z } from 'zod';

export const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'ATHLETIC_DIRECTOR', 'COACH', 'PARENT', 'ATHLETE']),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
