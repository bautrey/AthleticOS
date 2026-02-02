// frontend/src/components/SchoolCard.tsx
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { School } from '../api/schools';
import { teamsApi } from '../api/teams';
import { seasonsApi } from '../api/seasons';
import { conflictsApi } from '../api/conflicts';

interface SchoolCardProps {
  school: School;
}

export function SchoolCard({ school }: SchoolCardProps) {
  const { data: teams } = useQuery({
    queryKey: ['teams', school.id],
    queryFn: () => teamsApi.list(school.id),
  });

  const { data: seasons } = useQuery({
    queryKey: ['seasons', school.id],
    queryFn: () => seasonsApi.list(school.id),
  });

  const { data: conflictSummary } = useQuery({
    queryKey: ['school-conflict-summary', school.id],
    queryFn: () => conflictsApi.getSchoolConflictSummary(school.id),
  });

  const teamsCount = teams?.length ?? 0;
  const seasonsCount = seasons?.length ?? 0;
  const conflictsCount = conflictSummary?.totalConflicts ?? 0;

  return (
    <Link
      to={`/schools/${school.id}`}
      className="block bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
    >
      <h3 className="text-lg font-semibold text-gray-900">{school.name}</h3>
      <p className="text-sm text-gray-500 mt-1">{school.timezone}</p>

      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-semibold text-gray-900">{teamsCount}</div>
          <div className="text-xs text-gray-500">Teams</div>
        </div>
        <div>
          <div className="text-2xl font-semibold text-gray-900">{seasonsCount}</div>
          <div className="text-xs text-gray-500">Seasons</div>
        </div>
        <div>
          <div className={`text-2xl font-semibold ${conflictsCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {conflictsCount}
          </div>
          <div className="text-xs text-gray-500">Conflicts</div>
        </div>
      </div>
    </Link>
  );
}
