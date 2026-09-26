// frontend/src/api/schools.ts
import { api } from './client';

/** Which measure the school's written heat policy is stated in. */
export type HeatMeasure = 'WBGT' | 'HEAT_INDEX';

export interface WeatherPolicy {
  /** Null means the school has stated no policy, and nothing is raised. */
  thresholdF: number | null;
  measure: HeatMeasure;
  lookaheadDays: number;
  practiceWindow: { start: string; end: string };
}

export interface SchoolSettings extends Record<string, unknown> {
  weather?: Partial<WeatherPolicy>;
}

export interface School {
  id: string;
  name: string;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
  settings: SchoolSettings;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSchoolInput {
  name: string;
  timezone: string;
  latitude?: number | null;
  longitude?: number | null;
  settings?: SchoolSettings;
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

  // PATCH, not PUT: the API registers only PATCH /schools/:id, so every save from
  // this client 404'd.
  update: async (id: string, input: Partial<CreateSchoolInput>): Promise<School> => {
    const { data } = await api.patch(`/schools/${id}`, input);
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/schools/${id}`);
  },
};
