// frontend/src/hooks/useConflicts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  conflictsApi,
  type CreateOverrideInput,
} from '../api/conflicts';

// Check conflicts for a specific game
export function useGameConflicts(gameId: string | null) {
  return useQuery({
    queryKey: ['conflicts', 'game', gameId],
    queryFn: () => conflictsApi.checkGameConflicts(gameId!),
    enabled: !!gameId,
  });
}

// Check conflicts for a specific practice
export function usePracticeConflicts(practiceId: string | null) {
  return useQuery({
    queryKey: ['conflicts', 'practice', practiceId],
    queryFn: () => conflictsApi.checkPracticeConflicts(practiceId!),
    enabled: !!practiceId,
  });
}

// Get conflict summary for a season
export function useSeasonConflicts(seasonId: string) {
  return useQuery({
    queryKey: ['conflicts', 'season', seasonId],
    queryFn: () => conflictsApi.getSeasonConflicts(seasonId),
    enabled: !!seasonId,
  });
}

// Get events affected by a blocker
export function useBlockerAffectedEvents(blockerId: string | null) {
  return useQuery({
    queryKey: ['conflicts', 'blocker', blockerId],
    queryFn: () => conflictsApi.getBlockerAffectedEvents(blockerId!),
    enabled: !!blockerId,
  });
}

// Get school-wide conflict summary (for dashboard)
export function useSchoolConflictSummary(schoolId: string) {
  return useQuery({
    queryKey: ['conflicts', 'summary', schoolId],
    queryFn: () => conflictsApi.getSchoolConflictSummary(schoolId),
    enabled: !!schoolId,
  });
}

// Create a conflict override
export function useCreateConflictOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOverrideInput) => conflictsApi.createOverride(data),
    onSuccess: () => {
      // Invalidate all conflict queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['conflicts'] });
    },
  });
}
