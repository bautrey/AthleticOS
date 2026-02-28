// backend/src/modules/events/service.ts
import { prisma } from '../../common/db.js';
import { conflictService } from '../conflicts/service.js';

export const eventsService = {
  async getUpcoming(schoolId: string, from: Date, to: Date) {
    // Get all seasons for this school
    const seasons = await prisma.season.findMany({
      where: { team: { schoolId } },
      include: { team: true },
    });

    const seasonIds = seasons.map(s => s.id);

    const [games, practices] = await Promise.all([
      prisma.game.findMany({
        where: { seasonId: { in: seasonIds }, datetime: { gte: from, lte: to } },
        include: { season: { include: { team: true } }, facility: true },
        orderBy: { datetime: 'asc' },
      }),
      prisma.practice.findMany({
        where: { seasonId: { in: seasonIds }, datetime: { gte: from, lte: to } },
        include: { season: { include: { team: true } }, facility: true },
        orderBy: { datetime: 'asc' },
      }),
    ]);

    // Merge and sort by datetime
    const events = [
      ...games.map(g => ({
        type: 'game' as const,
        id: g.id,
        datetime: g.datetime,
        teamName: g.season.team.name,
        teamLevel: g.season.team.level,
        opponent: g.opponent,
        facilityName: g.facility?.name ?? null,
        homeAway: (g as any).homeAway as string,
        seasonId: g.seasonId,
      })),
      ...practices.map(p => ({
        type: 'practice' as const,
        id: p.id,
        datetime: p.datetime,
        teamName: p.season.team.name,
        teamLevel: p.season.team.level,
        facilityName: p.facility?.name ?? null,
        seasonId: p.seasonId,
      })),
    ].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

    // Check conflicts for each event
    const eventsWithConflicts = await Promise.all(
      events.map(async (event) => {
        try {
          const result = await conflictService.checkEventConflicts({
            datetime: new Date(event.datetime),
            seasonId: event.seasonId,
            facilityId: undefined,
          });
          return { ...event, hasConflicts: result.hasConflicts, conflictCount: result.conflicts.length };
        } catch {
          return { ...event, hasConflicts: false, conflictCount: 0 };
        }
      })
    );

    return eventsWithConflicts;
  },
};
