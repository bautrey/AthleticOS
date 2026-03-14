// frontend/src/hooks/useConflicts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  conflictsApi,
  type CreateOverrideInput,
  type ConflictListQuery,
  type EventType,
  type BatchOverrideInput,
  type CheckConflictsInput,
  type SuggestSlotsInput,
  type ApplySlotInput,
} from '../api/conflicts';

// List all conflicts for a school (paginated)
export function useConflictList(schoolId: string, query?: ConflictListQuery) {
  return useQuery({
    queryKey: ['conflicts', 'list', schoolId, query],
    queryFn: () => conflictsApi.listConflicts(schoolId, query),
    enabled: !!schoolId,
  });
}

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
      queryClient.invalidateQueries({ queryKey: ['conflicts'] });
    },
  });
}

// Get override history for an event
export function useEventOverrides(eventType: EventType | null, eventId: string | null) {
  return useQuery({
    queryKey: ['conflicts', 'overrides', eventType, eventId],
    queryFn: () => conflictsApi.getOverridesForEvent(eventType!, eventId!),
    enabled: !!eventType && !!eventId,
  });
}

// Batch override multiple conflicts
export function useBatchOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BatchOverrideInput) => conflictsApi.batchOverride(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conflicts'] });
    },
  });
}

// T-026: Check conflicts with enhanced detection
export function useCheckConflicts(schoolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CheckConflictsInput) => conflictsApi.checkConflicts(schoolId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conflicts'] });
    },
  });
}

// T-027: Get suggested alternative time slots
export function useSuggestSlots(schoolId: string) {
  return useMutation({
    mutationFn: (input: SuggestSlotsInput) => conflictsApi.suggestSlots(schoolId, input),
  });
}

// Apply a suggested slot to reschedule an event
export function useApplySlot(schoolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ApplySlotInput) => conflictsApi.applySlot(schoolId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conflicts'] });
    },
  });
}
