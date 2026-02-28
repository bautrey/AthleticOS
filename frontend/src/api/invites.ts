// frontend/src/api/invites.ts
import { api } from './client';

export interface Invite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  inviter: { email: string };
}

export interface InviteDetails {
  id: string;
  email: string;
  role: string;
  schoolName: string;
  schoolId: string;
  inviterEmail: string;
  expiresAt: string;
  acceptedAt: string | null;
}

export interface SchoolMember {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: string;
  joinedAt: string;
}

export const invitesApi = {
  async list(schoolId: string): Promise<Invite[]> {
    const { data } = await api.get(`/schools/${schoolId}/invites`);
    return data.data;
  },

  async create(schoolId: string, email: string, role: string): Promise<Invite> {
    const { data } = await api.post(`/schools/${schoolId}/invites`, { email, role });
    return data.data;
  },

  async revoke(schoolId: string, inviteId: string): Promise<void> {
    await api.delete(`/schools/${schoolId}/invites/${inviteId}`);
  },

  async getByToken(token: string): Promise<InviteDetails> {
    const { data } = await api.get(`/invites/${token}`);
    return data.data;
  },

  async accept(token: string): Promise<{ schoolId: string; schoolName: string }> {
    const { data } = await api.post(`/invites/${token}/accept`);
    return data.data;
  },

  async listMembers(schoolId: string): Promise<SchoolMember[]> {
    const { data } = await api.get(`/schools/${schoolId}/members`);
    return data.data;
  },
};
