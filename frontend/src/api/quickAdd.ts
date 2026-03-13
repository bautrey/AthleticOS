// frontend/src/api/quickAdd.ts
import { api } from './client';

export interface FacilityRef {
  id: string;
  name: string;
}

export interface TeamRef {
  id: string;
  name: string;
  sport: string;
  seasonId?: string;
}

export interface ParsedQuickAdd {
  eventType: 'GAME' | 'PRACTICE';
  dayOfWeek: string | null;
  startTime: string | null;
  endTime: string | null;
  datetime: string | null;
  durationMinutes: number | null;
  facilityId: string | null;
  facilityName: string | null;
  facilityMatches: FacilityRef[];
  teamId: string | null;
  teamName: string | null;
  teamMatches: TeamRef[];
  seasonId: string | null;
  opponent: string | null;
  confidence: number;
  missingFields: string[];
}

export interface QuickAddResult {
  parsed: ParsedQuickAdd;
  conflicts: {
    hasConflicts: boolean;
    conflicts: unknown[];
  };
}

export interface QuickAddInput {
  text: string;
  weekStartDate: string;
  seasonId?: string;
}

export const quickAddApi = {
  parse: async (schoolId: string, input: QuickAddInput): Promise<QuickAddResult> => {
    const { data } = await api.post(`/schools/${schoolId}/quick-add`, input);
    return data.data;
  },
};
