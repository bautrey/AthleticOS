// frontend/src/api/schools.ts
import { api } from './client';

export interface School {
  id: string;
  name: string;
  timezone: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSchoolInput {
  name: string;
  timezone: string;
  settings?: Record<string, unknown>;
}

export const schoolsApi = {
  list: async (): Promise<School[]> => {
    const { data } = await api.get('/schools');
    return data.data;
  },

  get: async (id: string): Promise<School> => {
    const { data } = await api.get(`/schools/${id}`);
    return data.data;
  },

  create: async (input: CreateSchoolInput): Promise<School> => {
    const { data } = await api.post('/schools', input);
    return data.data;
  },

  update: async (id: string, input: Partial<CreateSchoolInput>): Promise<School> => {
    const { data } = await api.put(`/schools/${id}`, input);
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/schools/${id}`);
  },
};
