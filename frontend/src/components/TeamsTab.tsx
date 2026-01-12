// frontend/src/components/TeamsTab.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { teamsApi } from '../api/teams';
import { CreateTeamModal } from './CreateTeamModal';
import { EmptyState } from './EmptyState';

interface TeamsTabProps {
  schoolId: string;
}

export function TeamsTab({ schoolId }: TeamsTabProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams', schoolId],
    queryFn: () => teamsApi.list(schoolId),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Teams</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          + Add Team
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : teams?.length === 0 ? (
        <EmptyState
          title="No teams yet"
          description="Create your first team to get started."
          action={{
            label: '+ Add Team',
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {teams?.map((team) => (
                <tr key={team.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{team.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{team.sport}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{team.level.replace('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateTeamModal
        schoolId={schoolId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
