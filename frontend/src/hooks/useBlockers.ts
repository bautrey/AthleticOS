// frontend/src/hooks/useBlockers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  blockersApi,
  type BlockerQuery,
  type CreateBlockerInput,
  type UpdateBlockerInput,
} from '../api/blockers';

export function useBlockers(schoolId: string, query?: Partial<BlockerQuery>) {
  return useQuery({
    queryKey: ['blockers', schoolId, query],
    queryFn: () => blockersApi.list(schoolId, query),
    enabled: !!schoolId,
  });
}

export function useBlocker(schoolId: string, id: string) {
  return useQuery({
    queryKey: ['blockers', schoolId, id],
    queryFn: () => blockersApi.getById(schoolId, id),
    enabled: !!schoolId && !!id,
  });
}

export function useCreateBlocker(schoolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBlockerInput) => blockersApi.create(schoolId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blockers', schoolId] });
    },
  });
}

export function useUpdateBlocker(schoolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBlockerInput }) =>
      blockersApi.update(schoolId, id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['blockers', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['blockers', schoolId, id] });
    },
  });
}

export function useDeleteBlocker(schoolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => blockersApi.delete(schoolId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blockers', schoolId] });
    },
  });
}
