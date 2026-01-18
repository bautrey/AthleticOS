// backend/src/modules/shares/schemas.ts
import { z } from 'zod';

export const createShareSchema = z.object({
  title: z.string().max(255).optional(),
  showNotes: z.boolean().default(false),
  showFacility: z.boolean().default(true),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const updateShareSchema = z.object({
  title: z.string().max(255).optional(),
  showNotes: z.boolean().optional(),
  showFacility: z.boolean().optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export type CreateShareInput = z.infer<typeof createShareSchema>;
export type UpdateShareInput = z.infer<typeof updateShareSchema>;

// Response types
export interface ShareResponse {
  id: string;
  token: string;
  url: string;
  embedCode: string;
  title: string | null;
  showNotes: boolean;
  showFacility: boolean;
  isActive: boolean;
  expiresAt: Date | null;
  viewCount: number;
  createdAt: Date;
}

export interface PublicScheduleResponse {
  title: string;
  team: {
    name: string;
    sport: string;
  };
  school: {
    name: string;
  };
  games: Array<{
    datetime: string;
    opponent: string;
    homeAway: string;
    facility: string | null;
    status: string;
    notes?: string | null;
  }>;
  practices: Array<{
    datetime: string;
    duration: number;
    facility: string | null;
    notes?: string | null;
  }>;
}
