// frontend/src/components/dashboard/HeroHeader.tsx
import type { School } from '../../api/schools';

interface HeroHeaderProps {
  school: School;
  conflictCount: number;
  eventsTodayCount: number;
}

export function HeroHeader({ school, conflictCount, eventsTodayCount }: HeroHeaderProps) {
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="mb-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
          <p className="text-gray-500 mt-1">{school.name} {'\u00B7'} {dateStr}</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {eventsTodayCount > 0 && (
            <span className="text-gray-600">
              <span className="font-semibold text-gray-900">{eventsTodayCount}</span> event{eventsTodayCount !== 1 ? 's' : ''} today
            </span>
          )}
          {conflictCount > 0 && (
            <span className="text-amber-600 font-medium">
              {conflictCount} conflict{conflictCount !== 1 ? 's' : ''} need attention
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
