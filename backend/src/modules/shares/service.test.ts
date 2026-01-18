// backend/src/modules/shares/service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sharesService } from './service.js';
import { prisma } from '../../common/db.js';

// Mock Prisma
vi.mock('../../common/db.js', () => ({
  prisma: {
    season: {
      findUnique: vi.fn(),
    },
    scheduleShare: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock config
vi.mock('../../config.js', () => ({
  config: {
    PUBLIC_URL: 'http://localhost:3005',
  },
}));

const mockSeason = {
  id: 'season-1',
  name: 'Spring 2024',
  team: {
    id: 'team-1',
    name: 'Varsity Basketball',
    sport: 'Basketball',
    schoolId: 'school-1',
    school: {
      id: 'school-1',
      name: 'Central High School',
    },
  },
};

const mockShare = {
  id: 'share-1',
  token: 'abc123xyz',
  seasonId: 'season-1',
  title: 'Team Schedule',
  showNotes: true,
  showFacility: true,
  isActive: true,
  expiresAt: null,
  viewCount: 5,
  createdAt: new Date('2024-01-15'),
  createdBy: 'user-1',
};

describe('sharesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.season.findUnique).mockResolvedValue(mockSeason as any);
  });

  describe('create', () => {
    it('should create a new share with full response', async () => {
      vi.mocked(prisma.scheduleShare.create).mockResolvedValue(mockShare as any);

      const result = await sharesService.create(
        'season-1',
        {
          title: 'Team Schedule',
          showNotes: true,
          showFacility: true,
        },
        'user-1'
      );

      expect(result.id).toBe('share-1');
      expect(result.token).toBe('abc123xyz');
      expect(result.url).toBe('http://localhost:3005/s/abc123xyz');
      expect(result.embedCode).toContain('<iframe');
      expect(result.embedCode).toContain('/s/abc123xyz/embed');
      expect(result.title).toBe('Team Schedule');
      expect(result.showNotes).toBe(true);
      expect(result.showFacility).toBe(true);
      expect(result.isActive).toBe(true);
      expect(result.viewCount).toBe(5);
    });

    it('should create share with expiration date', async () => {
      vi.mocked(prisma.scheduleShare.create).mockResolvedValue({
        ...mockShare,
        expiresAt: new Date('2024-06-01'),
      } as any);

      const result = await sharesService.create(
        'season-1',
        {
          title: 'Limited Share',
          expiresAt: '2024-06-01T00:00:00Z',
        },
        'user-1'
      );

      expect(prisma.scheduleShare.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt: expect.any(Date),
          }),
        })
      );
      expect(result.expiresAt).toBeTruthy();
    });

    it('should throw NotFoundError for non-existent season', async () => {
      vi.mocked(prisma.season.findUnique).mockResolvedValue(null);

      await expect(
        sharesService.create(
          'non-existent',
          { title: 'Test' },
          'user-1'
        )
      ).rejects.toThrow('Season');
    });
  });

  describe('listBySeason', () => {
    it('should list all shares for a season', async () => {
      vi.mocked(prisma.scheduleShare.findMany).mockResolvedValue([
        mockShare,
        { ...mockShare, id: 'share-2', token: 'def456', isActive: false },
      ] as any);

      const result = await sharesService.listBySeason('season-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('share-1');
      expect(result[0].url).toContain('abc123xyz');
      expect(result[1].id).toBe('share-2');
      expect(result[1].isActive).toBe(false);
    });

    it('should return empty array when no shares exist', async () => {
      vi.mocked(prisma.scheduleShare.findMany).mockResolvedValue([]);

      const result = await sharesService.listBySeason('season-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('findById', () => {
    it('should return share by ID', async () => {
      vi.mocked(prisma.scheduleShare.findUnique).mockResolvedValue(mockShare as any);

      const result = await sharesService.findById('share-1');

      expect(result.id).toBe('share-1');
      expect(result.token).toBe('abc123xyz');
    });

    it('should throw NotFoundError for non-existent share', async () => {
      vi.mocked(prisma.scheduleShare.findUnique).mockResolvedValue(null);

      await expect(
        sharesService.findById('non-existent')
      ).rejects.toThrow('Share');
    });
  });

  describe('update', () => {
    beforeEach(() => {
      vi.mocked(prisma.scheduleShare.findUnique).mockResolvedValue(mockShare as any);
    });

    it('should update share settings', async () => {
      vi.mocked(prisma.scheduleShare.update).mockResolvedValue({
        ...mockShare,
        showNotes: false,
        title: 'Updated Title',
      } as any);

      const result = await sharesService.update('share-1', {
        showNotes: false,
        title: 'Updated Title',
      });

      expect(result.showNotes).toBe(false);
      expect(result.title).toBe('Updated Title');
      expect(prisma.scheduleShare.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'share-1' },
        })
      );
    });

    it('should deactivate share', async () => {
      vi.mocked(prisma.scheduleShare.update).mockResolvedValue({
        ...mockShare,
        isActive: false,
      } as any);

      const result = await sharesService.update('share-1', {
        isActive: false,
      });

      expect(result.isActive).toBe(false);
    });

    it('should update expiration date', async () => {
      vi.mocked(prisma.scheduleShare.update).mockResolvedValue({
        ...mockShare,
        expiresAt: new Date('2024-12-31'),
      } as any);

      await sharesService.update('share-1', {
        expiresAt: '2024-12-31T00:00:00Z',
      });

      expect(prisma.scheduleShare.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt: expect.any(Date),
          }),
        })
      );
    });

    it('should clear expiration date when null', async () => {
      vi.mocked(prisma.scheduleShare.update).mockResolvedValue({
        ...mockShare,
        expiresAt: null,
      } as any);

      await sharesService.update('share-1', {
        expiresAt: null,
      });

      expect(prisma.scheduleShare.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt: null,
          }),
        })
      );
    });
  });

  describe('delete', () => {
    it('should delete a share', async () => {
      vi.mocked(prisma.scheduleShare.findUnique).mockResolvedValue(mockShare as any);
      vi.mocked(prisma.scheduleShare.delete).mockResolvedValue(mockShare as any);

      await sharesService.delete('share-1');

      expect(prisma.scheduleShare.delete).toHaveBeenCalledWith({
        where: { id: 'share-1' },
      });
    });

    it('should throw NotFoundError when deleting non-existent share', async () => {
      vi.mocked(prisma.scheduleShare.findUnique).mockResolvedValue(null);

      await expect(
        sharesService.delete('non-existent')
      ).rejects.toThrow('Share');
    });
  });

  describe('getPublicSchedule', () => {
    const mockShareWithSeason = {
      ...mockShare,
      season: {
        ...mockSeason,
        games: [
          {
            datetime: new Date('2024-03-15T15:00:00Z'),
            opponent: 'Rival Team',
            homeAway: 'HOME',
            status: 'SCHEDULED',
            notes: 'Season opener',
            facility: { name: 'Main Gym' },
          },
        ],
        practices: [
          {
            datetime: new Date('2024-03-14T16:00:00Z'),
            durationMinutes: 90,
            notes: 'Team practice',
            facility: { name: 'Practice Court' },
          },
        ],
      },
    };

    beforeEach(() => {
      vi.mocked(prisma.scheduleShare.findUnique).mockResolvedValue(mockShareWithSeason as any);
      vi.mocked(prisma.scheduleShare.update).mockResolvedValue(mockShareWithSeason as any);
    });

    it('should return public schedule with games and practices', async () => {
      const result = await sharesService.getPublicSchedule('abc123xyz');

      expect(result.title).toBe('Team Schedule');
      expect(result.team.name).toBe('Varsity Basketball');
      expect(result.team.sport).toBe('Basketball');
      expect(result.school.name).toBe('Central High School');
      expect(result.games).toHaveLength(1);
      expect(result.games[0].opponent).toBe('Rival Team');
      expect(result.practices).toHaveLength(1);
      expect(result.practices[0].duration).toBe(90);
    });

    it('should increment view count atomically', async () => {
      await sharesService.getPublicSchedule('abc123xyz');

      expect(prisma.scheduleShare.update).toHaveBeenCalledWith({
        where: { id: 'share-1' },
        data: {
          viewCount: { increment: 1 },
        },
      });
    });

    it('should hide facility when showFacility is false', async () => {
      vi.mocked(prisma.scheduleShare.findUnique).mockResolvedValue({
        ...mockShareWithSeason,
        showFacility: false,
      } as any);

      const result = await sharesService.getPublicSchedule('abc123xyz');

      expect(result.games[0].facility).toBeNull();
      expect(result.practices[0].facility).toBeNull();
    });

    it('should hide notes when showNotes is false', async () => {
      vi.mocked(prisma.scheduleShare.findUnique).mockResolvedValue({
        ...mockShareWithSeason,
        showNotes: false,
      } as any);

      const result = await sharesService.getPublicSchedule('abc123xyz');

      expect(result.games[0].notes).toBeNull();
      expect(result.practices[0].notes).toBeNull();
    });

    it('should throw error for inactive share', async () => {
      vi.mocked(prisma.scheduleShare.findUnique).mockResolvedValue({
        ...mockShareWithSeason,
        isActive: false,
      } as any);

      await expect(
        sharesService.getPublicSchedule('abc123xyz')
      ).rejects.toThrow('no longer active');
    });

    it('should throw error for expired share', async () => {
      vi.mocked(prisma.scheduleShare.findUnique).mockResolvedValue({
        ...mockShareWithSeason,
        expiresAt: new Date('2020-01-01'), // Expired date
      } as any);

      await expect(
        sharesService.getPublicSchedule('abc123xyz')
      ).rejects.toThrow('expired');
    });

    it('should throw NotFoundError for non-existent token', async () => {
      vi.mocked(prisma.scheduleShare.findUnique).mockResolvedValue(null);

      await expect(
        sharesService.getPublicSchedule('invalid-token')
      ).rejects.toThrow('Schedule');
    });

    it('should use default title if none set', async () => {
      vi.mocked(prisma.scheduleShare.findUnique).mockResolvedValue({
        ...mockShareWithSeason,
        title: null,
      } as any);

      const result = await sharesService.getPublicSchedule('abc123xyz');

      expect(result.title).toBe('Varsity Basketball Basketball Schedule');
    });
  });
});
