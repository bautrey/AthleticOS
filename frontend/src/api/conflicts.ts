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

export interface ConflictListItem {
  type: 'game' | 'practice';
  id: string;
  datetime: string;
  opponent?: string;
  teamName: string;
  teamLevel: string;
  facilityName: string | null;
  seasonId: string;
  conflicts: Conflict[];
  overrideCount: number;
}

export interface ConflictListResponse {
  data: ConflictListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  summary: { total: number; byBlockerType: Record<string, number> };
}

export interface ConflictListQuery {
  page?: number;
  limit?: number;
  eventType?: 'game' | 'practice';
  blockerType?: BlockerType;
  sortBy?: 'datetime' | 'blockerType';
  sortOrder?: 'asc' | 'desc';
}

export const conflictsApi = {
  // List all conflicts for a school (paginated)
  listConflicts: async (schoolId: string, query?: ConflictListQuery): Promise<ConflictListResponse> => {
    const params = new URLSearchParams();
    if (query?.page) params.append('page', String(query.page));
    if (query?.limit) params.append('limit', String(query.limit));
    if (query?.eventType) params.append('eventType', query.eventType);
    if (query?.blockerType) params.append('blockerType', query.blockerType);
    if (query?.sortBy) params.append('sortBy', query.sortBy);
    if (query?.sortOrder) params.append('sortOrder', query.sortOrder);
    const qs = params.toString();
    const { data } = await api.get(`/schools/${schoolId}/conflicts${qs ? `?${qs}` : ''}`);
    return data;
  },

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
