// frontend/src/components/weekly-board/EventCard.tsx
import type { UpcomingEvent } from '../../api/events';

interface EventCardProps {
  event: UpcomingEvent;
  topPx: number;
  heightPx: number;
  onClick: (event: UpcomingEvent) => void;
  isSelected: boolean;
}

const formatTime = (dateString: string): string => {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

export function EventCard({ event, topPx, heightPx, onClick, isSelected }: EventCardProps) {
  const isGame = event.type === 'game';

  // Conflict styling
  let borderClass = '';
  if (event.hasConflicts) {
    borderClass = event.conflictCount >= 2
      ? 'ring-2 ring-red-400'
      : 'ring-2 ring-amber-400';
  }

  const bgClass = isGame
    ? 'bg-blue-50 border-l-4 border-l-blue-500'
    : 'bg-green-50 border-l-4 border-l-green-500';

  const isShort = heightPx < 40;

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(event); }}
      className={`absolute left-1 right-1 rounded-md px-2 py-1 text-left overflow-hidden cursor-pointer
        transition-shadow hover:shadow-md ${bgClass} ${borderClass}
        ${isSelected ? 'shadow-lg ring-2 ring-blue-600' : ''}`}
      style={{ top: `${topPx}px`, height: `${Math.max(heightPx, 20)}px` }}
      title={`${event.teamName}${event.opponent ? ` vs ${event.opponent}` : ''} - ${formatTime(event.datetime)}${event.facilityName ? ` @ ${event.facilityName}` : ''}`}
    >
      {isShort ? (
        <span className="text-xs font-medium text-gray-800 truncate block">
          {event.teamName} {formatTime(event.datetime)}
        </span>
      ) : (
        <>
          <div className="text-xs font-semibold text-gray-800 truncate">
            {event.teamName}
          </div>
          {isGame && event.opponent && (
            <div className="text-xs text-gray-600 truncate">
              vs {event.opponent}
            </div>
          )}
          <div className="text-xs text-gray-500 truncate">
            {formatTime(event.datetime)}
            {event.facilityName ? ` @ ${event.facilityName}` : ''}
          </div>
          {event.hasConflicts && (
            <div className="text-xs mt-0.5">
              <span className={`inline-block px-1 rounded text-white ${event.conflictCount >= 2 ? 'bg-red-500' : 'bg-amber-500'}`}>
                {event.conflictCount} conflict{event.conflictCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </>
      )}
    </button>
  );
}
