// frontend/src/hooks/useQuickAdd.ts
import { useMutation } from '@tanstack/react-query';
import { quickAddApi, type QuickAddInput } from '../api/quickAdd';

export function useQuickAdd(schoolId: string | undefined) {
  return useMutation({
    mutationFn: (input: QuickAddInput) => quickAddApi.parse(schoolId!, input),
  });
}
