// frontend/src/hooks/useInvites.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invitesApi } from '../api/invites';

export function useInvites(schoolId: string) {
  return useQuery({
    queryKey: ['invites', schoolId],
    queryFn: () => invitesApi.list(schoolId),
  });
}

export function useMembers(schoolId: string) {
  return useQuery({
    queryKey: ['members', schoolId],
    queryFn: () => invitesApi.listMembers(schoolId),
  });
}

export function useCreateInvite(schoolId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) =>
      invitesApi.create(schoolId, email, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites', schoolId] });
    },
  });
}

export function useRevokeInvite(schoolId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => invitesApi.revoke(schoolId, inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites', schoolId] });
    },
  });
}

export function useInviteDetails(token: string) {
  return useQuery({
    queryKey: ['invite', token],
    queryFn: () => invitesApi.getByToken(token),
    retry: false,
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: (token: string) => invitesApi.accept(token),
  });
}
