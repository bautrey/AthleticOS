// frontend/src/api/conflicts.ts
import { api } from './client';

export type EventType = 'GAME' | 'PRACTICE';
export type BlockerType = 'EXAM' | 'MAINTENANCE' | 'EVENT' | 'TRAVEL' | 'HOLIDAY' | 'WEATHER' | 'CUSTOM';
export type BlockerScope = 'SCHOOL_WIDE' | 'TEAM' | 'FACILITY';

export interface Conflict {
  blockerId: string;
  blockerName: string;
  blockerType: BlockerType;
  blockerScope: BlockerScope;
  reason: string;
  startDatetime: string;
  endDatetime: string;
}

export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: Conflict[];
}

export interface ConflictingEvent {
  type: 'game' | 'practice';
  id: string;
  datetime: string;
  opponent?: string;
  conflicts: Conflict[];
}

export interface SeasonConflictSummary {
  gamesWithConflicts: number;
  practicesWithConflicts: number;
  totalConflicts: number;
  conflictingEvents: ConflictingEvent[];
}

export interface SchoolConflictSummary {
  totalConflicts: number;
  byType: Record<string, number>;
  recentlyCreated: Array<{
    blockerId: string;
    blockerName: string;
    affectedEventsCount: number;
    createdAt: string;
  }>;
}

export interface AffectedEvents {
  games: Array<{ id: string; opponent: string; datetime: string }>;
  practices: Array<{ id: string; datetime: string }>;
  totalCount: number;
}

export interface CreateOverrideInput {
  eventType: EventType;
  eventId: string;
  blockerId: string;
  reason?: string;
}

export const conflictsApi = {
  // Check conflicts for a specific game
  checkGameConflicts: async (gameId: string): Promise<ConflictCheckResult> => {
    const { data } = await api.get(`/games/${gameId}/conflicts`);
    return data.data;
  },

  // Check conflicts for a specific practice
  checkPracticeConflicts: async (practiceId: string): Promise<ConflictCheckResult> => {
    const { data } = await api.get(`/practices/${practiceId}/conflicts`);
    return data.data;
  },

  // Get conflict summary for a season
  getSeasonConflicts: async (seasonId: string): Promise<SeasonConflictSummary> => {
    const { data } = await api.get(`/seasons/${seasonId}/conflicts`);
    return data.data;
  },

  // Get events affected by a specific blocker
  getBlockerAffectedEvents: async (blockerId: string): Promise<AffectedEvents> => {
    const { data } = await api.get(`/blockers/${blockerId}/affected-events`);
    return data.data;
  },

  // Get school-wide conflict summary (for dashboard)
  getSchoolConflictSummary: async (schoolId: string): Promise<SchoolConflictSummary> => {
    const { data } = await api.get(`/schools/${schoolId}/conflict-summary`);
    return data.data;
  },

  // Create a conflict override
  createOverride: async (input: CreateOverrideInput): Promise<{ id: string }> => {
    const { data } = await api.post('/conflicts/override', input);
    return data.data;
  },
};
