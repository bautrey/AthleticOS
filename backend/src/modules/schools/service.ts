// backend/src/modules/schools/service.ts
import { Prisma } from '@prisma/client';
import { prisma } from '../../common/db.js';
import { NotFoundError } from '../../common/errors.js';
import type { CreateSchoolInput, UpdateSchoolInput } from './schemas.js';

/**
 * What a school looks like over the API.
 *
 * Enumerated rather than selected by omission, because the default is every
 * column and a new one is then exposed the moment it is added. `inboundToken` is
 * exactly that: it is the bearer credential for the school's import mailbox, and
 * returning the whole row handed it to every COACH, PARENT and ATHLETE through
 * an ordinary GET while the endpoint that exists to reveal it is gated to
 * MANAGEMENT. `weatherGridpoint` is left out for the same reason it is not
 * settable - it is a cache, not a property of the school.
 */
const schoolFields = {
  id: true,
  name: true,
  timezone: true,
  settings: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SchoolSelect;

export const schoolsService = {
  async create(input: CreateSchoolInput, userId: string) {
    const school = await prisma.school.create({
      select: schoolFields,
      data: {
        name: input.name,
        timezone: input.timezone,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
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
      select: schoolFields,
    });
    return schools;
  },

  async findById(id: string, userId: string) {
    const school = await prisma.school.findFirst({
      where: { id, schoolUsers: { some: { userId } } },
      select: schoolFields,
    });
    if (!school) throw new NotFoundError('School', id);
    return school;
  },

  async update(id: string, input: UpdateSchoolInput, userId: string) {
    await this.findById(id, userId); // Check access
    const school = await prisma.school.update({
      where: { id },
      select: schoolFields,
      data: {
        ...input,
        settings: input.settings ? (input.settings as Prisma.InputJsonValue) : undefined,
        // Coordinates and the cached gridpoint travel together: a school that moves
        // keeps NWS's answer for where it used to be until the next lookup.
        weatherGridpoint:
          input.latitude !== undefined || input.longitude !== undefined ? null : undefined,
      },
    });
    return school;
  },

  async delete(id: string, userId: string) {
    await this.findById(id, userId); // Check access
    await prisma.school.delete({ where: { id } });
  },
};
