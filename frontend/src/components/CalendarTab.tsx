// frontend/src/components/CalendarTab.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gamesApi, type Game } from '../api/games';
import { practicesApi, type Practice } from '../api/practices';
import { facilitiesApi, type Facility } from '../api/facilities';
import { ConflictBadge, ConflictDetailPanel } from './conflicts';
import { useSeasonConflicts } from '../hooks/useConflicts';
import type { Conflict } from '../api/conflicts';
import { EmptyState } from './EmptyState';

interface CalendarTabProps {
  seasonId: string;
  schoolId: string;
  onEditGame?: (game: Game) => void;
  onEditPractice?: (practice: Practice) => void;
}

type CalendarEvent = {
  type: 'game';
  id: string;
  datetime: string;
  game: Game;
  practice?: never;
} | {
  type: 'practice';
  id: string;
  datetime: string;
  practice: Practice;
  game?: never;
};

const formatTime = (datetime: string): string => {
  return new Date(datetime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDateHeader = (date: string): string => {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatHomeAway = (ha: Game['homeAway']): string => {
  if (ha === 'HOME') return 'vs';
  if (ha === 'AWAY') return '@';
  return 'at';
};

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
};

export function CalendarTab({ seasonId, schoolId, onEditGame, onEditPractice }: CalendarTabProps) {
  const [selectedEvent, setSelectedEvent] = useState<{
    event: CalendarEvent;
    conflicts: Conflict[];
  } | null>(null);

  const { data: games, isLoading: isLoadingGames } = useQuery({
    queryKey: ['games', seasonId],
    queryFn: () => gamesApi.list(seasonId),
  });

  const { data: practices, isLoading: isLoadingPractices } = useQuery({
    queryKey: ['practices', seasonId],
    queryFn: () => practicesApi.list(seasonId),
  });

  const { data: facilities } = useQuery({
    queryKey: ['facilities', schoolId],
    queryFn: () => facilitiesApi.list(schoolId),
  });

  const { data: conflictSummary } = useSeasonConflicts(seasonId);

  const isLoading = isLoadingGames || isLoadingPractices;

  // Create facility map for quick lookup
  const facilityMap = new Map<string, Facility>(
    facilities?.map((f) => [f.id, f]) ?? []
  );

  // Build conflict maps
  const gameConflictsMap = new Map<string, Conflict[]>();
  const practiceConflictsMap = new Map<string, Conflict[]>();
  conflictSummary?.conflictingEvents.forEach((e) => {
    if (e.type === 'game') {
      gameConflictsMap.set(e.id, e.conflicts);
    } else {
      practiceConflictsMap.set(e.id, e.conflicts);
    }
  });

  // Merge and sort all events
  const allEvents: CalendarEvent[] = [
    ...(games?.map((g): CalendarEvent => ({
      type: 'game',
      id: g.id,
      datetime: g.datetime,
      game: g,
    })) ?? []),
    ...(practices?.map((p): CalendarEvent => ({
      type: 'practice',
      id: p.id,
      datetime: p.datetime,
      practice: p,
    })) ?? []),
  ].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

  // Group events by date
  const eventsByDate = allEvents.reduce((acc, event) => {
    const dateKey = new Date(event.datetime).toISOString().split('T')[0];
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  const getConflicts = (event: CalendarEvent): Conflict[] => {
    if (event.type === 'game') {
      return gameConflictsMap.get(event.id) || [];
    }
    return practiceConflictsMap.get(event.id) || [];
  };

  const getFacilityName = (facilityId: string | null): string | null => {
    if (!facilityId) return null;
    return facilityMap.get(facilityId)?.name ?? null;
  };

  const handleEventClick = (event: CalendarEvent) => {
    if (event.type === 'game' && onEditGame) {
      onEditGame(event.game);
    } else if (event.type === 'practice' && onEditPractice) {
      onEditPractice(event.practice);
    }
  };

  const handleConflictClick = (event: CalendarEvent, conflicts: Conflict[]) => {
    setSelectedEvent({ event, conflicts });
  };

  if (isLoading) {
    return <p className="text-gray-500">Loading...</p>;
  }

  if (allEvents.length === 0) {
    return (
      <EmptyState
        title="No events scheduled"
        description="Add games or practices to see them in calendar view."
      />
    );
  }

  const totalConflicts = (conflictSummary?.gamesWithConflicts ?? 0) + (conflictSummary?.practicesWithConflicts ?? 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Calendar</h2>
          {totalConflicts > 0 && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              {totalConflicts} event{totalConflicts !== 1 ? 's' : ''} with conflicts
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span>Game</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>Practice</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        {Object.entries(eventsByDate).map(([date, events]) => (
          <div key={date} className="border-b last:border-b-0">
            <div className="px-4 py-2 bg-gray-50 font-medium text-gray-900">
              {formatDateHeader(date)}
            </div>
            <ul className="divide-y divide-gray-100">
              {events.map((event) => {
                const conflicts = getConflicts(event);
                const hasConflict = conflicts.length > 0;
                const isClickable = (event.type === 'game' && onEditGame) || (event.type === 'practice' && onEditPractice);

                return (
                  <li
                    key={`${event.type}-${event.id}`}
                    className={`px-4 py-3 flex items-center gap-4 ${hasConflict ? 'bg-amber-50/30' : ''} ${isClickable ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                    onClick={() => isClickable && handleEventClick(event)}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      event.type === 'game' ? 'bg-blue-500' : 'bg-green-500'
                    }`} />
                    <div className="text-sm text-gray-500 w-20 flex-shrink-0">
                      {formatTime(event.datetime)}
                    </div>
                    <div className="flex-1 min-w-0">
                      {event.type === 'game' ? (
                        <span className="text-gray-900">
                          {formatHomeAway(event.game.homeAway)} {event.game.opponent}
                          {event.game.facilityId && (
                            <span className="text-gray-500"> · {getFacilityName(event.game.facilityId)}</span>
                          )}
                          {event.game.status !== 'SCHEDULED' && (
                            <span className={`ml-2 inline-flex px-1.5 py-0.5 text-xs rounded ${
                              event.game.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                              event.game.status === 'POSTPONED' ? 'bg-yellow-100 text-yellow-800' :
                              event.game.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {event.game.status.charAt(0) + event.game.status.slice(1).toLowerCase()}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-900">
                          Practice ({formatDuration(event.practice.durationMinutes)})
                          {event.practice.facilityId && (
                            <span className="text-gray-500"> · {getFacilityName(event.practice.facilityId)}</span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <ConflictBadge
                        conflictCount={conflicts.length}
                        onClick={() => handleConflictClick(event, conflicts)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {selectedEvent && (
        <ConflictDetailPanel
          isOpen={true}
          onClose={() => setSelectedEvent(null)}
          event={{
            type: selectedEvent.event.type,
            id: selectedEvent.event.id,
            datetime: selectedEvent.event.datetime,
            opponent: selectedEvent.event.type === 'game' ? selectedEvent.event.game.opponent : undefined,
          }}
          conflicts={selectedEvent.conflicts}
        />
      )}
    </div>
  );
}
