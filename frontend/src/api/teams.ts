// frontend/src/api/teams.ts
import { api } from './client';

export interface Team {
  id: string;
  schoolId: string;
  name: string;
  sport: string;
  level: 'VARSITY' | 'JV' | 'FRESHMAN' | 'MIDDLE_SCHOOL';
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamInput {
  name: string;
  sport: string;
  level: Team['level'];
}

export const teamsApi = {
  list: async (schoolId: string): Promise<Team[]> => {
    const { data } = await api.get(`/schools/${schoolId}/teams`);
    return data.data;
  },

  create: async (schoolId: string, input: CreateTeamInput): Promise<Team> => {
    const { data } = await api.post(`/schools/${schoolId}/teams`, input);
    return data.data;
  },

  update: async (schoolId: string, teamId: string, input: Partial<CreateTeamInput>): Promise<Team> => {
    const { data } = await api.put(`/schools/${schoolId}/teams/${teamId}`, input);
    return data.data;
  },

  delete: async (schoolId: string, teamId: string): Promise<void> => {
    await api.delete(`/schools/${schoolId}/teams/${teamId}`);
  },
};
