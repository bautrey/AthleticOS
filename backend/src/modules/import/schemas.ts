// backend/src/modules/import/schemas.ts
import { z } from 'zod';

// Row schemas matching frontend CSV parser output
export const gameRowSchema = z.object({
  row: z.number(),
  date: z.string(),
  time: z.string(),
  opponent: z.string(),
  homeAway: z.enum(['HOME', 'AWAY', 'NEUTRAL']),
  facility: z.string().nullable(),
  notes: z.string().nullable(),
});

export const practiceRowSchema = z.object({
  row: z.number(),
  date: z.string(),
  time: z.string(),
  duration: z.number().default(90),
  facility: z.string().nullable(),
  notes: z.string().nullable(),
});

// Preview request
export const importPreviewSchema = z.object({
  type: z.enum(['games', 'practices']),
  rows: z.array(z.union([gameRowSchema, practiceRowSchema])),
});

// Execute request
export const importExecuteSchema = z.object({
  type: z.enum(['games', 'practices']),
  rows: z.array(z.union([gameRowSchema, practiceRowSchema])),
  facilityAssignments: z.record(z.string(), z.string()).optional(), // row number -> facility ID
  overrideConflicts: z.boolean().default(false),
  overrideReason: z.string().optional(),
});

export type GameRow = z.infer<typeof gameRowSchema>;
export type PracticeRow = z.infer<typeof practiceRowSchema>;
export type ImportPreviewInput = z.infer<typeof importPreviewSchema>;
export type ImportExecuteInput = z.infer<typeof importExecuteSchema>;

// Response types
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
  games?: Array<{ id: string; opponent: string; datetime: Date }>;
  practices?: Array<{ id: string; datetime: Date; durationMinutes: number }>;
}
