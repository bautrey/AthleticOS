// frontend/src/hooks/useFacilityRequests.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facilityRequestsApi, type ListRequestsQuery, type CreateFacilityRequestInput } from '../api/facilityRequests';

export function useFacilityRequests(schoolId: string, query?: ListRequestsQuery) {
  return useQuery({
    queryKey: ['facility-requests', schoolId, query],
    queryFn: () => facilityRequestsApi.list(schoolId, query),
    enabled: !!schoolId,
  });
}

export function useCreateFacilityRequest(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFacilityRequestInput) => facilityRequestsApi.create(schoolId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['facility-requests', schoolId] });
    },
  });
}

export function useUpdateRequestStatus(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, status, reviewNotes }: { requestId: string; status: string; reviewNotes?: string }) =>
      facilityRequestsApi.updateStatus(schoolId, requestId, { status, reviewNotes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['facility-requests', schoolId] });
    },
  });
}

export function useFacilityAvailability(schoolId: string, facilityId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['facility-availability', schoolId, facilityId, from, to],
    queryFn: () => facilityRequestsApi.getAvailability(schoolId, facilityId, from, to),
    enabled: !!schoolId && !!facilityId && !!from && !!to,
  });
}
