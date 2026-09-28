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

  /**
   * The file exactly as it arrived.
   *
   * Fetched rather than linked. The route needs a Bearer token, the axios client
   * attaches one through an interceptor, and a plain <a href> navigation does not
   * go through axios - so a link to this URL is a 401 dressed up as a download.
   * Verified: without the header the route answers 401, with it 200.
   */
  download: async (schoolId: string, id: string): Promise<Blob> => {
    const { data } = await api.get(`/schools/${schoolId}/inbound/${id}/download`, {
      responseType: 'blob',
    });
    return data as Blob;
  },
};

/** Hand a fetched blob to the browser as a file. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can race the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
