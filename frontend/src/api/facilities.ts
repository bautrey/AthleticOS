// frontend/src/api/facilities.ts
import { api } from './client';

export interface Facility {
  id: string;
  schoolId: string;
  name: string;
  type: 'GYM' | 'FIELD' | 'POOL' | 'COURT' | 'TRACK' | 'OTHER';
  capacity: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFacilityInput {
  name: string;
  type: Facility['type'];
  capacity?: number;
}

export const facilitiesApi = {
  list: async (schoolId: string): Promise<Facility[]> => {
    const { data } = await api.get(`/schools/${schoolId}/facilities`);
    return data.data;
  },

  create: async (schoolId: string, input: CreateFacilityInput): Promise<Facility> => {
    const { data } = await api.post(`/schools/${schoolId}/facilities`, input);
    return data.data;
  },

  delete: async (schoolId: string, facilityId: string): Promise<void> => {
    await api.delete(`/schools/${schoolId}/facilities/${facilityId}`);
  },
};
