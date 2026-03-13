// backend/src/modules/quick-add/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole, STAFF } from '../../common/middleware/auth.js';
import { quickAddSchema } from './schemas.js';
import { parseQuickAdd } from './parser.js';
import { prisma } from '../../common/db.js';
import { conflictService } from '../conflicts/service.js';

export async function quickAddRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Parse quick-add text and return preview (does NOT save)
  app.post('/schools/:schoolId/quick-add', {
    preHandler: [requireRole(...STAFF)],
  }, async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const input = quickAddSchema.parse(request.body);

    // Gather context: facilities and teams with active seasons
    const [facilities, seasons] = await Promise.all([
      prisma.facility.findMany({
        where: { schoolId },
        select: { id: true, name: true },
      }),
      prisma.season.findMany({
        where: { team: { schoolId } },
        include: { team: { select: { id: true, name: true, sport: true } } },
      }),
    ]);

    // Build team refs with seasonId
    const teams = seasons.map(s => ({
      id: s.team.id,
      name: s.team.name,
      sport: s.team.sport,
      seasonId: input.seasonId || s.id,
    }));

    // Parse the text
    const parsed = parseQuickAdd(input.text, {
      facilities,
      teams,
      weekStartDate: input.weekStartDate,
    });

    // If we have enough data, check for conflicts
    let conflicts: { hasConflicts: boolean; conflicts: unknown[] } = { hasConflicts: false, conflicts: [] };

    if (parsed.datetime && parsed.seasonId) {
      try {
        conflicts = await conflictService.checkEventConflicts({
          datetime: new Date(parsed.datetime),
          durationMinutes: parsed.durationMinutes ?? undefined,
          seasonId: parsed.seasonId,
          facilityId: parsed.facilityId,
        });
      } catch {
        // Conflict check failed, continue without it
      }
    }

    return {
      data: {
        parsed,
        conflicts,
      },
    };
  });
}
