// backend/src/modules/seasons/service.ts
import { prisma } from '../../common/db.js';
import { NotFoundError } from '../../common/errors.js';
import type { CreateSeasonInput, UpdateSeasonInput } from './schemas.js';

export const seasonsService = {
  async create(teamId: string, input: CreateSeasonInput) {
    const season = await prisma.season.create({
      data: {
        ...input,
        teamId,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
      },
      include: { team: true },
    });
    return {
      ...season,
      sport: season.team.sport,
    };
  },

  async findBySchool(schoolId: string) {
    const seasons = await prisma.season.findMany({
      where: { team: { schoolId } },
      include: { team: true },
      orderBy: [{ year: 'desc' }, { startDate: 'desc' }],
    });
    return seasons.map((s) => ({
      ...s,
      sport: s.team.sport,
      teamName: s.team.name,
    }));
  },

  async findByTeam(teamId: string) {
    const seasons = await prisma.season.findMany({
      where: { teamId },
      include: { team: true },
      orderBy: [{ year: 'desc' }, { startDate: 'desc' }],
    });
    return seasons.map((s) => ({
      ...s,
      sport: s.team.sport,
    }));
  },

  async findById(id: string) {
    const season = await prisma.season.findUnique({
      where: { id },
      include: { team: true },
    });
    if (!season) throw new NotFoundError('Season', id);
    return {
      ...season,
      sport: season.team.sport,
      teamName: season.team.name,
    };
  },

  async update(id: string, input: UpdateSeasonInput) {
    await this.findById(id);
    const data: Record<string, unknown> = { ...input };
    if (input.startDate) data.startDate = new Date(input.startDate);
    if (input.endDate) data.endDate = new Date(input.endDate);
    const season = await prisma.season.update({ where: { id }, data });
    return season;
  },

  async delete(id: string) {
    await this.findById(id);
    await prisma.season.delete({ where: { id } });
  },
};
