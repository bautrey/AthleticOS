// backend/src/modules/import/service.ts
import { prisma } from '../../common/db.js';
import { NotFoundError, ValidationError } from '../../common/errors.js';
import { conflictService } from '../conflicts/service.js';
import type {
  GameRow,
  PracticeRow,
  ImportPreviewInput,
  ImportExecuteInput,
  ImportPreviewResult,
  ImportExecuteResult,
  FacilityMatch,
  ValidationError as ImportValidationError,
  ImportConflict,
  PreviewRow,
} from './schemas.js';

// Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function matchFacility(
  facilityName: string | null,
  facilities: Array<{ id: string; name: string }>
): FacilityMatch {
  if (!facilityName || !facilityName.trim()) {
    return { type: 'none' };
  }

  const normalized = facilityName.toLowerCase().trim();

  // Exact match (case-insensitive)
  const exactMatch = facilities.find(
    (f) => f.name.toLowerCase().trim() === normalized
  );
  if (exactMatch) {
    return {
      type: 'exact',
      suggestion: { id: exactMatch.id, name: exactMatch.name },
    };
  }

  // Fuzzy match (Levenshtein distance <= 2)
  let bestMatch: { facility: typeof facilities[0]; distance: number } | null = null;

  for (const facility of facilities) {
    const distance = levenshteinDistance(
      normalized,
      facility.name.toLowerCase().trim()
    );
    if (distance <= 2 && (!bestMatch || distance < bestMatch.distance)) {
      bestMatch = { facility, distance };
    }
  }

  if (bestMatch) {
    return {
      type: 'fuzzy',
      suggestion: { id: bestMatch.facility.id, name: bestMatch.facility.name },
      distance: bestMatch.distance,
    };
  }

  return { type: 'none' };
}

// Parse date and time into ISO datetime string in UTC (using school timezone)
function parseDateTimeToUTC(
  date: string,
  time: string,
  timezone: string
): string | null {
  try {
    // Combine date and time
    const localDateTime = `${date}T${time}:00`;

    // Create a date in the local timezone and convert to UTC
    // This is a simplified approach - for production, use a library like date-fns-tz
    const dateObj = new Date(localDateTime);

    // For now, store as-is (assumes backend/DB handles timezone)
    // In production, you'd convert using the school's timezone
    if (isNaN(dateObj.getTime())) {
      return null;
    }

    return dateObj.toISOString();
  } catch {
    return null;
  }
}

export const importService = {
  /**
   * Preview an import - validate rows and check for conflicts
   */
  async preview(
    seasonId: string,
    input: ImportPreviewInput
  ): Promise<ImportPreviewResult> {
    // Get season with team and school
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: {
        team: {
          include: { school: true },
        },
      },
    });

    if (!season) {
      throw new NotFoundError('Season', seasonId);
    }

    const schoolId = season.team.schoolId;
    const timezone = season.team.school.timezone || 'America/New_York';

    // Get facilities for matching
    const facilities = await prisma.facility.findMany({
      where: { schoolId },
      select: { id: true, name: true },
    });

    const errors: ImportValidationError[] = [];
    const conflicts: ImportConflict[] = [];
    const preview: PreviewRow[] = [];

    for (const row of input.rows) {
      const rowNum = row.row;

      // Parse datetime
      const datetime = parseDateTimeToUTC(row.date, row.time, timezone);
      if (!datetime) {
        errors.push({
          row: rowNum,
          field: 'date/time',
          message: `Invalid date or time format: '${row.date}' '${row.time}'`,
        });
        preview.push({ row: rowNum, status: 'error' });
        continue;
      }

      // Match facility
      const facilityMatch = matchFacility(row.facility, facilities);
      const facilityId = facilityMatch.suggestion?.id || null;
      const facilityName = facilityMatch.suggestion?.name || null;

      // Type-specific validation
      if (input.type === 'games') {
        const gameRow = row as GameRow;
        if (!gameRow.opponent || !gameRow.opponent.trim()) {
          errors.push({
            row: rowNum,
            field: 'opponent',
            message: 'Opponent is required',
          });
          preview.push({ row: rowNum, status: 'error' });
          continue;
        }

        // Check for conflicts
        const conflictResult = await conflictService.checkEventConflicts({
          datetime: new Date(datetime),
          seasonId,
          facilityId,
        });

        if (conflictResult.hasConflicts) {
          conflicts.push({
            row: rowNum,
            datetime,
            conflicts: conflictResult.conflicts.map((c) => ({
              blockerId: c.blockerId,
              blockerName: c.blockerName,
              reason: c.reason,
            })),
          });
        }

        preview.push({
          row: rowNum,
          status: 'valid',
          parsed: {
            datetime,
            opponent: gameRow.opponent,
            homeAway: gameRow.homeAway,
            facilityId,
            facilityName,
            notes: gameRow.notes,
          },
          facilityMatch,
        });
      } else {
        const practiceRow = row as PracticeRow;
        const duration = practiceRow.duration || 90;

        // Check for conflicts
        const conflictResult = await conflictService.checkEventConflicts({
          datetime: new Date(datetime),
          durationMinutes: duration,
          seasonId,
          facilityId,
        });

        if (conflictResult.hasConflicts) {
          conflicts.push({
            row: rowNum,
            datetime,
            conflicts: conflictResult.conflicts.map((c) => ({
              blockerId: c.blockerId,
              blockerName: c.blockerName,
              reason: c.reason,
            })),
          });
        }

        preview.push({
          row: rowNum,
          status: 'valid',
          parsed: {
            datetime,
            duration,
            facilityId,
            facilityName,
            notes: practiceRow.notes,
          },
          facilityMatch,
        });
      }
    }

    const validRows = preview.filter((p) => p.status === 'valid').length;
    const invalidRows = preview.filter((p) => p.status === 'error').length;

    return {
      valid: errors.length === 0,
      canImport: errors.length === 0, // All-or-nothing
      totalRows: input.rows.length,
      validRows,
      invalidRows,
      rowsWithConflicts: conflicts.length,
      errors,
      conflicts,
      preview,
    };
  },

  /**
   * Execute an import - create games or practices in a transaction
   */
  async execute(
    seasonId: string,
    input: ImportExecuteInput,
    userId: string
  ): Promise<ImportExecuteResult> {
    // First, preview to validate
    const previewResult = await this.preview(seasonId, {
      type: input.type,
      rows: input.rows,
    });

    if (!previewResult.canImport) {
      throw new ValidationError(
        'Cannot import: validation errors exist',
        { errors: previewResult.errors }
      );
    }

    // Get season info
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: { team: { include: { school: true } } },
    });

    if (!season) {
      throw new NotFoundError('Season', seasonId);
    }

    const timezone = season.team.school.timezone || 'America/New_York';

    // Check if conflicts exist and override is provided
    if (previewResult.rowsWithConflicts > 0 && !input.overrideConflicts) {
      throw new ValidationError(
        'Import has conflicts. Set overrideConflicts=true and provide a reason to proceed.',
        { conflicts: previewResult.conflicts }
      );
    }

    // Execute in transaction
    return prisma.$transaction(async (tx) => {
      let conflictsOverridden = 0;

      if (input.type === 'games') {
        const games: Array<{ id: string; opponent: string; datetime: Date }> = [];

        for (const row of input.rows) {
          const gameRow = row as GameRow;
          const datetime = parseDateTimeToUTC(gameRow.date, gameRow.time, timezone);
          if (!datetime) continue;

          // Get facility ID from assignments or preview match
          const facilityId =
            input.facilityAssignments?.[String(row.row)] ||
            previewResult.preview.find((p) => p.row === row.row)?.parsed?.facilityId ||
            null;

          const game = await tx.game.create({
            data: {
              seasonId,
              opponent: gameRow.opponent,
              datetime: new Date(datetime),
              homeAway: gameRow.homeAway,
              facilityId,
              notes: gameRow.notes,
              status: 'SCHEDULED',
            },
          });

          games.push({
            id: game.id,
            opponent: game.opponent,
            datetime: game.datetime,
          });

          // Create conflict override if applicable
          const rowConflicts = previewResult.conflicts.find((c) => c.row === row.row);
          if (rowConflicts && input.overrideConflicts) {
            for (const conflict of rowConflicts.conflicts) {
              await tx.conflictOverride.create({
                data: {
                  schoolId: season.team.schoolId,
                  eventType: 'GAME',
                  eventId: game.id,
                  blockerId: conflict.blockerId,
                  overriddenBy: userId,
                  reason: input.overrideReason || 'Imported with conflicts acknowledged',
                },
              });
              conflictsOverridden++;
            }
          }
        }

        return {
          imported: games.length,
          conflictsOverridden,
          games,
        };
      } else {
        const practices: Array<{ id: string; datetime: Date; durationMinutes: number }> = [];

        for (const row of input.rows) {
          const practiceRow = row as PracticeRow;
          const datetime = parseDateTimeToUTC(practiceRow.date, practiceRow.time, timezone);
          if (!datetime) continue;

          // Get facility ID from assignments or preview match
          const facilityId =
            input.facilityAssignments?.[String(row.row)] ||
            previewResult.preview.find((p) => p.row === row.row)?.parsed?.facilityId ||
            null;

          const practice = await tx.practice.create({
            data: {
              seasonId,
              datetime: new Date(datetime),
              durationMinutes: practiceRow.duration || 90,
              facilityId,
              notes: practiceRow.notes,
            },
          });

          practices.push({
            id: practice.id,
            datetime: practice.datetime,
            durationMinutes: practice.durationMinutes,
          });

          // Create conflict override if applicable
          const rowConflicts = previewResult.conflicts.find((c) => c.row === row.row);
          if (rowConflicts && input.overrideConflicts) {
            for (const conflict of rowConflicts.conflicts) {
              await tx.conflictOverride.create({
                data: {
                  schoolId: season.team.schoolId,
                  eventType: 'PRACTICE',
                  eventId: practice.id,
                  blockerId: conflict.blockerId,
                  overriddenBy: userId,
                  reason: input.overrideReason || 'Imported with conflicts acknowledged',
                },
              });
              conflictsOverridden++;
            }
          }
        }

        return {
          imported: practices.length,
          conflictsOverridden,
          practices,
        };
      }
    });
  },
};
