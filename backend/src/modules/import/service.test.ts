// backend/src/modules/import/service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importService } from './service.js';
import { prisma } from '../../common/db.js';
import { conflictService } from '../conflicts/service.js';

// Mock Prisma
vi.mock('../../common/db.js', () => ({
  prisma: {
    season: {
      findUnique: vi.fn(),
    },
    facility: {
      findMany: vi.fn(),
    },
    game: {
      create: vi.fn(),
    },
    practice: {
      create: vi.fn(),
    },
    conflictOverride: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn(prisma)),
  },
}));

// Mock conflict service
vi.mock('../conflicts/service.js', () => ({
  conflictService: {
    checkEventConflicts: vi.fn(),
  },
}));

const mockSeason = {
  id: 'season-1',
  name: 'Spring 2024',
  team: {
    id: 'team-1',
    schoolId: 'school-1',
    school: {
      id: 'school-1',
      timezone: 'America/New_York',
    },
  },
};

const mockFacilities = [
  { id: 'facility-1', name: 'Main Gym' },
  { id: 'facility-2', name: 'Practice Field' },
  { id: 'facility-3', name: 'Stadium' },
];

describe('importService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.season.findUnique).mockResolvedValue(mockSeason as any);
    vi.mocked(prisma.facility.findMany).mockResolvedValue(mockFacilities as any);
    vi.mocked(conflictService.checkEventConflicts).mockResolvedValue({
      hasConflicts: false,
      conflicts: [],
    });
  });

  describe('preview', () => {
    it('should validate game rows with exact facility match', async () => {
      const result = await importService.preview('season-1', {
        type: 'games',
        rows: [
          {
            row: 1,
            date: '2024-03-15',
            time: '15:00',
            opponent: 'Rival Team',
            homeAway: 'HOME',
            facility: 'Main Gym',
            notes: 'Season opener',
          },
        ],
      });

      expect(result.valid).toBe(true);
      expect(result.canImport).toBe(true);
      expect(result.totalRows).toBe(1);
      expect(result.validRows).toBe(1);
      expect(result.invalidRows).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.preview[0].facilityMatch?.type).toBe('exact');
      expect(result.preview[0].facilityMatch?.suggestion?.id).toBe('facility-1');
    });

    it('should detect fuzzy facility match', async () => {
      const result = await importService.preview('season-1', {
        type: 'games',
        rows: [
          {
            row: 1,
            date: '2024-03-15',
            time: '15:00',
            opponent: 'Rival Team',
            homeAway: 'HOME',
            facility: 'Main Gm', // Typo - Levenshtein distance 1
            notes: null,
          },
        ],
      });

      expect(result.valid).toBe(true);
      expect(result.preview[0].facilityMatch?.type).toBe('fuzzy');
      expect(result.preview[0].facilityMatch?.suggestion?.name).toBe('Main Gym');
      expect(result.preview[0].facilityMatch?.distance).toBeLessThanOrEqual(2);
    });

    it('should return no match for unknown facility', async () => {
      const result = await importService.preview('season-1', {
        type: 'games',
        rows: [
          {
            row: 1,
            date: '2024-03-15',
            time: '15:00',
            opponent: 'Rival Team',
            homeAway: 'AWAY',
            facility: 'Unknown Location',
            notes: null,
          },
        ],
      });

      expect(result.valid).toBe(true);
      expect(result.preview[0].facilityMatch?.type).toBe('none');
    });

    it('should validate practice rows', async () => {
      const result = await importService.preview('season-1', {
        type: 'practices',
        rows: [
          {
            row: 1,
            date: '2024-03-15',
            time: '16:00',
            duration: 120,
            facility: 'Practice Field',
            notes: 'Team practice',
          },
        ],
      });

      expect(result.valid).toBe(true);
      expect(result.validRows).toBe(1);
      expect(result.preview[0].parsed?.duration).toBe(120);
    });

    it('should default practice duration to 90 minutes', async () => {
      const result = await importService.preview('season-1', {
        type: 'practices',
        rows: [
          {
            row: 1,
            date: '2024-03-15',
            time: '16:00',
            duration: undefined as unknown as number,
            facility: null,
            notes: null,
          },
        ],
      });

      expect(result.preview[0].parsed?.duration).toBe(90);
    });

    it('should report invalid date format', async () => {
      const result = await importService.preview('season-1', {
        type: 'games',
        rows: [
          {
            row: 1,
            date: 'not-a-date',
            time: '15:00',
            opponent: 'Rival Team',
            homeAway: 'HOME',
            facility: null,
            notes: null,
          },
        ],
      });

      expect(result.valid).toBe(false);
      expect(result.canImport).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('date/time');
      expect(result.errors[0].row).toBe(1);
    });

    it('should report missing opponent for games', async () => {
      const result = await importService.preview('season-1', {
        type: 'games',
        rows: [
          {
            row: 1,
            date: '2024-03-15',
            time: '15:00',
            opponent: '',
            homeAway: 'HOME',
            facility: null,
            notes: null,
          },
        ],
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('opponent');
      expect(result.errors[0].message).toContain('required');
    });

    it('should detect conflicts and include them in result', async () => {
      vi.mocked(conflictService.checkEventConflicts).mockResolvedValue({
        hasConflicts: true,
        conflicts: [
          {
            blockerId: 'blocker-1',
            blockerName: 'School Holiday',
            blockerType: 'EXAM' as const,
            blockerScope: 'SCHOOL_WIDE' as const,
            startDatetime: new Date('2024-03-15'),
            endDatetime: new Date('2024-03-16'),
            reason: 'Event conflicts with School Holiday on this date',
          },
        ],
      });

      const result = await importService.preview('season-1', {
        type: 'games',
        rows: [
          {
            row: 1,
            date: '2024-03-15',
            time: '15:00',
            opponent: 'Rival Team',
            homeAway: 'HOME',
            facility: null,
            notes: null,
          },
        ],
      });

      expect(result.valid).toBe(true); // Conflicts don't invalidate
      expect(result.rowsWithConflicts).toBe(1);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].row).toBe(1);
      expect(result.conflicts[0].conflicts[0].blockerName).toBe('School Holiday');
    });

    it('should handle multiple rows with mixed results', async () => {
      const result = await importService.preview('season-1', {
        type: 'games',
        rows: [
          {
            row: 1,
            date: '2024-03-15',
            time: '15:00',
            opponent: 'Team A',
            homeAway: 'HOME',
            facility: 'Main Gym',
            notes: null,
          },
          {
            row: 2,
            date: 'invalid',
            time: '15:00',
            opponent: 'Team B',
            homeAway: 'HOME',
            facility: null,
            notes: null,
          },
          {
            row: 3,
            date: '2024-03-17',
            time: '14:00',
            opponent: 'Team C',
            homeAway: 'AWAY',
            facility: null,
            notes: null,
          },
        ],
      });

      expect(result.totalRows).toBe(3);
      expect(result.validRows).toBe(2);
      expect(result.invalidRows).toBe(1);
      expect(result.valid).toBe(false); // One error invalidates all
      expect(result.canImport).toBe(false);
    });

    it('should throw NotFoundError for non-existent season', async () => {
      vi.mocked(prisma.season.findUnique).mockResolvedValue(null);

      await expect(
        importService.preview('non-existent', {
          type: 'games',
          rows: [],
        })
      ).rejects.toThrow('Season');
    });
  });

  describe('execute', () => {
    it('should create games in transaction', async () => {
      const mockGame = {
        id: 'game-1',
        opponent: 'Rival Team',
        datetime: new Date('2024-03-15T15:00:00Z'),
      };
      vi.mocked(prisma.game.create).mockResolvedValue(mockGame as any);

      const result = await importService.execute(
        'season-1',
        {
          type: 'games',
          rows: [
            {
              row: 1,
              date: '2024-03-15',
              time: '15:00',
              opponent: 'Rival Team',
              homeAway: 'HOME',
              facility: 'Main Gym',
              notes: null,
            },
          ],
          overrideConflicts: false,
        },
        'user-1'
      );

      expect(result.imported).toBe(1);
      expect(result.games).toHaveLength(1);
      expect(result.games?.[0].opponent).toBe('Rival Team');
      expect(prisma.game.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            seasonId: 'season-1',
            opponent: 'Rival Team',
            homeAway: 'HOME',
            status: 'SCHEDULED',
          }),
        })
      );
    });

    it('should create practices in transaction', async () => {
      const mockPractice = {
        id: 'practice-1',
        datetime: new Date('2024-03-15T16:00:00Z'),
        durationMinutes: 120,
      };
      vi.mocked(prisma.practice.create).mockResolvedValue(mockPractice as any);

      const result = await importService.execute(
        'season-1',
        {
          type: 'practices',
          rows: [
            {
              row: 1,
              date: '2024-03-15',
              time: '16:00',
              duration: 120,
              facility: 'Practice Field',
              notes: 'Team practice',
            },
          ],
        },
        'user-1'
      );

      expect(result.imported).toBe(1);
      expect(result.practices).toHaveLength(1);
      expect(result.practices?.[0].durationMinutes).toBe(120);
    });

    it('should reject import with validation errors', async () => {
      await expect(
        importService.execute(
          'season-1',
          {
            type: 'games',
            rows: [
              {
                row: 1,
                date: 'invalid',
                time: '15:00',
                opponent: 'Team',
                homeAway: 'HOME',
                facility: null,
                notes: null,
              },
            ],
          },
          'user-1'
        )
      ).rejects.toThrow('validation errors');
    });

    it('should reject import with conflicts when overrideConflicts is false', async () => {
      vi.mocked(conflictService.checkEventConflicts).mockResolvedValue({
        hasConflicts: true,
        conflicts: [
          {
            blockerId: 'blocker-1',
            blockerName: 'Holiday',
            reason: 'Conflicts with holiday',
          },
        ],
      });

      await expect(
        importService.execute(
          'season-1',
          {
            type: 'games',
            rows: [
              {
                row: 1,
                date: '2024-03-15',
                time: '15:00',
                opponent: 'Team',
                homeAway: 'HOME',
                facility: null,
                notes: null,
              },
            ],
            overrideConflicts: false,
          },
          'user-1'
        )
      ).rejects.toThrow('conflicts');
    });

    it('should create conflict overrides when overrideConflicts is true', async () => {
      vi.mocked(conflictService.checkEventConflicts).mockResolvedValue({
        hasConflicts: true,
        conflicts: [
          {
            blockerId: 'blocker-1',
            blockerName: 'Holiday',
            reason: 'Conflicts with holiday',
          },
        ],
      });

      const mockGame = {
        id: 'game-1',
        opponent: 'Team',
        datetime: new Date(),
      };
      vi.mocked(prisma.game.create).mockResolvedValue(mockGame as any);

      const result = await importService.execute(
        'season-1',
        {
          type: 'games',
          rows: [
            {
              row: 1,
              date: '2024-03-15',
              time: '15:00',
              opponent: 'Team',
              homeAway: 'HOME',
              facility: null,
              notes: null,
            },
          ],
          overrideConflicts: true,
          overrideReason: 'Approved by AD',
        },
        'user-1'
      );

      expect(result.conflictsOverridden).toBe(1);
      expect(prisma.conflictOverride.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'GAME',
            eventId: 'game-1',
            blockerId: 'blocker-1',
            overriddenBy: 'user-1',
            reason: 'Approved by AD',
          }),
        })
      );
    });

    it('should use facility assignments from input', async () => {
      const mockGame = {
        id: 'game-1',
        opponent: 'Team',
        datetime: new Date(),
      };
      vi.mocked(prisma.game.create).mockResolvedValue(mockGame as any);

      await importService.execute(
        'season-1',
        {
          type: 'games',
          rows: [
            {
              row: 1,
              date: '2024-03-15',
              time: '15:00',
              opponent: 'Team',
              homeAway: 'HOME',
              facility: 'Unknown Facility',
              notes: null,
            },
          ],
          facilityAssignments: {
            '1': 'facility-3', // Manual assignment to Stadium
          },
        },
        'user-1'
      );

      expect(prisma.game.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            facilityId: 'facility-3',
          }),
        })
      );
    });
  });
});
