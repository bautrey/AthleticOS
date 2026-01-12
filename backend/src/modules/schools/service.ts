// backend/src/modules/schools/service.ts
import { Prisma } from '@prisma/client';
import { prisma } from '../../common/db.js';
import { NotFoundError } from '../../common/errors.js';
import type { CreateSchoolInput, UpdateSchoolInput } from './schemas.js';

export const schoolsService = {
  async create(input: CreateSchoolInput, userId: string) {
    const school = await prisma.school.create({
      data: {
        name: input.name,
        timezone: input.timezone,
        settings: (input.settings ?? {}) as Prisma.InputJsonValue,
        schoolUsers: {
          create: { userId, role: 'ADMIN' },
        },
      },
    });
    return school;
  },

  async findAll(userId: string) {
    const schools = await prisma.school.findMany({
      where: { schoolUsers: { some: { userId } } },
      orderBy: { name: 'asc' },
    });
    return schools;
  },

  async findById(id: string, userId: string) {
    const school = await prisma.school.findFirst({
      where: { id, schoolUsers: { some: { userId } } },
    });
    if (!school) throw new NotFoundError('School', id);
    return school;
  },

  async update(id: string, input: UpdateSchoolInput, userId: string) {
    await this.findById(id, userId); // Check access
    const school = await prisma.school.update({
      where: { id },
      data: {
        ...input,
        settings: input.settings ? (input.settings as Prisma.InputJsonValue) : undefined,
      },
    });
    return school;
  },

  async delete(id: string, userId: string) {
    await this.findById(id, userId); // Check access
    await prisma.school.delete({ where: { id } });
  },
};
