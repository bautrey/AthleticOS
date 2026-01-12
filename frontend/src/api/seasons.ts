// frontend/src/api/seasons.ts
import { api } from './client';

export interface Season {
  id: string;
  schoolId: string;
  name: string;
  sport: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSeasonInput {
  name: string;
  sport: string;
  startDate: string;
  endDate: string;
}

export const seasonsApi = {
  list: async (schoolId: string): Promise<Season[]> => {
    const { data } = await api.get(`/schools/${schoolId}/seasons`);
    return data.data;
  },

  create: async (schoolId: string, input: CreateSeasonInput): Promise<Season> => {
    const { data } = await api.post(`/schools/${schoolId}/seasons`, input);
    return data.data;
  },

  delete: async (schoolId: string, seasonId: string): Promise<void> => {
    await api.delete(`/schools/${schoolId}/seasons/${seasonId}`);
  },
};
