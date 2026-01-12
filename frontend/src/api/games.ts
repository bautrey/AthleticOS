// frontend/src/api/games.ts
import { api } from './client';

export interface Game {
  id: string;
  seasonId: string;
  facilityId: string | null;
  opponent: string;
  datetime: string;
  homeAway: 'HOME' | 'AWAY' | 'NEUTRAL';
  status: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'POSTPONED' | 'COMPLETED';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGameInput {
  facilityId?: string;
  opponent: string;
  datetime: string;
  homeAway?: Game['homeAway'];
  status?: Game['status'];
  notes?: string;
}

export const gamesApi = {
  list: async (seasonId: string): Promise<Game[]> => {
    const { data } = await api.get(`/seasons/${seasonId}/games`);
    return data.data;
  },

  create: async (seasonId: string, input: CreateGameInput): Promise<Game> => {
    const { data } = await api.post(`/seasons/${seasonId}/games`, input);
    return data.data;
  },

  get: async (gameId: string): Promise<Game> => {
    const { data } = await api.get(`/games/${gameId}`);
    return data.data;
  },

  update: async (gameId: string, input: Partial<CreateGameInput>): Promise<Game> => {
    const { data } = await api.patch(`/games/${gameId}`, input);
    return data.data;
  },

  delete: async (gameId: string): Promise<void> => {
    await api.delete(`/games/${gameId}`);
  },
};
