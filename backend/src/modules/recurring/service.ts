// backend/src/modules/recurring/service.ts
import { prisma } from '../../common/db.js';
import { NotFoundError, ValidationError } from '../../common/errors.js';
import type { CreateRecurringInput, UpdateRecurringInput, DayOfWeek } from './schemas.js';

const DAY_MAP: Record<DayOfWeek, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

interface GeneratedDate {
  date: Date;
  dayOfWeek: DayOfWeek;
  status: 'ok' | 'excluded';
  reason?: string;
}

interface RecurringPreview {
  dates: GeneratedDate[];
  totalGenerated: number;
  totalExcluded: number;
  totalOk: number;
}

function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
}

function calculateDurationMinutes(startTime: string, endTime: string): number {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  return (end.hours * 60 + end.minutes) - (start.hours * 60 + start.minutes);
}

export const recurringService = {
  /**
   * Generate all dates matching selected days of week within a season's date range.
   */
  async generateDates(seasonId: string, days: DayOfWeek[]): Promise<Date[]> {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { startDate: true, endDate: true },
    });
    if (!season) throw new NotFoundError('Season', seasonId);

    const targetDays = new Set(days.map(d => DAY_MAP[d]));
    const dates: Date[] = [];
    const current = new Date(season.startDate);
    const end = new Date(season.endDate);

    // Normalize to start of day in UTC
    current.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);

    while (current <= end) {
      if (targetDays.has(current.getUTCDay())) {
        dates.push(new Date(current));
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
  },

  /**
   * Check each date against school blockers and mark excluded ones.
   */
  async excludeBlockerDates(
    schoolId: string,
    dates: Date[],
    startTime: string,
    endTime: string,
  ): Promise<GeneratedDate[]> {
    if (dates.length === 0) return [];

    const start = parseTime(startTime);
    const end = parseTime(endTime);

    // Get all school-wide blockers that overlap the date range
    const minDate = new Date(dates[0]);
    const maxDate = new Date(dates[dates.length - 1]);
    minDate.setUTCHours(0, 0, 0, 0);
    maxDate.setUTCHours(23, 59, 59, 999);

    const blockers = await prisma.blocker.findMany({
      where: {
        schoolId,
        startDatetime: { lte: maxDate },
        endDatetime: { gte: minDate },
      },
    });

    const dayNames: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    return dates.map(date => {
      const dayOfWeek = dayNames[date.getUTCDay()];

      // Create datetime range for this practice occurrence
      const practiceStart = new Date(date);
      practiceStart.setUTCHours(start.hours, start.minutes, 0, 0);
      const practiceEnd = new Date(date);
      practiceEnd.setUTCHours(end.hours, end.minutes, 0, 0);

      // Check if any blocker overlaps this practice time
      const overlappingBlocker = blockers.find(b => {
        return b.startDatetime < practiceEnd && b.endDatetime > practiceStart;
      });

      if (overlappingBlocker) {
        return {
          date,
          dayOfWeek,
          status: 'excluded' as const,
          reason: `Blocked: ${overlappingBlocker.name}`,
        };
      }

      return { date, dayOfWeek, status: 'ok' as const };
    });
  },

  /**
   * Create a recurring practice series (or preview if dryRun).
   */
  async createRecurringSeries(
    schoolId: string,
    input: CreateRecurringInput,
  ): Promise<RecurringPreview & { practices?: { id: string; datetime: Date }[] }> {
    const { seasonId, facilityId, days, startTime, endTime, notes, excludeBlockers, dryRun } = input;

    // Validate season belongs to school
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: { team: true },
    });
    if (!season) throw new NotFoundError('Season', seasonId);
    if (season.team.schoolId !== schoolId) {
      throw new ValidationError('Season does not belong to this school');
    }

    const duration = calculateDurationMinutes(startTime, endTime);
    if (duration <= 0) {
      throw new ValidationError('End time must be after start time');
    }

    // Generate candidate dates
    const rawDates = await this.generateDates(seasonId, days);

    // Filter against blockers if requested
    let generatedDates: GeneratedDate[];
    if (excludeBlockers) {
      generatedDates = await this.excludeBlockerDates(schoolId, rawDates, startTime, endTime);
    } else {
      const dayNames: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      generatedDates = rawDates.map(date => ({
        date,
        dayOfWeek: dayNames[date.getUTCDay()],
        status: 'ok' as const,
      }));
    }

    const okDates = generatedDates.filter(d => d.status === 'ok');
    const excludedDates = generatedDates.filter(d => d.status === 'excluded');

    const preview: RecurringPreview = {
      dates: generatedDates,
      totalGenerated: generatedDates.length,
      totalExcluded: excludedDates.length,
      totalOk: okDates.length,
    };

    if (dryRun) {
      return preview;
    }

    // Create practices with shared recurrenceGroupId
    const groupId = crypto.randomUUID();
    const startParsed = parseTime(startTime);

    const practices = await prisma.$transaction(
      okDates.map(d => {
        const datetime = new Date(d.date);
        datetime.setUTCHours(startParsed.hours, startParsed.minutes, 0, 0);

        return prisma.practice.create({
          data: {
            seasonId,
            facilityId: facilityId || null,
            datetime,
            durationMinutes: duration,
            notes: notes || null,
            recurrenceGroupId: groupId,
          },
        });
      }),
    );

    return {
      ...preview,
      practices: practices.map(p => ({ id: p.id, datetime: p.datetime })),
    };
  },

  /**
   * Update future practices in a recurrence group.
   */
  async updateSeries(
    schoolId: string,
    groupId: string,
    input: UpdateRecurringInput,
  ) {
    // Verify the group exists and belongs to this school
    const practices = await prisma.practice.findMany({
      where: { recurrenceGroupId: groupId },
      include: { season: { include: { team: true } } },
    });

    if (practices.length === 0) {
      throw new NotFoundError('Recurrence group', groupId);
    }

    // Verify school ownership
    const belongsToSchool = practices.every(p => p.season.team.schoolId === schoolId);
    if (!belongsToSchool) {
      throw new ValidationError('Recurrence group does not belong to this school');
    }

    const now = new Date();
    const futurePracticeIds = practices
      .filter(p => p.datetime > now)
      .map(p => p.id);

    if (futurePracticeIds.length === 0) {
      return { updated: 0 };
    }

    const updateData: Record<string, unknown> = {};
    if (input.facilityId !== undefined) updateData.facilityId = input.facilityId || null;
    if (input.notes !== undefined) updateData.notes = input.notes || null;

    // If times changed, update datetime and duration for each future practice
    if (input.startTime || input.endTime) {
      // Need to update each practice individually to preserve date
      const existingSample = practices.find(p => futurePracticeIds.includes(p.id));
      if (!existingSample) return { updated: 0 };

      const currentStart = existingSample.datetime;
      const currentHours = currentStart.getUTCHours();
      const currentMinutes = currentStart.getUTCMinutes();

      const newStartTime = input.startTime
        ? parseTime(input.startTime)
        : { hours: currentHours, minutes: currentMinutes };

      const currentEndMinutes = currentHours * 60 + currentMinutes + existingSample.durationMinutes;
      const currentEndHours = Math.floor(currentEndMinutes / 60);
      const currentEndMins = currentEndMinutes % 60;

      const newEndTime = input.endTime
        ? parseTime(input.endTime)
        : { hours: currentEndHours, minutes: currentEndMins };

      const newDuration = (newEndTime.hours * 60 + newEndTime.minutes) - (newStartTime.hours * 60 + newStartTime.minutes);
      if (newDuration <= 0) {
        throw new ValidationError('End time must be after start time');
      }

      const futurePractices = practices.filter(p => futurePracticeIds.includes(p.id));

      await prisma.$transaction(
        futurePractices.map(p => {
          const newDatetime = new Date(p.datetime);
          newDatetime.setUTCHours(newStartTime.hours, newStartTime.minutes, 0, 0);

          return prisma.practice.update({
            where: { id: p.id },
            data: {
              ...updateData,
              datetime: newDatetime,
              durationMinutes: newDuration,
            },
          });
        }),
      );

      return { updated: futurePracticeIds.length };
    }

    // Simple bulk update (no time change)
    if (Object.keys(updateData).length > 0) {
      await prisma.practice.updateMany({
        where: { id: { in: futurePracticeIds } },
        data: updateData,
      });
    }

    return { updated: futurePracticeIds.length };
  },

  /**
   * Delete future practices in a recurrence group.
   */
  async deleteSeries(schoolId: string, groupId: string) {
    const practices = await prisma.practice.findMany({
      where: { recurrenceGroupId: groupId },
      include: { season: { include: { team: true } } },
    });

    if (practices.length === 0) {
      throw new NotFoundError('Recurrence group', groupId);
    }

    const belongsToSchool = practices.every(p => p.season.team.schoolId === schoolId);
    if (!belongsToSchool) {
      throw new ValidationError('Recurrence group does not belong to this school');
    }

    const now = new Date();
    const futurePracticeIds = practices
      .filter(p => p.datetime > now)
      .map(p => p.id);

    if (futurePracticeIds.length === 0) {
      return { deleted: 0 };
    }

    await prisma.practice.deleteMany({
      where: { id: { in: futurePracticeIds } },
    });

    return { deleted: futurePracticeIds.length };
  },
};
