// frontend/src/utils/csvParser.ts
import Papa from 'papaparse';

export type CsvType = 'games' | 'practices' | 'unknown';

export interface ParsedGameRow {
  row: number;
  date: string;
  time: string;
  opponent: string;
  homeAway: 'HOME' | 'AWAY' | 'NEUTRAL';
  facility: string | null;
  notes: string | null;
}

export interface ParsedPracticeRow {
  row: number;
  date: string;
  time: string;
  duration: number;
  facility: string | null;
  notes: string | null;
}

export interface CsvValidationError {
  row: number;
  field: string;
  message: string;
}

export interface CsvParseResult<T> {
  type: CsvType;
  rows: T[];
  errors: CsvValidationError[];
  isValid: boolean;
}

// Column name variations we accept (case-insensitive)
const GAME_COLUMNS = {
  date: ['date', 'game_date', 'gamedate'],
  time: ['time', 'game_time', 'gametime', 'start_time', 'starttime'],
  opponent: ['opponent', 'vs', 'against', 'team'],
  homeAway: ['home_away', 'homeaway', 'home/away', 'location', 'h/a'],
  facility: ['facility', 'venue', 'location', 'place', 'gym', 'field'],
  notes: ['notes', 'note', 'comments', 'comment', 'description'],
};

const PRACTICE_COLUMNS = {
  date: ['date', 'practice_date', 'practicedate'],
  time: ['time', 'practice_time', 'practicetime', 'start_time', 'starttime'],
  duration: ['duration', 'duration_minutes', 'minutes', 'length', 'time_minutes'],
  facility: ['facility', 'venue', 'location', 'place', 'gym', 'field'],
  notes: ['notes', 'note', 'comments', 'comment', 'description'],
};

function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim().replace(/[\s-]/g, '_');
}

function findColumn(headers: string[], variations: string[]): string | null {
  const normalizedHeaders = headers.map(normalizeColumnName);
  for (const variation of variations) {
    const index = normalizedHeaders.indexOf(variation);
    if (index !== -1) {
      return headers[index];
    }
  }
  return null;
}

function detectCsvType(headers: string[]): CsvType {
  const hasOpponent = findColumn(headers, GAME_COLUMNS.opponent) !== null;
  const hasHomeAway = findColumn(headers, GAME_COLUMNS.homeAway) !== null;
  const hasDuration = findColumn(headers, PRACTICE_COLUMNS.duration) !== null;

  // Games have opponent and home/away, practices have duration
  if (hasOpponent || hasHomeAway) {
    return 'games';
  }
  if (hasDuration) {
    return 'practices';
  }
  // Default to games if we have date and time
  const hasDate = findColumn(headers, GAME_COLUMNS.date) !== null;
  const hasTime = findColumn(headers, GAME_COLUMNS.time) !== null;
  if (hasDate && hasTime) {
    return 'games';
  }
  return 'unknown';
}

function parseDate(value: string): string | null {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();

  // Try YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Try MM/DD/YYYY or M/D/YYYY format
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Try MM-DD-YYYY format
  const dashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, month, day, year] = dashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return null;
}

function parseTime(value: string): string | null {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim().toUpperCase();

  // Try 24-hour format HH:MM
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [hours, minutes] = trimmed.split(':');
    return `${hours.padStart(2, '0')}:${minutes}`;
  }

  // Try 12-hour format with AM/PM
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let [, hours, minutes, period] = ampmMatch;
    let hour = parseInt(hours, 10);
    if (period.toUpperCase() === 'PM' && hour !== 12) {
      hour += 12;
    } else if (period.toUpperCase() === 'AM' && hour === 12) {
      hour = 0;
    }
    return `${hour.toString().padStart(2, '0')}:${minutes}`;
  }

  return null;
}

function parseHomeAway(value: string): 'HOME' | 'AWAY' | 'NEUTRAL' | null {
  if (!value || !value.trim()) return null;
  const normalized = value.trim().toUpperCase();

  if (['HOME', 'H'].includes(normalized)) return 'HOME';
  if (['AWAY', 'A'].includes(normalized)) return 'AWAY';
  if (['NEUTRAL', 'N'].includes(normalized)) return 'NEUTRAL';

  return null;
}

function parseDuration(value: string): number | null {
  if (!value || !value.trim()) return null;
  const num = parseInt(value.trim(), 10);
  if (isNaN(num) || num <= 0 || num > 480) return null; // Max 8 hours
  return num;
}

// Sanitize CSV values to prevent Excel formula injection
function sanitizeValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Strip leading characters that could be interpreted as formulas
  if (/^[=+\-@]/.test(trimmed)) {
    return trimmed.substring(1).trim();
  }
  return trimmed;
}

export function parseGamesCsv(file: File): Promise<CsvParseResult<ParsedGameRow>> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const errors: CsvValidationError[] = [];
        const rows: ParsedGameRow[] = [];

        // Find column mappings
        const dateCol = findColumn(headers, GAME_COLUMNS.date);
        const timeCol = findColumn(headers, GAME_COLUMNS.time);
        const opponentCol = findColumn(headers, GAME_COLUMNS.opponent);
        const homeAwayCol = findColumn(headers, GAME_COLUMNS.homeAway);
        const facilityCol = findColumn(headers, GAME_COLUMNS.facility);
        const notesCol = findColumn(headers, GAME_COLUMNS.notes);

        // Check required columns
        if (!dateCol) {
          errors.push({ row: 0, field: 'date', message: 'Missing required column: date' });
        }
        if (!timeCol) {
          errors.push({ row: 0, field: 'time', message: 'Missing required column: time' });
        }
        if (!opponentCol) {
          errors.push({ row: 0, field: 'opponent', message: 'Missing required column: opponent' });
        }
        if (!homeAwayCol) {
          errors.push({ row: 0, field: 'home_away', message: 'Missing required column: home_away' });
        }

        // Parse rows
        results.data.forEach((rawRow: unknown, index: number) => {
          const row = rawRow as Record<string, string>;
          const rowNum = index + 2; // Account for header row and 1-based indexing

          const date = dateCol ? parseDate(row[dateCol]) : null;
          const time = timeCol ? parseTime(row[timeCol]) : null;
          const opponent = opponentCol ? sanitizeValue(row[opponentCol]) : null;
          const homeAway = homeAwayCol ? parseHomeAway(row[homeAwayCol]) : null;
          const facility = facilityCol ? sanitizeValue(row[facilityCol]) : null;
          const notes = notesCol ? sanitizeValue(row[notesCol]) : null;

          // Validate required fields
          if (!date) {
            errors.push({
              row: rowNum,
              field: 'date',
              message: `Invalid date format: '${row[dateCol || '']}'`,
            });
          }
          if (!time) {
            errors.push({
              row: rowNum,
              field: 'time',
              message: `Invalid time format: '${row[timeCol || '']}'`,
            });
          }
          if (!opponent) {
            errors.push({
              row: rowNum,
              field: 'opponent',
              message: 'Opponent is required',
            });
          }
          if (!homeAway) {
            errors.push({
              row: rowNum,
              field: 'home_away',
              message: `Invalid home/away value: '${row[homeAwayCol || '']}'. Use HOME, AWAY, or NEUTRAL.`,
            });
          }

          rows.push({
            row: rowNum,
            date: date || '',
            time: time || '',
            opponent: opponent || '',
            homeAway: homeAway || 'HOME',
            facility,
            notes,
          });
        });

        resolve({
          type: 'games',
          rows,
          errors,
          isValid: errors.length === 0,
        });
      },
      error: (error) => {
        resolve({
          type: 'games',
          rows: [],
          errors: [{ row: 0, field: 'file', message: `Failed to parse CSV: ${error.message}` }],
          isValid: false,
        });
      },
    });
  });
}

export function parsePracticesCsv(file: File): Promise<CsvParseResult<ParsedPracticeRow>> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const errors: CsvValidationError[] = [];
        const rows: ParsedPracticeRow[] = [];

        // Find column mappings
        const dateCol = findColumn(headers, PRACTICE_COLUMNS.date);
        const timeCol = findColumn(headers, PRACTICE_COLUMNS.time);
        const durationCol = findColumn(headers, PRACTICE_COLUMNS.duration);
        const facilityCol = findColumn(headers, PRACTICE_COLUMNS.facility);
        const notesCol = findColumn(headers, PRACTICE_COLUMNS.notes);

        // Check required columns
        if (!dateCol) {
          errors.push({ row: 0, field: 'date', message: 'Missing required column: date' });
        }
        if (!timeCol) {
          errors.push({ row: 0, field: 'time', message: 'Missing required column: time' });
        }

        // Parse rows
        results.data.forEach((rawRow: unknown, index: number) => {
          const row = rawRow as Record<string, string>;
          const rowNum = index + 2;

          const date = dateCol ? parseDate(row[dateCol]) : null;
          const time = timeCol ? parseTime(row[timeCol]) : null;
          const duration = durationCol ? parseDuration(row[durationCol]) : 90; // Default 90 minutes
          const facility = facilityCol ? sanitizeValue(row[facilityCol]) : null;
          const notes = notesCol ? sanitizeValue(row[notesCol]) : null;

          // Validate required fields
          if (!date) {
            errors.push({
              row: rowNum,
              field: 'date',
              message: `Invalid date format: '${row[dateCol || '']}'`,
            });
          }
          if (!time) {
            errors.push({
              row: rowNum,
              field: 'time',
              message: `Invalid time format: '${row[timeCol || '']}'`,
            });
          }

          rows.push({
            row: rowNum,
            date: date || '',
            time: time || '',
            duration: duration || 90,
            facility,
            notes,
          });
        });

        resolve({
          type: 'practices',
          rows,
          errors,
          isValid: errors.length === 0,
        });
      },
      error: (error) => {
        resolve({
          type: 'practices',
          rows: [],
          errors: [{ row: 0, field: 'file', message: `Failed to parse CSV: ${error.message}` }],
          isValid: false,
        });
      },
    });
  });
}

export function detectAndParseCsv(
  file: File
): Promise<CsvParseResult<ParsedGameRow> | CsvParseResult<ParsedPracticeRow>> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      preview: 1, // Only read header
      complete: async (results) => {
        const headers = results.meta.fields || [];
        const type = detectCsvType(headers);

        if (type === 'games') {
          resolve(await parseGamesCsv(file));
        } else if (type === 'practices') {
          resolve(await parsePracticesCsv(file));
        } else {
          resolve({
            type: 'unknown',
            rows: [],
            errors: [
              {
                row: 0,
                field: 'file',
                message:
                  'Could not detect CSV type. For games, include columns: date, time, opponent, home_away. For practices, include columns: date, time, duration.',
              },
            ],
            isValid: false,
          });
        }
      },
    });
  });
}
