// backend/src/modules/resources/service.ts
import { prisma } from '../../common/db.js';
import { NotFoundError } from '../../common/errors.js';
import type { CreateResourceInput, UpdateResourceInput } from './schemas.js';

export const resourcesService = {
  async list(schoolId: string) {
    return prisma.resource.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
      include: { events: { include: { game: true, practice: true } } },
    });
  },

  async create(schoolId: string, input: CreateResourceInput) {
    return prisma.resource.create({
      data: { ...input, schoolId, metadata: input.metadata ?? {} },
    });
  },

  async update(id: string, input: UpdateResourceInput) {
    const existing = await prisma.resource.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Resource', id);
    return prisma.resource.update({ where: { id }, data: input });
  },

  async delete(id: string) {
    const existing = await prisma.resource.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Resource', id);
    await prisma.resource.delete({ where: { id } });
  },

  async assignToEvent(resourceId: string, eventType: 'GAME' | 'PRACTICE', eventId: string) {
    const data: Record<string, unknown> = {
      resourceId,
      eventType,
    };
    if (eventType === 'GAME') data.gameId = eventId;
    else data.practiceId = eventId;

    return prisma.eventResource.create({ data: data as any });
  },

  async removeFromEvent(resourceId: string, eventType: 'GAME' | 'PRACTICE', eventId: string) {
    const where: Record<string, unknown> = { resourceId, eventType };
    if (eventType === 'GAME') where.gameId = eventId;
    else where.practiceId = eventId;

    const record = await prisma.eventResource.findFirst({ where: where as any });
    if (!record) throw new NotFoundError('EventResource');
    await prisma.eventResource.delete({ where: { id: record.id } });
  },
};
