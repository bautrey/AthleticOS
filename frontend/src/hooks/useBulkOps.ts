// frontend/src/hooks/useBulkOps.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bulkOpsApi, type BulkMoveInput, type RainPlanInput, type AutoResolveInput } from '../api/bulkOps';

export function useBulkMove(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkMoveInput) => bulkOpsApi.bulkMove(schoolId, input),
    onSuccess: (data) => {
      if (!data.dryRun) {
        qc.invalidateQueries({ queryKey: ['events'] });
      }
    },
  });
}

export function useRainPlan(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RainPlanInput) => bulkOpsApi.rainPlan(schoolId, input),
    onSuccess: (data) => {
      if (!data.dryRun) {
        qc.invalidateQueries({ queryKey: ['events'] });
      }
    },
  });
}

export function useAutoResolve(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AutoResolveInput) => bulkOpsApi.autoResolve(schoolId, input),
    onSuccess: (data) => {
      if (!data.dryRun) {
        qc.invalidateQueries({ queryKey: ['events'] });
        qc.invalidateQueries({ queryKey: ['conflicts'] });
      }
    },
  });
}
