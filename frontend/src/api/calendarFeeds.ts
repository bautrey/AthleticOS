// frontend/src/api/calendarFeeds.ts
import { api } from './client';

export interface CalendarFeed {
  id: string;
  userId: string;
  type: 'TEAM' | 'USER';
  teamId: string | null;
  token: string;
  isActive: boolean;
  lastAccessed: string | null;
  createdAt: string;
  team: { id: string; name: string; sport: string } | null;
}

export interface CreateFeedInput {
  type: 'TEAM' | 'USER';
  teamId?: string;
}

export const calendarFeedsApi = {
  list: async (): Promise<CalendarFeed[]> => {
    const { data } = await api.get('/calendar-feeds');
    return data.data;
  },

  create: async (input: CreateFeedInput): Promise<CalendarFeed> => {
    const { data } = await api.post('/calendar-feeds', input);
    return data.data;
  },

  deactivate: async (id: string): Promise<void> => {
    await api.delete(`/calendar-feeds/${id}`);
  },

  /**
   * Build the public .ics URL for a feed token
   */
  getIcsUrl: (token: string): string => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8003';
    return `${baseUrl}/cal/${token}.ics`;
  },
};
