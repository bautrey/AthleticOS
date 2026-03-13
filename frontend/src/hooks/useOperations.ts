// frontend/src/hooks/useOperations.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { operationsApi, type CreateTemplateInput, type UpdateChecklistItemInput } from '../api/operations';

export function useTemplates(schoolId: string | undefined) {
  return useQuery({
    queryKey: ['operations-templates', schoolId],
    queryFn: () => operationsApi.listTemplates(schoolId!),
    enabled: !!schoolId,
  });
}

export function useCreateTemplate(schoolId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTemplateInput) => operationsApi.createTemplate(schoolId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operations-templates', schoolId] });
    },
  });
}

export function useChecklist(schoolId: string | undefined, eventId: string | undefined, eventType = 'HOME_GAME') {
  return useQuery({
    queryKey: ['checklist', schoolId, eventId, eventType],
    queryFn: () => operationsApi.getChecklist(schoolId!, eventId!, eventType),
    enabled: !!schoolId && !!eventId,
  });
}

export function useUpdateChecklist(schoolId: string | undefined, eventId: string | undefined, eventType = 'HOME_GAME') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tasks: UpdateChecklistItemInput[]) =>
      operationsApi.updateChecklist(schoolId!, eventId!, tasks, eventType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist', schoolId, eventId, eventType] });
      queryClient.invalidateQueries({ queryKey: ['operations-readiness', schoolId] });
    },
  });
}

export function useReadiness(schoolId: string | undefined, days = 7) {
  return useQuery({
    queryKey: ['operations-readiness', schoolId, days],
    queryFn: () => operationsApi.getReadiness(schoolId!, days),
    enabled: !!schoolId,
  });
}
