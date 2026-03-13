// frontend/src/api/notifications.ts
import { api } from './client';

export interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  digestMode: boolean;
  digestTime: string | null;
  phone: string | null;
  preferences: NotificationPreference[];
}

export interface NotificationPreference {
  id: string;
  userId: string;
  schoolId: string;
  channel: string;
  trigger: string;
  enabled: boolean;
  quietStart: string | null;
  quietEnd: string | null;
  digestEnabled: boolean;
}

export interface UpdatePreferencesInput {
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  digestMode?: boolean;
  digestTime?: string | null;
  phone?: string | null;
}

export interface NotificationLog {
  id: string;
  schoolId: string;
  userId: string;
  channel: string;
  trigger: string;
  status: string;
  subject: string;
  body: string;
  sentAt: string | null;
  failedAt: string | null;
  failReason: string | null;
  retryCount: number;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
}

export interface NotificationLogResponse {
  data: NotificationLog[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface NotificationLogQuery {
  page?: number;
  limit?: number;
  channel?: string;
  status?: string;
  from?: string;
  to?: string;
}

export const notificationsApi = {
  getPreferences: async (): Promise<NotificationPreferences> => {
    const { data } = await api.get('/notifications/preferences');
    return data.data;
  },

  updatePreferences: async (input: UpdatePreferencesInput): Promise<NotificationPreferences> => {
    const { data } = await api.put('/notifications/preferences', input);
    return data.data;
  },

  getNotificationLog: async (schoolId: string, query?: NotificationLogQuery): Promise<NotificationLogResponse> => {
    const { data } = await api.get(`/schools/${schoolId}/notifications`, { params: query });
    return data;
  },

  sendTestNotification: async (schoolId: string, channel: 'EMAIL' | 'SMS'): Promise<void> => {
    await api.post(`/schools/${schoolId}/notifications/test`, { channel });
  },

  smsOptOut: async (token: string): Promise<void> => {
    await api.post('/notifications/sms-opt-out', { token });
  },
};
