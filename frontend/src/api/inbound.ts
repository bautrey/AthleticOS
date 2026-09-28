// frontend/src/api/inbound.ts
//
// Scheduled reports that arrive by email and wait for someone to approve them.

import { api } from './client';

export type InboundImportStatus =
  | 'RECEIVED'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'FAILED';

/** What the parser made of a file, shown before anyone decides about it. */
export interface ParseSummary {
  kind: 'SCHOOLDUDE_CALENDAR' | 'UNRECOGNISED';
  events: number;
  skipped: number;
  bookings: number;
  conflicts: number;
  dateRange: { from: string; to: string } | null;
  rooms: string[];
}

export interface InboundImport {
  id: string;
  schoolId: string;
  source: 'EMAIL' | 'UPLOAD';
  fromAddress: string;
  subject: string | null;
  filename: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  status: InboundImportStatus;
  parseSummary: ParseSummary | null;
  failureReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

export interface InboundAddress {
  address: string;
  token: string;
}

export interface InboundPage {
  data: InboundImport[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export const inboundApi = {
  /** The school's import address. Minted on the first ask. */
  getAddress: async (schoolId: string): Promise<InboundAddress> => {
    const { data } = await api.get(`/schools/${schoolId}/inbound/address`);
    return data.data;
  },

  /** Replace it. The old address stops working immediately. */
  rotateAddress: async (schoolId: string): Promise<InboundAddress> => {
    const { data } = await api.post(`/schools/${schoolId}/inbound/address/rotate`);
    return data.data;
  },

  list: async (
    schoolId: string,
    params: { status?: InboundImportStatus; page?: number; limit?: number } = {}
  ): Promise<InboundPage> => {
    const { data } = await api.get(`/schools/${schoolId}/inbound`, { params });
    return data;
  },

  approve: async (schoolId: string, id: string): Promise<InboundImport> => {
    const { data } = await api.post(`/schools/${schoolId}/inbound/${id}/approve`);
    return data.data;
  },

  reject: async (schoolId: string, id: string, notes?: string): Promise<InboundImport> => {
    const { data } = await api.post(`/schools/${schoolId}/inbound/${id}/reject`, { notes });
    return data.data;
  },

  /** Where to fetch the file exactly as it arrived. */
  downloadUrl: (schoolId: string, id: string): string =>
    `${api.defaults.baseURL}/schools/${schoolId}/inbound/${id}/download`,
};
