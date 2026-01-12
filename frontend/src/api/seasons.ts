// frontend/src/api/seasons.ts
import { api } from './client';

export interface Season {
  id: string;
  teamId: string;
  name: string;
  year: number;
  startDate: string;
  endDate: string;
  sport: string;      // derived from team
  teamName: string;   // derived from team
  createdAt: string;
  updatedAt: string;
}

export interface CreateSeasonInput {
  teamId: string;
  name: string;
  year: number;
  startDate: string;
  endDate: string;
}

export const seasonsApi = {
  list: async (schoolId: string): Promise<Season[]> => {
    const { data } = await api.get(`/schools/${schoolId}/seasons`);
    return data.data;
  },

  get: async (seasonId: string): Promise<Season> => {
    const { data } = await api.get(`/seasons/${seasonId}`);
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
