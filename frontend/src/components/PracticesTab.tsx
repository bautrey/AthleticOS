// frontend/src/components/PracticesTab.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { practicesApi, type Practice } from '../api/practices';
import { facilitiesApi, type Facility } from '../api/facilities';
import { CreatePracticeModal } from './CreatePracticeModal';
import { EmptyState } from './EmptyState';

interface PracticesTabProps {
  seasonId: string;
  schoolId: string;
}

const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) {
    return `${mins} min`;
  }
  if (mins === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${mins} min`;
};

export function PracticesTab({ seasonId, schoolId }: PracticesTabProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: practices, isLoading } = useQuery({
    queryKey: ['practices', seasonId],
    queryFn: () => practicesApi.list(seasonId),
  });

  const { data: facilities } = useQuery({
    queryKey: ['facilities', schoolId],
    queryFn: () => facilitiesApi.list(schoolId),
  });

  // Create a map for quick facility lookup
  const facilityMap = new Map<string, Facility>(
    facilities?.map((f) => [f.id, f]) ?? []
  );

  const getFacilityName = (facilityId: string | null): string => {
    if (!facilityId) return '-';
    const facility = facilityMap.get(facilityId);
    return facility ? facility.name : '-';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Practices</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          + Add Practice
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : practices?.length === 0 ? (
        <EmptyState
          title="No practices scheduled"
          description="Add your first practice to start building your training schedule."
          action={{
            label: '+ Add Practice',
            onClick: () => setIsCreateModalOpen(true),
          }}
        />
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Facility</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {practices?.map((practice) => (
                <tr key={practice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {formatDateTime(practice.datetime)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDuration(practice.durationMinutes)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {getFacilityName(practice.facilityId)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {practice.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreatePracticeModal
        seasonId={seasonId}
        schoolId={schoolId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
