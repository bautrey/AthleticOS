// backend/src/modules/operations/service.ts
import { prisma } from '../../common/db.js';
import { NotFoundError } from '../../common/errors.js';
import type { CreateTemplateInput, UpdateChecklistInput } from './schemas.js';

interface TemplateItem {
  title: string;
  description?: string;
  assigneeRole?: string;
}

export const operationsService = {
  async createTemplate(schoolId: string, input: CreateTemplateInput) {
    const template = await prisma.operationsTemplate.create({
      data: {
        schoolId,
        name: input.name,
        items: input.items as unknown as any,
      },
    });
    return template;
  },

  async listTemplates(schoolId: string) {
    return prisma.operationsTemplate.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getChecklist(schoolId: string, eventType: string, eventId: string) {
    // 1. Look for existing checklist
    let checklist = await prisma.eventChecklist.findUnique({
      where: { eventType_eventId: { eventType, eventId } },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { assignee: { select: { id: true, email: true, name: true } } },
        },
        template: { select: { id: true, name: true } },
      },
    });

    if (checklist) {
      const total = checklist.items.length;
      const done = checklist.items.filter(i => i.status === 'COMPLETED').length;
      const completionPercent = total > 0 ? Math.round((done / total) * 100) : 0;
      return { ...checklist, completionPercent };
    }

    // 2. Auto-create: find a template for this school
    const template = await prisma.operationsTemplate.findFirst({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });

    if (template) {
      const items = template.items as unknown as TemplateItem[];
      checklist = await prisma.eventChecklist.create({
        data: {
          schoolId,
          eventType,
          eventId,
          templateId: template.id,
          items: {
            create: items.map((item, idx) => ({
              title: item.title,
              description: item.description ?? null,
              sortOrder: idx,
            })),
          },
        },
        include: {
          items: {
            orderBy: { sortOrder: 'asc' },
            include: { assignee: { select: { id: true, email: true, name: true } } },
          },
          template: { select: { id: true, name: true } },
        },
      });

      const total = checklist.items.length;
      const done = checklist.items.filter(i => i.status === 'COMPLETED').length;
      const completionPercent = total > 0 ? Math.round((done / total) * 100) : 0;
      return { ...checklist, completionPercent };
    }

    // No checklist and no template match
    return null;
  },

  async updateChecklist(schoolId: string, eventType: string, eventId: string, input: UpdateChecklistInput) {
    const checklist = await prisma.eventChecklist.findUnique({
      where: { eventType_eventId: { eventType, eventId } },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!checklist || checklist.schoolId !== schoolId) {
      throw new NotFoundError('EventChecklist');
    }

    // Update each referenced item
    for (const update of input.tasks) {
      const item = checklist.items[update.index];
      if (!item) continue;

      const data: Record<string, unknown> = {};
      if (update.status !== undefined) {
        data.status = update.status;
        // Set completedAt when marking as completed
        if (update.status === 'COMPLETED') {
          data.completedAt = new Date();
        } else {
          data.completedAt = null;
        }
      }
      if (update.assigneeId !== undefined) data.assigneeId = update.assigneeId;

      if (Object.keys(data).length > 0) {
        await prisma.checklistItem.update({
          where: { id: item.id },
          data,
        });
      }
    }

    // Return updated checklist
    const updated = await prisma.eventChecklist.findUnique({
      where: { eventType_eventId: { eventType, eventId } },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { assignee: { select: { id: true, email: true, name: true } } },
        },
        template: { select: { id: true, name: true } },
      },
    });

    const total = updated!.items.length;
    const done = updated!.items.filter(i => i.status === 'COMPLETED').length;
    const completionPercent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { ...updated!, completionPercent };
  },

  async getReadiness(schoolId: string, days: number) {
    const now = new Date();
    const endDate = new Date(now.getTime() + days * 86400000);

    // Get upcoming games for this school
    const games = await prisma.game.findMany({
      where: {
        season: { team: { schoolId } },
        datetime: { gte: now, lt: endDate },
      },
      include: {
        facility: { select: { name: true } },
        season: { include: { team: { select: { name: true, sport: true } } } },
      },
      orderBy: { datetime: 'asc' },
    });

    // Get checklists for these games
    const results = await Promise.all(
      games.map(async (game) => {
        // Determine eventType
        const eventType = (game as any).homeAway === 'AWAY' ? 'AWAY_GAME' : 'HOME_GAME';

        const checklist = await prisma.eventChecklist.findUnique({
          where: { eventType_eventId: { eventType, eventId: game.id } },
          include: {
            items: { orderBy: { sortOrder: 'asc' } },
          },
        });

        const total = checklist?.items.length ?? 0;
        const done = checklist?.items.filter(i => i.status === 'COMPLETED').length ?? 0;
        const completionPercent = total > 0 ? Math.round((done / total) * 100) : 0;
        const overdue = checklist?.items.filter(
          i => i.status !== 'COMPLETED' && i.status !== 'SKIPPED' && !i.completedAt
        ).length ?? 0;

        return {
          eventId: game.id,
          eventType,
          datetime: game.datetime,
          teamName: game.season.team.name,
          sport: game.season.team.sport,
          opponent: game.opponent,
          facilityName: game.facility?.name ?? null,
          hasChecklist: !!checklist,
          totalTasks: total,
          completedTasks: done,
          completionPercent,
          overdueTasks: overdue,
        };
      })
    );

    return results;
  },
};
