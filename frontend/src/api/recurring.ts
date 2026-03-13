// frontend/src/api/recurring.ts
import { api } from './client';

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface CreateRecurringInput {
  seasonId: string;
  facilityId?: string;
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
  notes?: string;
  excludeBlockers: boolean;
  dryRun: boolean;
}

export interface UpdateRecurringInput {
  facilityId?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

export interface GeneratedDate {
  date: string;
  dayOfWeek: DayOfWeek;
  status: 'ok' | 'excluded';
  reason?: string;
}

export interface RecurringPreview {
  dates: GeneratedDate[];
  totalGenerated: number;
  totalExcluded: number;
  totalOk: number;
  practices?: { id: string; datetime: string }[];
}

export const recurringApi = {
  create: async (schoolId: string, input: CreateRecurringInput): Promise<RecurringPreview> => {
    const { data } = await api.post(`/schools/${schoolId}/practices/recurring`, input);
    return data.data;
  },

  updateSeries: async (schoolId: string, groupId: string, input: UpdateRecurringInput): Promise<{ updated: number }> => {
    const { data } = await api.patch(`/schools/${schoolId}/practices/recurring/${groupId}`, input);
    return data.data;
  },

  deleteSeries: async (schoolId: string, groupId: string): Promise<{ deleted: number }> => {
    const { data } = await api.delete(`/schools/${schoolId}/practices/recurring/${groupId}`);
    return data.data;
  },
};
