// frontend/src/pages/PublicScheduleEmbed.tsx
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8003';

interface PublicSchedule {
  title: string;
  team: {
    name: string;
    sport: string;
  };
  school: {
    name: string;
  };
  games: Array<{
    datetime: string;
    opponent: string;
    homeAway: string;
    facility: string | null;
    status: string;
    notes?: string | null;
  }>;
  practices: Array<{
    datetime: string;
    duration: number;
    facility: string | null;
    notes?: string | null;
  }>;
}

export function PublicScheduleEmbed() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const theme = searchParams.get('theme') || 'light';
  const isDark = theme === 'dark';

  const { data: schedule, isLoading, error } = useQuery({
    queryKey: ['public-schedule', token],
    queryFn: async (): Promise<PublicSchedule> => {
      const response = await axios.get(`${API_URL}/api/v1/public/schedules/${token}`);
      return response.data.data;
    },
    retry: false,
  });

  // Base styles for light/dark mode
  const bgClass = isDark ? 'bg-gray-900' : 'bg-white';
  const textClass = isDark ? 'text-white' : 'text-gray-900';
  const textMutedClass = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderClass = isDark ? 'border-gray-700' : 'border-gray-200';
  const hoverClass = isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50';

  if (isLoading) {
    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center`}>
        <p className={textMutedClass}>Schedule not found</p>
      </div>
    );
  }

  // Combine and sort events
  const allEvents = [
    ...schedule.games.map((g) => ({
      type: 'game' as const,
      eventDatetime: g.datetime,
      opponent: g.opponent,
      homeAway: g.homeAway,
      facility: g.facility,
      status: g.status,
      duration: undefined as number | undefined,
    })),
    ...schedule.practices.map((p) => ({
      type: 'practice' as const,
      eventDatetime: p.datetime,
      opponent: undefined as string | undefined,
      homeAway: undefined as string | undefined,
      facility: p.facility,
      status: undefined as string | undefined,
      duration: p.duration,
    })),
  ].sort((a, b) => new Date(a.eventDatetime).getTime() - new Date(b.eventDatetime).getTime());

  const formatDate = (datetime: string) => {
    return new Date(datetime).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (datetime: string) => {
    return new Date(datetime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatHomeAway = (ha: string | undefined) => {
    if (ha === 'HOME') return 'vs';
    if (ha === 'AWAY') return '@';
    return 'at';
  };

  return (
    <div className={`min-h-screen ${bgClass} ${textClass}`}>
      {/* Compact header */}
      <header className={`px-4 py-3 border-b ${borderClass}`}>
        <h1 className="font-semibold text-sm">{schedule.title}</h1>
        <p className={`text-xs ${textMutedClass}`}>{schedule.school.name}</p>
      </header>

      {/* Event list */}
      <div className="divide-y divide-inherit">
        {allEvents.length === 0 ? (
          <div className={`p-6 text-center ${textMutedClass}`}>
            No events scheduled
          </div>
        ) : (
          allEvents.slice(0, 20).map((event, index) => (
            <div key={index} className={`px-4 py-2 flex items-center gap-3 ${hoverClass}`}>
              {/* Type indicator */}
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                event.type === 'game' ? 'bg-blue-500' : 'bg-green-500'
              }`} />

              {/* Date/time */}
              <div className={`w-24 flex-shrink-0 text-xs ${textMutedClass}`}>
                <div>{formatDate(event.eventDatetime)}</div>
                <div>{formatTime(event.eventDatetime)}</div>
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0 text-sm truncate">
                {event.type === 'game' ? (
                  <span>
                    {formatHomeAway(event.homeAway)} {event.opponent}
                    {event.status && event.status !== 'SCHEDULED' && (
                      <span className="ml-2 text-xs text-red-500">({event.status})</span>
                    )}
                  </span>
                ) : (
                  <span>
                    Practice ({event.duration} min)
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {allEvents.length > 20 && (
        <div className={`px-4 py-2 text-center text-xs ${textMutedClass} border-t ${borderClass}`}>
          +{allEvents.length - 20} more events
        </div>
      )}
    </div>
  );
}
