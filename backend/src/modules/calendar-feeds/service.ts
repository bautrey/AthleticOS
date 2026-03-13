// backend/src/modules/calendar-feeds/service.ts
import { prisma } from '../../common/db.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../common/errors.js';
import type { CreateFeedInput } from './schemas.js';
import type { CalendarFeedType } from '@prisma/client';

// ICS generation helpers (shared pattern from shares/public-routes.ts)
function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export const calendarFeedsService = {
  /**
   * Create a new calendar feed
   */
  async createFeed(userId: string, data: CreateFeedInput) {
    // If TEAM type, validate teamId is provided and user belongs to team's school
    if (data.type === 'TEAM') {
      if (!data.teamId) {
        throw new ValidationError('teamId is required for TEAM feed type');
      }

      const team = await prisma.team.findUnique({
        where: { id: data.teamId },
        select: { schoolId: true },
      });

      if (!team) {
        throw new NotFoundError('Team', data.teamId);
      }

      // Verify user belongs to this school
      const schoolUser = await prisma.schoolUser.findUnique({
        where: { schoolId_userId: { schoolId: team.schoolId, userId } },
      });

      if (!schoolUser) {
        throw new ForbiddenError('You do not belong to this team\'s school');
      }
    }

    const feed = await prisma.calendarFeed.create({
      data: {
        userId,
        type: data.type as CalendarFeedType,
        teamId: data.type === 'TEAM' ? data.teamId : null,
      },
      include: {
        team: { select: { id: true, name: true, sport: true } },
      },
    });

    return feed;
  },

  /**
   * List feeds for a user
   */
  async listFeeds(userId: string) {
    const feeds = await prisma.calendarFeed.findMany({
      where: { userId },
      include: {
        team: { select: { id: true, name: true, sport: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return feeds;
  },

  /**
   * Deactivate a feed (soft delete)
   */
  async deactivateFeed(userId: string, feedId: string) {
    const feed = await prisma.calendarFeed.findUnique({
      where: { id: feedId },
    });

    if (!feed) {
      throw new NotFoundError('CalendarFeed', feedId);
    }

    if (feed.userId !== userId) {
      throw new ForbiddenError('You can only deactivate your own feeds');
    }

    await prisma.calendarFeed.update({
      where: { id: feedId },
      data: { isActive: false },
    });
  },

  /**
   * Get feed by token and generate ICS content
   */
  async getFeedByToken(token: string) {
    const feed = await prisma.calendarFeed.findUnique({
      where: { token },
      include: {
        user: { select: { id: true, email: true, name: true } },
        team: {
          select: {
            id: true,
            name: true,
            sport: true,
            schoolId: true,
          },
        },
      },
    });

    if (!feed || !feed.isActive) {
      throw new NotFoundError('Calendar feed not found or inactive');
    }

    // Update lastAccessed
    await prisma.calendarFeed.update({
      where: { id: feed.id },
      data: { lastAccessed: new Date() },
    });

    return feed;
  },

  /**
   * Generate ICS content for a feed
   */
  async generateICS(token: string): Promise<string> {
    const feed = await this.getFeedByToken(token);

    let games: Array<{
      datetime: Date;
      opponent: string;
      homeAway: string;
      facilityName: string | null;
      status: string;
      teamName: string;
      sport: string;
    }> = [];

    let practices: Array<{
      datetime: Date;
      durationMinutes: number;
      facilityName: string | null;
      teamName: string;
      sport: string;
    }> = [];

    if (feed.type === 'TEAM' && feed.teamId) {
      // Get events for a specific team
      const seasons = await prisma.season.findMany({
        where: { teamId: feed.teamId },
        include: {
          team: { select: { name: true, sport: true } },
          games: {
            where: { status: { not: 'CANCELLED' } },
            include: { facility: { select: { name: true } } },
            orderBy: { datetime: 'asc' },
          },
          practices: {
            include: { facility: { select: { name: true } } },
            orderBy: { datetime: 'asc' },
          },
        },
      });

      for (const season of seasons) {
        for (const game of season.games) {
          games.push({
            datetime: game.datetime,
            opponent: game.opponent,
            homeAway: game.homeAway,
            facilityName: game.facility?.name ?? null,
            status: game.status,
            teamName: season.team.name,
            sport: season.team.sport,
          });
        }
        for (const practice of season.practices) {
          practices.push({
            datetime: practice.datetime,
            durationMinutes: practice.durationMinutes,
            facilityName: practice.facility?.name ?? null,
            teamName: season.team.name,
            sport: season.team.sport,
          });
        }
      }
    } else {
      // USER type: get all events across all schools the user belongs to
      const schoolUsers = await prisma.schoolUser.findMany({
        where: { userId: feed.userId },
        select: { schoolId: true },
      });

      const schoolIds = schoolUsers.map((su) => su.schoolId);

      const seasons = await prisma.season.findMany({
        where: { team: { schoolId: { in: schoolIds } } },
        include: {
          team: { select: { name: true, sport: true } },
          games: {
            where: { status: { not: 'CANCELLED' } },
            include: { facility: { select: { name: true } } },
            orderBy: { datetime: 'asc' },
          },
          practices: {
            include: { facility: { select: { name: true } } },
            orderBy: { datetime: 'asc' },
          },
        },
      });

      for (const season of seasons) {
        for (const game of season.games) {
          games.push({
            datetime: game.datetime,
            opponent: game.opponent,
            homeAway: game.homeAway,
            facilityName: game.facility?.name ?? null,
            status: game.status,
            teamName: season.team.name,
            sport: season.team.sport,
          });
        }
        for (const practice of season.practices) {
          practices.push({
            datetime: practice.datetime,
            durationMinutes: practice.durationMinutes,
            facilityName: practice.facility?.name ?? null,
            teamName: season.team.name,
            sport: season.team.sport,
          });
        }
      }
    }

    // Build ICS
    const calName = feed.type === 'TEAM' && feed.team
      ? `${feed.team.name} ${feed.team.sport} Schedule`
      : 'AthleticOS - All Schedules';

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AthleticOS//CalendarFeed//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escapeICS(calName)}`,
    ];

    for (const game of games) {
      const startDate = game.datetime;
      const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours

      const prefix = game.homeAway === 'HOME'
        ? 'vs'
        : game.homeAway === 'AWAY'
          ? '@'
          : 'vs';
      const suffix = game.homeAway === 'NEUTRAL' ? ' (Neutral)' : '';
      const summary = `${game.teamName} ${game.sport}: ${prefix} ${game.opponent}${suffix}`;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:game-${startDate.getTime()}-${game.opponent.replace(/\s/g, '')}@athleticos.co`);
      lines.push(`DTSTAMP:${formatICSDate(new Date())}`);
      lines.push(`DTSTART:${formatICSDate(startDate)}`);
      lines.push(`DTEND:${formatICSDate(endDate)}`);
      lines.push(`SUMMARY:${escapeICS(summary)}`);
      if (game.facilityName) {
        lines.push(`LOCATION:${escapeICS(game.facilityName)}`);
      }
      lines.push('END:VEVENT');
    }

    for (const practice of practices) {
      const startDate = practice.datetime;
      const endDate = new Date(startDate.getTime() + practice.durationMinutes * 60 * 1000);
      const summary = `${practice.teamName} ${practice.sport}: Practice (${practice.durationMinutes} min)`;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:practice-${startDate.getTime()}-${practice.teamName.replace(/\s/g, '')}@athleticos.co`);
      lines.push(`DTSTAMP:${formatICSDate(new Date())}`);
      lines.push(`DTSTART:${formatICSDate(startDate)}`);
      lines.push(`DTEND:${formatICSDate(endDate)}`);
      lines.push(`SUMMARY:${escapeICS(summary)}`);
      if (practice.facilityName) {
        lines.push(`LOCATION:${escapeICS(practice.facilityName)}`);
      }
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  },
};
