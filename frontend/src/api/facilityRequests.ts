// frontend/src/api/facilityRequests.ts
import { api } from './client';

export interface FacilityRequest {
  id: string;
  schoolId: string;
  facilityId: string;
  requesterId: string;
  type: 'BOOKING' | 'MAINTENANCE' | 'SETUP' | 'TEARDOWN';
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED';
  title: string;
  description: string | null;
  requestedDate: string;
  startTime: string;
  endTime: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  facility: { id: string; name: string };
  requester: { id: string; email: string; name: string | null };
  reviewer?: { id: string; email: string; name: string | null } | null;
  conflicts?: string[];
}

export interface CreateFacilityRequestInput {
  facilityId: string;
  type?: string;
  title: string;
  description?: string;
  requestedDate: string;
  startTime: string;
  endTime: string;
}

export interface ListRequestsQuery {
  status?: string;
  facilityId?: string;
  page?: number;
  limit?: number;
}

export interface AvailabilityDay {
  date: string;
  slots: Array<{
    startTime: string;
    endTime: string;
    status: 'booked' | 'pending' | 'open';
    label?: string;
  }>;
}

export const facilityRequestsApi = {
  create: async (schoolId: string, input: CreateFacilityRequestInput): Promise<FacilityRequest> => {
    const { data } = await api.post(`/schools/${schoolId}/facility-requests`, input);
    return data.data;
  },

  list: async (schoolId: string, query?: ListRequestsQuery): Promise<{ data: FacilityRequest[]; meta: { page: number; limit: number; total: number; totalPages: number } }> => {
    const params = new URLSearchParams();
    if (query?.status) params.append('status', query.status);
    if (query?.facilityId) params.append('facilityId', query.facilityId);
    if (query?.page) params.append('page', String(query.page));
    if (query?.limit) params.append('limit', String(query.limit));
    const qs = params.toString();
    const { data } = await api.get(`/schools/${schoolId}/facility-requests${qs ? `?${qs}` : ''}`);
    return data;
  },

  updateStatus: async (schoolId: string, requestId: string, input: { status: string; reviewNotes?: string }): Promise<FacilityRequest> => {
    const { data } = await api.patch(`/schools/${schoolId}/facility-requests/${requestId}`, input);
    return data.data;
  },

  getAvailability: async (schoolId: string, facilityId: string, from: string, to: string): Promise<AvailabilityDay[]> => {
    const { data } = await api.get(`/schools/${schoolId}/facilities/${facilityId}/availability?from=${from}&to=${to}`);
    return data.data;
  },

  communityRegister: async (input: { email: string; password: string; name: string; schoolId: string }) => {
    const { data } = await api.post('/auth/community-register', input);
    return data.data;
  },
};
