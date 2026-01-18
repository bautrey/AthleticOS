// frontend/src/api/blockers.ts
import { api } from './client';

export type BlockerType = 'EXAM' | 'MAINTENANCE' | 'EVENT' | 'TRAVEL' | 'HOLIDAY' | 'WEATHER' | 'CUSTOM';
export type BlockerScope = 'SCHOOL_WIDE' | 'TEAM' | 'FACILITY';

export interface Blocker {
  id: string;
  schoolId: string;
  type: BlockerType;
  name: string;
  description: string | null;
  scope: BlockerScope;
  teamId: string | null;
  facilityId: string | null;
  startDatetime: string;
  endDatetime: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateBlockerInput {
  type: BlockerType;
  name: string;
  description?: string | null;
  scope: BlockerScope;
  teamId?: string | null;
  facilityId?: string | null;
  startDatetime: string;
  endDatetime: string;
}

export interface UpdateBlockerInput {
  type?: BlockerType;
  name?: string;
  description?: string | null;
  scope?: BlockerScope;
  teamId?: string | null;
  facilityId?: string | null;
  startDatetime?: string;
  endDatetime?: string;
}

export interface BlockerQuery {
  from?: string;
  to?: string;
  scope?: BlockerScope;
  type?: BlockerType;
  teamId?: string;
  facilityId?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedBlockersResponse {
  data: Blocker[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ConflictingEvents {
  games: number;
  practices: number;
  total: number;
}

export interface BlockerWithConflicts {
  data: Blocker;
  meta: {
    conflictingEvents: ConflictingEvents;
  };
}

export const blockersApi = {
  list: async (schoolId: string, query?: Partial<BlockerQuery>): Promise<PaginatedBlockersResponse> => {
    const params = new URLSearchParams();
    if (query) {
      if (query.from) params.append('from', query.from);
      if (query.to) params.append('to', query.to);
      if (query.scope) params.append('scope', query.scope);
      if (query.type) params.append('type', query.type);
      if (query.teamId) params.append('teamId', query.teamId);
      if (query.facilityId) params.append('facilityId', query.facilityId);
      if (query.page) params.append('page', String(query.page));
      if (query.limit) params.append('limit', String(query.limit));
    }
    const queryString = params.toString();
    const url = `/schools/${schoolId}/blockers${queryString ? `?${queryString}` : ''}`;
    const { data } = await api.get(url);
    return data;
  },

  getById: async (schoolId: string, id: string): Promise<Blocker> => {
    const { data } = await api.get(`/schools/${schoolId}/blockers/${id}`);
    return data.data;
  },

  create: async (schoolId: string, input: CreateBlockerInput): Promise<BlockerWithConflicts> => {
    const { data } = await api.post(`/schools/${schoolId}/blockers`, input);
    return data;
  },

  update: async (schoolId: string, id: string, input: UpdateBlockerInput): Promise<BlockerWithConflicts> => {
    const { data } = await api.patch(`/schools/${schoolId}/blockers/${id}`, input);
    return data;
  },

  delete: async (schoolId: string, id: string): Promise<void> => {
    await api.delete(`/schools/${schoolId}/blockers/${id}`);
  },
};
