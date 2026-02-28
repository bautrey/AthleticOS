// frontend/src/api/events.ts
import { api } from './client';

export interface UpcomingEvent {
  type: 'game' | 'practice';
  id: string;
  datetime: string;
  teamName: string;
  teamLevel: string;
  opponent?: string;
  facilityName: string | null;
  homeAway?: string;
  seasonId: string;
  hasConflicts: boolean;
  conflictCount: number;
}

export interface UpcomingEventsQuery {
  from?: string;
  to?: string;
}

export const eventsApi = {
  getUpcoming: async (schoolId: string, query?: UpcomingEventsQuery): Promise<UpcomingEvent[]> => {
    const params = new URLSearchParams();
    if (query?.from) params.append('from', query.from);
    if (query?.to) params.append('to', query.to);
    const qs = params.toString();
    const { data } = await api.get(`/schools/${schoolId}/events/upcoming${qs ? `?${qs}` : ''}`);
    return data.data;
  },
};
