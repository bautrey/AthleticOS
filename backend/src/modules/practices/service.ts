// backend/src/modules/practices/service.ts
import { prisma } from '../../common/db.js';
import { NotFoundError } from '../../common/errors.js';
import type { CreatePracticeInput, UpdatePracticeInput } from './schemas.js';

export const practicesService = {
  async create(seasonId: string, input: CreatePracticeInput) {
    const practice = await prisma.practice.create({
      data: {
        ...input,
        seasonId,
        datetime: new Date(input.datetime),
      },
    });
    return practice;
  },

  async findBySeason(seasonId: string) {
    const practices = await prisma.practice.findMany({
      where: { seasonId },
      orderBy: { datetime: 'asc' },
      include: { facility: true },
    });
    return practices;
  },

  async findById(id: string) {
    const practice = await prisma.practice.findUnique({
      where: { id },
      include: { facility: true },
    });
    if (!practice) throw new NotFoundError('Practice', id);
    return practice;
  },

  async update(id: string, input: UpdatePracticeInput) {
    await this.findById(id);
    const data: Record<string, unknown> = { ...input };
    if (input.datetime) data.datetime = new Date(input.datetime);
    const practice = await prisma.practice.update({
      where: { id },
      data,
      include: { facility: true },
    });
    return practice;
  },

  async delete(id: string) {
    await this.findById(id);
    await prisma.practice.delete({ where: { id } });
  },
};
