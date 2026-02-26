// frontend/src/hooks/usePriorityRules.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  priorityRulesApi,
  type UpdatePriorityRulesInput,
  type CalculatePriorityInput,
  type ComparePriorityInput,
} from '../api/priorityRules';

export function usePriorityRules(schoolId: string) {
  return useQuery({
    queryKey: ['priority-rules', schoolId],
    queryFn: () => priorityRulesApi.get(schoolId),
    enabled: !!schoolId,
  });
}

export function useUpdatePriorityRules(schoolId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePriorityRulesInput) => priorityRulesApi.update(schoolId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priority-rules', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['priority-rules', schoolId, 'audits'] });
    },
  });
}

export function useCalculatePriority(schoolId: string) {
  return useMutation({
    mutationFn: (data: CalculatePriorityInput) => priorityRulesApi.calculate(schoolId, data),
  });
}

export function useComparePriority(schoolId: string) {
  return useMutation({
    mutationFn: (data: ComparePriorityInput) => priorityRulesApi.compare(schoolId, data),
  });
}

export function usePriorityAudits(schoolId: string, query?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['priority-rules', schoolId, 'audits', query],
    queryFn: () => priorityRulesApi.getAudits(schoolId, query),
    enabled: !!schoolId,
  });
}
