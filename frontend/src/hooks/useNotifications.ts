// frontend/src/hooks/useNotifications.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  notificationsApi,
  type UpdatePreferencesInput,
  type NotificationLogQuery,
} from '../api/notifications';

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notification-preferences'],
    queryFn: notificationsApi.getPreferences,
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePreferencesInput) => notificationsApi.updatePreferences(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });
}

export function useNotificationLog(schoolId: string, query?: NotificationLogQuery) {
  return useQuery({
    queryKey: ['notification-log', schoolId, query],
    queryFn: () => notificationsApi.getNotificationLog(schoolId, query),
    enabled: !!schoolId,
  });
}

export function useSendTestNotification() {
  return useMutation({
    mutationFn: ({ schoolId, channel }: { schoolId: string; channel: 'EMAIL' | 'SMS' }) =>
      notificationsApi.sendTestNotification(schoolId, channel),
  });
}
