// frontend/src/hooks/useEvents.ts
import { useQuery } from '@tanstack/react-query';
import { eventsApi, type UpcomingEventsQuery } from '../api/events';

export function useUpcomingEvents(schoolId: string, query?: UpcomingEventsQuery) {
  return useQuery({
    queryKey: ['events', 'upcoming', schoolId, query],
    queryFn: () => eventsApi.getUpcoming(schoolId, query),
    enabled: !!schoolId,
  });
}
