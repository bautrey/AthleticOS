// frontend/src/api/priorityRules.ts
import { api } from './client';

// Types
export interface PriorityRule {
  id: string | null;
  schoolId: string;
  teamLevelWeight: number;
  seasonStatusWeight: number;
  eventTypeWeight: number;
  homeAwayWeight: number;
  teamLevelScores: Record<string, number>;
  seasonStatusScores: Record<string, number>;
  eventTypeScores: Record<string, number>;
  homeAwayScores: Record<string, number>;
  facilityOverrides: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePriorityRulesInput {
  teamLevelWeight: number;
  seasonStatusWeight: number;
  eventTypeWeight: number;
  homeAwayWeight: number;
  teamLevelScores: { VARSITY: number; JV: number; FRESHMAN: number };
  seasonStatusScores: { IN_SEASON: number; OFF_SEASON: number };
  eventTypeScores: { GAME: number; PRACTICE: number };
  homeAwayScores: { HOME: number; AWAY: number; NEUTRAL: number };
  facilityOverrides?: Record<string, unknown>;
}

export interface CalculatePriorityInput {
  teamLevel: 'VARSITY' | 'JV' | 'FRESHMAN';
  seasonStatus: 'IN_SEASON' | 'OFF_SEASON';
  eventType: 'GAME' | 'PRACTICE';
  homeAway: 'HOME' | 'AWAY' | 'NEUTRAL';
  facilityId?: string;
}

export interface PriorityBreakdownFactor {
  weight: number;
  factorScore: number;
  weighted: number;
}

export interface PriorityBreakdown {
  teamLevel: PriorityBreakdownFactor;
  seasonStatus: PriorityBreakdownFactor;
  eventType: PriorityBreakdownFactor;
  homeAway: PriorityBreakdownFactor;
}

export interface PriorityResult {
  score: number;
  breakdown: PriorityBreakdown;
  explanation: string;
}

export interface CompareEventInput {
  eventType: 'GAME' | 'PRACTICE';
  eventId: string;
  teamLevel: 'VARSITY' | 'JV' | 'FRESHMAN';
  seasonStatus: 'IN_SEASON' | 'OFF_SEASON';
  homeAway: 'HOME' | 'AWAY' | 'NEUTRAL';
}

export interface ComparePriorityInput {
  eventA: CompareEventInput;
  eventB: CompareEventInput;
  facilityId?: string;
}

export interface CompareResult {
  eventA: PriorityResult;
  eventB: PriorityResult;
  winner: 'eventA' | 'eventB' | 'tie';
  margin: number;
  explanation: string;
  suggestion: string;
}

export interface PriorityAudit {
  id: string;
  changedBy: string;
  changedAt: string;
  fieldChanged: string;
  oldValue: unknown;
  newValue: unknown;
  changedByUser?: { email: string };
}

export interface PaginatedAuditsResponse {
  data: PriorityAudit[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const priorityRulesApi = {
  get: async (schoolId: string): Promise<PriorityRule> => {
    const { data } = await api.get(`/schools/${schoolId}/priority-rules`);
    return data.data;
  },

  update: async (schoolId: string, input: UpdatePriorityRulesInput): Promise<PriorityRule> => {
    const { data } = await api.put(`/schools/${schoolId}/priority-rules`, input);
    return data.data;
  },

  calculate: async (schoolId: string, input: CalculatePriorityInput): Promise<PriorityResult> => {
    const { data } = await api.post(`/schools/${schoolId}/priority-rules/calculate`, input);
    return data.data;
  },

  compare: async (schoolId: string, input: ComparePriorityInput): Promise<CompareResult> => {
    const { data } = await api.post(`/schools/${schoolId}/priority-rules/compare`, input);
    return data.data;
  },

  getAudits: async (schoolId: string, query?: { page?: number; limit?: number }): Promise<PaginatedAuditsResponse> => {
    const params = new URLSearchParams();
    if (query?.page) params.append('page', String(query.page));
    if (query?.limit) params.append('limit', String(query.limit));
    const queryString = params.toString();
    const url = `/schools/${schoolId}/priority-rules/audits${queryString ? `?${queryString}` : ''}`;
    const { data } = await api.get(url);
    return data;
  },
};
