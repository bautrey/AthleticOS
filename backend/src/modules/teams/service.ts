// backend/src/modules/teams/service.ts
import { prisma } from '../../common/db.js';
import { NotFoundError } from '../../common/errors.js';
import type { CreateTeamInput, UpdateTeamInput } from './schemas.js';

export const teamsService = {
  async create(schoolId: string, input: CreateTeamInput) {
    const team = await prisma.team.create({
      data: { ...input, schoolId },
    });
    return team;
  },

  async findBySchool(schoolId: string) {
    const teams = await prisma.team.findMany({
      where: { schoolId },
      orderBy: [{ sport: 'asc' }, { level: 'asc' }, { name: 'asc' }],
    });
    return teams;
  },

  async findById(id: string) {
    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundError('Team', id);
    return team;
  },

  async update(id: string, input: UpdateTeamInput) {
    await this.findById(id);
    const team = await prisma.team.update({ where: { id }, data: input });
    return team;
  },

  async delete(id: string) {
    await this.findById(id);
    await prisma.team.delete({ where: { id } });
  },
};
