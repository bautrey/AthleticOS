// frontend/src/api/shares.ts
import { api } from './client';

export interface Share {
  id: string;
  token: string;
  url: string;
  embedCode: string;
  title: string | null;
  showNotes: boolean;
  showFacility: boolean;
  isActive: boolean;
  expiresAt: string | null;
  viewCount: number;
  createdAt: string;
}

export interface CreateShareInput {
  title?: string;
  showNotes?: boolean;
  showFacility?: boolean;
  expiresAt?: string | null;
}

export interface UpdateShareInput {
  title?: string;
  showNotes?: boolean;
  showFacility?: boolean;
  isActive?: boolean;
  expiresAt?: string | null;
}

export const sharesApi = {
  async list(seasonId: string): Promise<Share[]> {
    const response = await api.get(`/seasons/${seasonId}/shares`);
    return response.data.data;
  },

  async create(seasonId: string, input: CreateShareInput): Promise<Share> {
    const response = await api.post(`/seasons/${seasonId}/shares`, input);
    return response.data.data;
  },

  async get(seasonId: string, shareId: string): Promise<Share> {
    const response = await api.get(`/seasons/${seasonId}/shares/${shareId}`);
    return response.data.data;
  },

  async update(seasonId: string, shareId: string, input: UpdateShareInput): Promise<Share> {
    const response = await api.patch(`/seasons/${seasonId}/shares/${shareId}`, input);
    return response.data.data;
  },

  async delete(seasonId: string, shareId: string): Promise<void> {
    await api.delete(`/seasons/${seasonId}/shares/${shareId}`);
  },
};
