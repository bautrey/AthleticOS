// frontend/src/pages/PublicSchedulePage.tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
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

type ViewMode = 'list' | 'calendar';

export function PublicSchedulePage() {
  const { token } = useParams<{ token: string }>();
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const { data: schedule, isLoading, error } = useQuery({
    queryKey: ['public-schedule', token],
    queryFn: async (): Promise<PublicSchedule> => {
      const response = await axios.get(`${API_URL}/api/v1/public/schedules/${token}`);
      return response.data.data;
    },
    retry: false,
  });

  const handleAddToCalendar = () => {
    // Open .ics download URL
    window.open(`${API_URL}/api/v1/public/schedules/${token}/calendar`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    const errorMessage = axios.isAxiosError(error)
      ? error.response?.data?.error?.message || 'Schedule not found'
      : 'Schedule not found';

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <a href="/" className="text-blue-600 hover:underline">
            Go to AthleticOS
          </a>
        </div>
      </div>
    );
  }

  if (!schedule) return null;

  // Combine and sort all events
  const allEvents = [
    ...schedule.games.map((g) => ({
      type: 'game' as const,
      eventDatetime: g.datetime,
      opponent: g.opponent,
      homeAway: g.homeAway,
      facility: g.facility,
      status: g.status,
      notes: g.notes,
      duration: undefined as number | undefined,
    })),
    ...schedule.practices.map((p) => ({
      type: 'practice' as const,
      eventDatetime: p.datetime,
      opponent: undefined as string | undefined,
      homeAway: undefined as string | undefined,
      facility: p.facility,
      status: undefined as string | undefined,
      notes: p.notes,
      duration: p.duration,
    })),
  ].sort((a, b) => new Date(a.eventDatetime).getTime() - new Date(b.eventDatetime).getTime());

  // Group events by date for calendar view
  const eventsByDate = allEvents.reduce((acc, event) => {
    const dateKey = new Date(event.eventDatetime).toISOString().split('T')[0];
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, typeof allEvents>);

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

  const formatHomeAway = (ha: string) => {
    if (ha === 'HOME') return 'vs';
    if (ha === 'AWAY') return '@';
    return 'at';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{schedule.title}</h1>
              <p className="text-gray-600">{schedule.school.name}</p>
            </div>
            <button
              onClick={handleAddToCalendar}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Add to Calendar
            </button>
          </div>
        </div>
      </header>

      {/* View toggle */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            List View
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'calendar'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Calendar View
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {allEvents.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No events scheduled yet.
          </div>
        ) : viewMode === 'list' ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {allEvents.map((event, index) => (
                <li key={index} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start gap-4">
                    {/* Date column */}
                    <div className="flex-shrink-0 w-20 text-center">
                      <div className="text-sm text-gray-500">
                        {formatDate(event.eventDatetime)}
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {formatTime(event.eventDatetime)}
                      </div>
                    </div>

                    {/* Event type indicator */}
                    <div className={`flex-shrink-0 w-3 h-3 rounded-full mt-2 ${
                      event.type === 'game' ? 'bg-blue-500' : 'bg-green-500'
                    }`} />

                    {/* Event details */}
                    <div className="flex-1 min-w-0">
                      {event.type === 'game' ? (
                        <>
                          <p className="font-medium text-gray-900">
                            {formatHomeAway(event.homeAway)} {event.opponent}
                          </p>
                          {event.facility && (
                            <p className="text-sm text-gray-500">{event.facility}</p>
                          )}
                          {'status' in event && event.status !== 'SCHEDULED' && (
                            <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                              event.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                              event.status === 'POSTPONED' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {event.status}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-gray-900">
                            Practice ({event.duration} min)
                          </p>
                          {event.facility && (
                            <p className="text-sm text-gray-500">{event.facility}</p>
                          )}
                        </>
                      )}
                      {event.notes && (
                        <p className="text-sm text-gray-500 mt-1">{event.notes}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          // Calendar view
          <div className="bg-white rounded-lg shadow">
            {Object.entries(eventsByDate).map(([date, events]) => (
              <div key={date} className="border-b last:border-b-0">
                <div className="px-4 py-2 bg-gray-50 font-medium text-gray-900">
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
                <ul className="divide-y divide-gray-100">
                  {events.map((event, index) => (
                    <li key={index} className="px-4 py-3 flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${
                        event.type === 'game' ? 'bg-blue-500' : 'bg-green-500'
                      }`} />
                      <div className="text-sm text-gray-500 w-20">
                        {formatTime(event.eventDatetime)}
                      </div>
                      <div className="flex-1">
                        {event.type === 'game' ? (
                          <span className="text-gray-900">
                            {formatHomeAway(event.homeAway)} {event.opponent}
                            {event.facility && (
                              <span className="text-gray-500"> · {event.facility}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-900">
                            Practice ({event.duration} min)
                            {event.facility && (
                              <span className="text-gray-500"> · {event.facility}</span>
                            )}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 flex items-center gap-6 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>Game</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Practice</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            Powered by{' '}
            <a href="/" className="text-blue-600 hover:underline">
              AthleticOS
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
