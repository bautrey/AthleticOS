// frontend/src/components/SeasonsTab.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { seasonsApi } from '../api/seasons';
import { CreateSeasonModal } from './CreateSeasonModal';
import { EmptyState } from './EmptyState';

interface SeasonsTabProps {
  schoolId: string;
}

export function SeasonsTab({ schoolId }: SeasonsTabProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: seasons, isLoading } = useQuery({
    queryKey: ['seasons', schoolId],
    queryFn: () => seasonsApi.list(schoolId),
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Seasons</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          + Add Season
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : seasons?.length === 0 ? (
        <EmptyState
          title="No seasons yet"
          description="Create your first season to get started."
          action={{
            label: '+ Add Season',
            onClick: () => setIsCreateModalOpen(true),
          }}
        />
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sport</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {seasons?.map((season) => (
                <tr key={season.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{season.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{season.sport}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(season.startDate)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(season.endDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateSeasonModal
        schoolId={schoolId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
