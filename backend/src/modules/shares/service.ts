// backend/src/modules/shares/service.ts
import { prisma } from '../../common/db.js';
import { NotFoundError } from '../../common/errors.js';
import type {
  CreateShareInput,
  UpdateShareInput,
  ShareResponse,
  PublicScheduleResponse,
} from './schemas.js';
import { config } from '../../config.js';

// Generate full URL for share
function getShareUrl(token: string): string {
  const baseUrl = config.PUBLIC_URL || 'https://app.athleticos.com';
  return `${baseUrl}/s/${token}`;
}

// Generate embed code
function getEmbedCode(token: string): string {
  const baseUrl = config.PUBLIC_URL || 'https://app.athleticos.com';
  return `<iframe src="${baseUrl}/s/${token}/embed" width="100%" height="600" frameborder="0" style="border:1px solid #e5e7eb;border-radius:8px;"></iframe>`;
}

export const sharesService = {
  /**
   * Create a new share link for a season
   */
  async create(
    seasonId: string,
    input: CreateShareInput,
    userId: string
  ): Promise<ShareResponse> {
    // Verify season exists
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError('Season', seasonId);
    }

    const share = await prisma.scheduleShare.create({
      data: {
        seasonId,
        title: input.title,
        showNotes: input.showNotes ?? false,
        showFacility: input.showFacility ?? true,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        createdBy: userId,
      },
    });

    return {
      id: share.id,
      token: share.token,
      url: getShareUrl(share.token),
      embedCode: getEmbedCode(share.token),
      title: share.title,
      showNotes: share.showNotes,
      showFacility: share.showFacility,
      isActive: share.isActive,
      expiresAt: share.expiresAt,
      viewCount: share.viewCount,
      createdAt: share.createdAt,
    };
  },

  /**
   * List all shares for a season
   */
  async listBySeason(seasonId: string): Promise<ShareResponse[]> {
    const shares = await prisma.scheduleShare.findMany({
      where: { seasonId },
      orderBy: { createdAt: 'desc' },
    });

    return shares.map((share) => ({
      id: share.id,
      token: share.token,
      url: getShareUrl(share.token),
      embedCode: getEmbedCode(share.token),
      title: share.title,
      showNotes: share.showNotes,
      showFacility: share.showFacility,
      isActive: share.isActive,
      expiresAt: share.expiresAt,
      viewCount: share.viewCount,
      createdAt: share.createdAt,
    }));
  },

  /**
   * Get a share by ID
   */
  async findById(id: string): Promise<ShareResponse> {
    const share = await prisma.scheduleShare.findUnique({
      where: { id },
    });

    if (!share) {
      throw new NotFoundError('Share', id);
    }

    return {
      id: share.id,
      token: share.token,
      url: getShareUrl(share.token),
      embedCode: getEmbedCode(share.token),
      title: share.title,
      showNotes: share.showNotes,
      showFacility: share.showFacility,
      isActive: share.isActive,
      expiresAt: share.expiresAt,
      viewCount: share.viewCount,
      createdAt: share.createdAt,
    };
  },

  /**
   * Update a share
   */
  async update(id: string, input: UpdateShareInput): Promise<ShareResponse> {
    await this.findById(id); // Verify exists

    const data: Record<string, unknown> = { ...input };
    if (input.expiresAt !== undefined) {
      data.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    }

    const share = await prisma.scheduleShare.update({
      where: { id },
      data,
    });

    return {
      id: share.id,
      token: share.token,
      url: getShareUrl(share.token),
      embedCode: getEmbedCode(share.token),
      title: share.title,
      showNotes: share.showNotes,
      showFacility: share.showFacility,
      isActive: share.isActive,
      expiresAt: share.expiresAt,
      viewCount: share.viewCount,
      createdAt: share.createdAt,
    };
  },

  /**
   * Delete a share
   */
  async delete(id: string): Promise<void> {
    await this.findById(id); // Verify exists
    await prisma.scheduleShare.delete({ where: { id } });
  },

  /**
   * Get public schedule data by token (increments view count)
   */
  async getPublicSchedule(token: string): Promise<PublicScheduleResponse> {
    const share = await prisma.scheduleShare.findUnique({
      where: { token },
      include: {
        season: {
          include: {
            team: {
              include: { school: true },
            },
            games: {
              where: { status: { not: 'CANCELLED' } },
              orderBy: { datetime: 'asc' },
              include: { facility: true },
            },
            practices: {
              orderBy: { datetime: 'asc' },
              include: { facility: true },
            },
          },
        },
      },
    });

    if (!share) {
      throw new NotFoundError('Schedule', token);
    }

    // Check if share is active
    if (!share.isActive) {
      const error = new NotFoundError('Schedule', token);
      error.message = 'This schedule link is no longer active';
      throw error;
    }

    // Check if expired
    if (share.expiresAt && share.expiresAt < new Date()) {
      const error = new NotFoundError('Schedule', token);
      error.message = 'This schedule link has expired';
      throw error;
    }

    // Atomically increment view count
    await prisma.scheduleShare.update({
      where: { id: share.id },
      data: {
        viewCount: { increment: 1 },
      },
    });

    const { season } = share;
    const { team, games, practices } = season;

    return {
      title: share.title || `${team.name} ${team.sport} Schedule`,
      team: {
        name: team.name,
        sport: team.sport,
      },
      school: {
        name: team.school.name,
      },
      games: games.map((game) => ({
        datetime: game.datetime.toISOString(),
        opponent: game.opponent,
        homeAway: game.homeAway,
        facility: share.showFacility && game.facility ? game.facility.name : null,
        status: game.status,
        notes: share.showNotes ? game.notes : null,
      })),
      practices: practices.map((practice) => ({
        datetime: practice.datetime.toISOString(),
        duration: practice.durationMinutes,
        facility: share.showFacility && practice.facility ? practice.facility.name : null,
        notes: share.showNotes ? practice.notes : null,
      })),
    };
  },

  /**
   * Get share by token (for internal use, doesn't increment view count)
   */
  async findByToken(token: string) {
    const share = await prisma.scheduleShare.findUnique({
      where: { token },
      include: {
        season: {
          include: {
            team: {
              include: { school: true },
            },
          },
        },
      },
    });

    if (!share) {
      throw new NotFoundError('Schedule', token);
    }

    return share;
  },
};
