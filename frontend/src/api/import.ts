// frontend/src/api/import.ts
import { api } from './client';

export interface FacilityMatch {
  type: 'exact' | 'fuzzy' | 'none';
  suggestion?: {
    id: string;
    name: string;
  };
  distance?: number;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ImportConflict {
  row: number;
  datetime: string;
  conflicts: Array<{
    blockerId: string;
    blockerName: string;
    reason: string;
  }>;
}

export interface PreviewRow {
  row: number;
  status: 'valid' | 'error';
  parsed?: {
    datetime: string;
    opponent?: string;
    homeAway?: string;
    duration?: number;
    facilityId: string | null;
    facilityName: string | null;
    notes: string | null;
  };
  facilityMatch?: FacilityMatch;
  error?: ValidationError;
}

export interface ImportPreviewResult {
  valid: boolean;
  canImport: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rowsWithConflicts: number;
  errors: ValidationError[];
  conflicts: ImportConflict[];
  preview: PreviewRow[];
}

export interface ImportExecuteResult {
  imported: number;
  conflictsOverridden: number;
  games?: Array<{ id: string; opponent: string; datetime: string }>;
  practices?: Array<{ id: string; datetime: string; durationMinutes: number }>;
}

export interface GameRow {
  row: number;
  date: string;
  time: string;
  opponent: string;
  homeAway: 'HOME' | 'AWAY' | 'NEUTRAL';
  facility: string | null;
  notes: string | null;
}

export interface PracticeRow {
  row: number;
  date: string;
  time: string;
  duration: number;
  facility: string | null;
  notes: string | null;
}

export type ImportRow = GameRow | PracticeRow;

export const importApi = {
  async preview(
    seasonId: string,
    type: 'games' | 'practices',
    rows: ImportRow[]
  ): Promise<ImportPreviewResult> {
    const response = await api.post(`/seasons/${seasonId}/import/preview`, {
      type,
      rows,
    });
    return response.data.data;
  },

  async execute(
    seasonId: string,
    type: 'games' | 'practices',
    rows: ImportRow[],
    options: {
      facilityAssignments?: Record<string, string>;
      overrideConflicts?: boolean;
      overrideReason?: string;
    } = {}
  ): Promise<ImportExecuteResult> {
    const response = await api.post(`/seasons/${seasonId}/import/execute`, {
      type,
      rows,
      ...options,
    });
    return response.data.data;
  },
};
