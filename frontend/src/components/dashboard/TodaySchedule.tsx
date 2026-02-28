// frontend/src/components/dashboard/TodaySchedule.tsx
import { Link } from 'react-router-dom';
import type { UpcomingEvent } from '../../api/events';

interface TodayScheduleProps {
  events: UpcomingEvent[];
  schoolId: string;
  isLoading: boolean;
}

const formatTime = (dateString: string): string => {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDayLabel = (dateString: string): string => {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

export function TodaySchedule({ events, schoolId, isLoading }: TodayScheduleProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Upcoming Schedule</h3>
        <div className="text-gray-400 text-sm">Loading events...</div>
      </div>
    );
  }

  // Group events by day
  const grouped: Record<string, UpcomingEvent[]> = {};
  for (const event of events) {
    const dayKey = new Date(event.datetime).toDateString();
    if (!grouped[dayKey]) grouped[dayKey] = [];
    grouped[dayKey].push(event);
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Upcoming Schedule</h3>
      </div>

      {events.length === 0 ? (
        <div className="p-6 text-center text-gray-400 text-sm">
          No events in the next 2 days.
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {Object.entries(grouped).map(([dayKey, dayEvents]) => (
            <div key={dayKey}>
              <div className="px-6 py-2 bg-gray-50">
                <span className="text-xs font-medium text-gray-500 uppercase">
                  {formatDayLabel(dayEvents[0].datetime)}
                </span>
              </div>
              {dayEvents.map((event) => (
                <div
                  key={`${event.type}-${event.id}`}
                  className="px-6 py-3 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm text-gray-500 w-16 flex-shrink-0 font-mono">
                      {formatTime(event.datetime)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          event.type === 'game' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {event.type === 'game' ? 'G' : 'P'}
                        </span>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {event.teamName}
                        </span>
                        {event.type === 'game' && event.opponent && (
                          <span className="text-sm text-gray-500 truncate">vs {event.opponent}</span>
                        )}
                      </div>
                      {event.facilityName && (
                        <div className="text-xs text-gray-400 mt-0.5">{event.facilityName}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {event.hasConflicts && (
                      <Link
                        to={`/schools/${schoolId}/conflicts`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {event.conflictCount}
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
