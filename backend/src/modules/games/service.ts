// backend/src/modules/games/service.ts
import { prisma } from '../../common/db.js';
import { NotFoundError } from '../../common/errors.js';
import type { CreateGameInput, UpdateGameInput } from './schemas.js';

export const gamesService = {
  async create(seasonId: string, input: CreateGameInput) {
    const game = await prisma.game.create({
      data: {
        ...input,
        seasonId,
        datetime: new Date(input.datetime),
      },
    });
    return game;
  },

  async findBySeason(seasonId: string) {
    const games = await prisma.game.findMany({
      where: { seasonId },
      orderBy: { datetime: 'asc' },
      include: { facility: true },
    });
    return games;
  },

  async findById(id: string) {
    const game = await prisma.game.findUnique({
      where: { id },
      include: { facility: true },
    });
    if (!game) throw new NotFoundError('Game', id);
    return game;
  },

  async update(id: string, input: UpdateGameInput) {
    await this.findById(id);
    const data: Record<string, unknown> = { ...input };
    if (input.datetime) data.datetime = new Date(input.datetime);
    const game = await prisma.game.update({
      where: { id },
      data,
      include: { facility: true },
    });
    return game;
  },

  async delete(id: string) {
    await this.findById(id);
    await prisma.game.delete({ where: { id } });
  },
};
