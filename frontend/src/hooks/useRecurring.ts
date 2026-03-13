// frontend/src/hooks/useRecurring.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { recurringApi, type CreateRecurringInput, type UpdateRecurringInput, type RecurringPreview } from '../api/recurring';

export function useCreateRecurring(schoolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRecurringInput) => recurringApi.create(schoolId, input),
    onSuccess: (data: RecurringPreview) => {
      if (!data.practices) return; // dry run, no cache invalidation
      queryClient.invalidateQueries({ queryKey: ['practices'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useUpdateSeries(schoolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, input }: { groupId: string; input: UpdateRecurringInput }) =>
      recurringApi.updateSeries(schoolId, groupId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practices'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useDeleteSeries(schoolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: string) => recurringApi.deleteSeries(schoolId, groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practices'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}
