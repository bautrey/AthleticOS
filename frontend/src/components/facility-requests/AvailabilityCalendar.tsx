// frontend/src/components/facility-requests/AvailabilityCalendar.tsx
import { useFacilityAvailability } from '../../hooks/useFacilityRequests';

interface Props {
  schoolId: string;
  facilityId: string;
  from: string;
  to: string;
}

const STATUS_STYLES: Record<string, string> = {
  booked: 'bg-red-100 text-red-700 border-red-200',
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  open: 'bg-green-50 text-green-700 border-green-200',
};

export function AvailabilityCalendar({ schoolId, facilityId, from, to }: Props) {
  const { data: days, isLoading } = useFacilityAvailability(schoolId, facilityId, from, to);

  if (isLoading) {
    return <div className="text-gray-500 text-center py-8">Loading availability...</div>;
  }

  if (!days || days.length === 0) {
    return <div className="text-gray-500 text-center py-8">No availability data for this range.</div>;
  }

  return (
    <div className="space-y-3">
      {days.map((day) => (
        <div key={day.date} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-800 mb-2">
            {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </div>

          {day.slots.length === 0 ? (
            <div className="text-xs text-green-600">Fully available</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {day.slots.map((slot, i) => (
                <div
                  key={i}
                  className={`text-xs px-2 py-1 rounded border ${STATUS_STYLES[slot.status]}`}
                >
                  {slot.startTime}-{slot.endTime}
                  {slot.label && <span className="ml-1 opacity-75">({slot.label})</span>}
                  <span className="ml-1 font-medium capitalize">{slot.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
