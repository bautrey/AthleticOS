// backend/src/modules/facilities/service.ts
import { prisma } from '../../common/db.js';
import { NotFoundError } from '../../common/errors.js';
import type { CreateFacilityInput, UpdateFacilityInput } from './schemas.js';

export const facilitiesService = {
  async create(schoolId: string, input: CreateFacilityInput) {
    const facility = await prisma.facility.create({
      data: { ...input, schoolId },
    });
    return facility;
  },

  async findBySchool(schoolId: string) {
    const facilities = await prisma.facility.findMany({
      where: { schoolId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    return facilities;
  },

  async findById(id: string) {
    const facility = await prisma.facility.findUnique({ where: { id } });
    if (!facility) throw new NotFoundError('Facility', id);
    return facility;
  },

  async update(id: string, input: UpdateFacilityInput) {
    await this.findById(id);
    const facility = await prisma.facility.update({ where: { id }, data: input });
    return facility;
  },

  async delete(id: string) {
    await this.findById(id);
    await prisma.facility.delete({ where: { id } });
  },
};
