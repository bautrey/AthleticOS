// frontend/src/api/blackbaud.ts
import { api } from './client';

export interface BlackbaudStatus {
  connected: boolean;
  environmentId?: string | null;
  scope?: string | null;
  expiresAt?: string | null;
  connectedAt?: string | null;
}

export interface ExternalApiCall {
  id: string;
  system: string;
  method: string;
  path: string;
  status: number | null;
  errorKind: string | null;
  durationMs: number;
  actingUserId: string | null;
  createdAt: string;
}

export interface ConnectionCheck {
  label: string;
  endpoint: string;
  ok: boolean;
  count?: number;
  sample?: string[];
  error?: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  mode: string;
  ranAt: string;
  checks: ConnectionCheck[];
}

export const blackbaudApi = {
  getStatus: async (schoolId: string): Promise<BlackbaudStatus> => {
    const { data } = await api.get(`/blackbaud/status?schoolId=${encodeURIComponent(schoolId)}`);
    return data.data;
  },

  /**
   * Returns the Blackbaud authorize URL. The browser navigates there and the
   * credential is entered on Blackbaud's own login page, so AthleticOS never
   * receives a username or password.
   */
  getAuthorizeUrl: async (schoolId: string): Promise<string> => {
    const { data } = await api.get(`/blackbaud/connect?schoolId=${encodeURIComponent(schoolId)}`);
    return data.data.authorizeUrl;
  },

  /** Runs real read-only calls and returns what came back. Recorded in the audit trail. */
  testConnection: async (schoolId: string): Promise<ConnectionTestResult> => {
    const { data } = await api.post('/blackbaud/test', { schoolId });
    return data.data;
  },

  disconnect: async (schoolId: string): Promise<void> => {
    await api.post('/blackbaud/disconnect', { schoolId });
  },

  listAuditCalls: async (schoolId: string, limit = 100): Promise<ExternalApiCall[]> => {
    const { data } = await api.get(
      `/blackbaud/audit?schoolId=${encodeURIComponent(schoolId)}&limit=${limit}`
    );
    return data.data;
  },
};
