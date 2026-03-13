// frontend/src/api/bulkOps.ts
import { api } from './client';

export interface BulkMoveInput {
  fromDate: string;
  toDate: string;
  offsetMinutes: number;
  eventType?: 'game' | 'practice' | 'all';
  teamId?: string;
  facilityId?: string;
  dryRun: boolean;
}

export interface BulkMoveResult {
  dryRun: boolean;
  count: number;
  moves: Array<{
    id: string;
    type: 'game' | 'practice';
    teamName: string;
    originalDatetime: string;
    newDatetime: string;
    facilityName: string | null;
    opponent?: string;
  }>;
}

export interface RainPlanInput {
  fromDate: string;
  toDate: string;
  dryRun: boolean;
}

export interface RainPlanResult {
  dryRun: boolean;
  count: number;
  moves: Array<{
    id: string;
    type: 'game' | 'practice';
    teamName: string;
    datetime: string;
    originalFacility: string;
    fallbackFacility: string;
    opponent?: string;
  }>;
  message?: string;
}

export interface AutoResolveInput {
  confidenceThreshold: 'high' | 'medium' | 'low';
  scope?: 'all' | 'facility' | 'blocker';
  dryRun: boolean;
}

export interface AutoResolveResult {
  dryRun: boolean;
  count: number;
  conflicts: Array<{
    eventId: string;
    eventType: string;
    teamName: string;
    datetime: string;
    suggestion: {
      action: string;
      confidence: string;
      reason: string;
    } | null;
  }>;
}

export const bulkOpsApi = {
  bulkMove: async (schoolId: string, input: BulkMoveInput): Promise<BulkMoveResult> => {
    const { data } = await api.post(`/schools/${schoolId}/bulk-move`, input);
    return data.data;
  },

  rainPlan: async (schoolId: string, input: RainPlanInput): Promise<RainPlanResult> => {
    const { data } = await api.post(`/schools/${schoolId}/rain-plan`, input);
    return data.data;
  },

  autoResolve: async (schoolId: string, input: AutoResolveInput): Promise<AutoResolveResult> => {
    const { data } = await api.post(`/schools/${schoolId}/conflicts/auto-resolve`, input);
    return data.data;
  },
};
