// frontend/src/api/practices.ts
import { api } from './client';

export interface Practice {
  id: string;
  seasonId: string;
  facilityId: string | null;
  datetime: string;
  durationMinutes: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePracticeInput {
  facilityId?: string;
  datetime: string;
  durationMinutes?: number;
  notes?: string;
}

export const practicesApi = {
  list: async (seasonId: string): Promise<Practice[]> => {
    const { data } = await api.get(`/seasons/${seasonId}/practices`);
    return data.data;
  },

  create: async (seasonId: string, input: CreatePracticeInput): Promise<Practice> => {
    const { data } = await api.post(`/seasons/${seasonId}/practices`, input);
    return data.data;
  },

  get: async (practiceId: string): Promise<Practice> => {
    const { data } = await api.get(`/practices/${practiceId}`);
    return data.data;
  },

  update: async (practiceId: string, input: Partial<CreatePracticeInput>): Promise<Practice> => {
    const { data } = await api.patch(`/practices/${practiceId}`, input);
    return data.data;
  },

  delete: async (practiceId: string): Promise<void> => {
    await api.delete(`/practices/${practiceId}`);
  },
};
