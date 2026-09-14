// frontend/src/components/conflicts/FacilityConflictsList.tsx
import type { TypedConflict } from '../../api/conflicts';

interface FacilityConflictsListProps {
  items: TypedConflict[];
}

function formatWhen(datetime: string): string {
  const d = new Date(datetime);
  if (Number.isNaN(d.getTime())) return datetime;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatOverlap(minutes: number): string {
  if (minutes < 60) return `${minutes} min overlap`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? `${hours}h overlap`
    : `${hours}h ${rest}m overlap`;
}

function EventSide({ event }: { event: TypedConflict['eventA'] }) {
  return (
    <div className="min-w-0">
      <div className="font-medium text-gray-900 truncate">{event.name}</div>
      <div className="text-gray-500">
        {event.teamName ? `${event.teamName} · ` : ''}
        {event.type === 'GAME' ? 'Game' : 'Practice'}
      </div>
      <div className="text-gray-500">{formatWhen(event.datetime)}</div>
    </div>
  );
}

export function FacilityConflictsList({ items }: FacilityConflictsListProps) {
  if (items.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Facility Double-Bookings</h2>
          <p className="text-sm text-gray-500">
            Two events booked into the same space at overlapping times.
          </p>
        </div>
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
          {items.length}
        </span>
      </div>

      <ul className="divide-y divide-gray-200">
        {items.map((conflict, i) => {
          const facility =
            conflict.eventA.facilityName ?? conflict.eventB?.facilityName ?? 'Unknown facility';
          return (
            <li
              key={`${conflict.eventA.id}-${conflict.eventB?.id ?? i}`}
              className="px-4 py-4"
            >
              <div className="flex items-center justify-between mb-2 gap-3">
                <span className="font-medium text-gray-900 truncate">{facility}</span>
                <span className="shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                  {formatOverlap(conflict.overlapMinutes)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 sm:gap-4 items-center text-sm">
                <EventSide event={conflict.eventA} />
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider sm:text-center">
                  overlaps
                </span>
                {conflict.eventB ? (
                  <EventSide event={conflict.eventB} />
                ) : (
                  <div className="text-gray-500">Unknown second event</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
