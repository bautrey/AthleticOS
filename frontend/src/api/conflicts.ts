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
  suggestion?: ConflictSuggestion;
}

export interface ConflictListResponse {
  data: ConflictListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  summary: { total: number; byBlockerType: Record<string, number> };
}

export interface ConflictSuggestion {
  action: 'reschedule_lower' | 'override' | 'manual_review';
  targetEventId: string;
  targetEventName: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  priorityComparison: {
    winner: { eventId: string; name: string; score: number };
    loser: { eventId: string; name: string; score: number };
  } | null;
  eventScore: number;
}

export interface ConflictOverrideRecord {
  blockerId: string;
  reason: string | null;
  overriddenAt: string;
}

export interface BatchOverrideInput {
  overrides: Array<{
    eventType: EventType;
    eventId: string;
    blockerId: string;
  }>;
  reason: string;
}

export interface BatchOverrideResult {
  succeeded: number;
  failed: number;
  errors: Array<{ eventId: string; error: string }>;
}

export interface ConflictListQuery {
  page?: number;
  limit?: number;
  eventType?: 'game' | 'practice';
  blockerType?: BlockerType;
  sortBy?: 'datetime' | 'blockerType';
  sortOrder?: 'asc' | 'desc';
  includeSuggestions?: boolean;
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
    if (query?.includeSuggestions) params.append('includeSuggestions', 'true');
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

  // Get override history for an event
  getOverridesForEvent: async (eventType: EventType, eventId: string): Promise<ConflictOverrideRecord[]> => {
    const { data } = await api.get(`/conflicts/overrides/${eventType}/${eventId}`);
    return data.data;
  },

  // Batch override multiple conflicts
  batchOverride: async (input: BatchOverrideInput): Promise<BatchOverrideResult> => {
    const { data } = await api.post('/conflicts/batch-override', input);
    return data.data;
  },
};
