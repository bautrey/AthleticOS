// backend/src/modules/priority-rules/schemas.ts

import { z } from 'zod';

const teamLevelScoresSchema = z.object({
  VARSITY: z.number().int().min(0).max(100),
  JV: z.number().int().min(0).max(100),
  FRESHMAN: z.number().int().min(0).max(100),
});

const seasonStatusScoresSchema = z.object({
  IN_SEASON: z.number().int().min(0).max(100),
  OFF_SEASON: z.number().int().min(0).max(100),
});

const eventTypeScoresSchema = z.object({
  GAME: z.number().int().min(0).max(100),
  PRACTICE: z.number().int().min(0).max(100),
});

const homeAwayScoresSchema = z.object({
  HOME: z.number().int().min(0).max(100),
  AWAY: z.number().int().min(0).max(100),
  NEUTRAL: z.number().int().min(0).max(100),
});

export const updatePriorityRulesSchema = z.object({
  teamLevelWeight: z.number().int().min(0).max(100),
  seasonStatusWeight: z.number().int().min(0).max(100),
  eventTypeWeight: z.number().int().min(0).max(100),
  homeAwayWeight: z.number().int().min(0).max(100),
  teamLevelScores: teamLevelScoresSchema,
  seasonStatusScores: seasonStatusScoresSchema,
  eventTypeScores: eventTypeScoresSchema,
  homeAwayScores: homeAwayScoresSchema,
  facilityOverrides: z.record(z.string(), z.object({
    teamLevelWeight: z.number().int().min(0).max(100).optional(),
    seasonStatusWeight: z.number().int().min(0).max(100).optional(),
    eventTypeWeight: z.number().int().min(0).max(100).optional(),
    homeAwayWeight: z.number().int().min(0).max(100).optional(),
    teamLevelScores: teamLevelScoresSchema.optional(),
    seasonStatusScores: seasonStatusScoresSchema.optional(),
    eventTypeScores: eventTypeScoresSchema.optional(),
    homeAwayScores: homeAwayScoresSchema.optional(),
  })).optional().default({}),
}).refine(
  data => data.teamLevelWeight + data.seasonStatusWeight + data.eventTypeWeight + data.homeAwayWeight === 100,
  { message: 'Weights must sum to 100', path: ['teamLevelWeight'] }
);

export const calculatePrioritySchema = z.object({
  teamLevel: z.enum(['VARSITY', 'JV', 'FRESHMAN']),
  seasonStatus: z.enum(['IN_SEASON', 'OFF_SEASON']),
  eventType: z.enum(['GAME', 'PRACTICE']),
  homeAway: z.enum(['HOME', 'AWAY', 'NEUTRAL']),
  facilityId: z.string().optional(),
});

export const comparePrioritySchema = z.object({
  eventA: z.object({
    eventType: z.enum(['GAME', 'PRACTICE']),
    eventId: z.string(),
    teamLevel: z.enum(['VARSITY', 'JV', 'FRESHMAN']),
    seasonStatus: z.enum(['IN_SEASON', 'OFF_SEASON']),
    homeAway: z.enum(['HOME', 'AWAY', 'NEUTRAL']),
  }),
  eventB: z.object({
    eventType: z.enum(['GAME', 'PRACTICE']),
    eventId: z.string(),
    teamLevel: z.enum(['VARSITY', 'JV', 'FRESHMAN']),
    seasonStatus: z.enum(['IN_SEASON', 'OFF_SEASON']),
    homeAway: z.enum(['HOME', 'AWAY', 'NEUTRAL']),
  }),
  facilityId: z.string().optional(),
});

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type UpdatePriorityRulesInput = z.infer<typeof updatePriorityRulesSchema>;
export type CalculatePriorityInput = z.infer<typeof calculatePrioritySchema>;
export type ComparePriorityInput = z.infer<typeof comparePrioritySchema>;
export type AuditQuery = z.infer<typeof auditQuerySchema>;
