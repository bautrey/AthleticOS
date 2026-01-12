// frontend/src/components/GamesTab.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gamesApi, type Game } from '../api/games';
import { CreateGameModal } from './CreateGameModal';
import { EmptyState } from './EmptyState';

interface GamesTabProps {
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

const formatHomeAway = (homeAway: Game['homeAway']): string => {
  switch (homeAway) {
    case 'HOME':
      return 'Home';
    case 'AWAY':
      return 'Away';
    case 'NEUTRAL':
      return 'Neutral';
    default:
      return homeAway;
  }
};

const getStatusBadgeClass = (status: Game['status']): string => {
  switch (status) {
    case 'SCHEDULED':
      return 'bg-blue-100 text-blue-800';
    case 'CONFIRMED':
      return 'bg-green-100 text-green-800';
    case 'CANCELLED':
      return 'bg-red-100 text-red-800';
    case 'POSTPONED':
      return 'bg-yellow-100 text-yellow-800';
    case 'COMPLETED':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export function GamesTab({ seasonId, schoolId }: GamesTabProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: games, isLoading } = useQuery({
    queryKey: ['games', seasonId],
    queryFn: () => gamesApi.list(seasonId),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Games</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          + Add Game
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : games?.length === 0 ? (
        <EmptyState
          title="No games scheduled"
          description="Add your first game to start building your schedule."
          action={{
            label: '+ Add Game',
            onClick: () => setIsCreateModalOpen(true),
          }}
        />
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opponent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Home/Away</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {games?.map((game) => (
                <tr key={game.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{game.opponent}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDateTime(game.datetime)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatHomeAway(game.homeAway)}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(game.status)}`}>
                      {game.status.charAt(0) + game.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateGameModal
        seasonId={seasonId}
        schoolId={schoolId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
