// frontend/src/components/operations/ReadinessGrid.tsx
import { useReadiness } from '../../hooks/useOperations';

interface ReadinessGridProps {
  schoolId: string;
  days?: number;
}

function CompletionBar({ percent }: { percent: number }) {
  let bgColor = 'bg-red-500';
  if (percent >= 80) bgColor = 'bg-green-500';
  else if (percent >= 50) bgColor = 'bg-yellow-500';
  else if (percent >= 25) bgColor = 'bg-orange-500';

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${bgColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-600 w-8">{percent}%</span>
    </div>
  );
}

export function ReadinessGrid({ schoolId, days = 7 }: ReadinessGridProps) {
  const { data: events = [], isLoading } = useReadiness(schoolId, days);

  if (isLoading) {
    return <div className="text-sm text-gray-500 py-4">Loading readiness data...</div>;
  }

  if (events.length === 0) {
    return (
      <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-6 text-center">
        No upcoming events in the next {days} days.
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
            <th className="px-4 py-3">Event</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Facility</th>
            <th className="px-4 py-3">Completion</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {events.map(event => {
            const date = new Date(event.datetime);
            const isToday = date.toDateString() === new Date().toDateString();
            const isTomorrow = date.toDateString() === new Date(Date.now() + 86400000).toDateString();

            return (
              <tr key={event.eventId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">
                    {event.teamName}
                  </div>
                  <div className="text-xs text-gray-500">
                    vs {event.opponent}
                    <span className="ml-1 text-gray-400">({event.eventType.replace('_', ' ')})</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className={`text-sm ${isToday ? 'font-bold text-red-600' : isTomorrow ? 'font-semibold text-orange-600' : 'text-gray-700'}`}>
                    {isToday ? 'TODAY' : isTomorrow ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-xs text-gray-500">
                    {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {event.facilityName || <span className="text-gray-400">TBD</span>}
                </td>
                <td className="px-4 py-3">
                  {event.hasChecklist ? (
                    <CompletionBar percent={event.completionPercent} />
                  ) : (
                    <span className="text-xs text-gray-400">No checklist</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {event.overdueTasks > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">
                      {event.overdueTasks} overdue
                    </span>
                  )}
                  {event.completionPercent === 100 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                      Ready
                    </span>
                  )}
                  {!event.hasChecklist && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">
                      Needs setup
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
