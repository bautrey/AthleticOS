// frontend/src/pages/CalendarFeedsPage.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { calendarFeedsApi, type CreateFeedInput } from '../api/calendarFeeds';
import { teamsApi, type Team } from '../api/teams';
import { Layout } from '../components/Layout';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
    >
      {copied ? 'Copied!' : 'Copy URL'}
    </button>
  );
}

export function CalendarFeedsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [feedType, setFeedType] = useState<'TEAM' | 'USER'>('USER');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [error, setError] = useState('');

  // Get user's first school for team listing
  const schoolId = user?.schools?.[0]?.id;

  const { data: feeds = [], isLoading: feedsLoading } = useQuery({
    queryKey: ['calendar-feeds'],
    queryFn: calendarFeedsApi.list,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams', schoolId],
    queryFn: () => teamsApi.list(schoolId!),
    enabled: !!schoolId && feedType === 'TEAM',
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateFeedInput) => calendarFeedsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-feeds'] });
      setSelectedTeamId('');
      setError('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to create feed');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => calendarFeedsApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-feeds'] });
    },
  });

  const handleCreate = () => {
    if (feedType === 'TEAM' && !selectedTeamId) {
      setError('Please select a team');
      return;
    }
    setError('');
    createMutation.mutate({
      type: feedType,
      teamId: feedType === 'TEAM' ? selectedTeamId : undefined,
    });
  };

  const activeFeeds = feeds.filter((f) => f.isActive);

  return (
    <Layout>
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Calendar Feeds</h1>
        <p className="text-gray-600 mb-8">
          Subscribe to live calendar feeds in Google Calendar, Apple Calendar, or Outlook.
          Events update automatically.
        </p>

        {/* Create New Feed */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Feed</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Feed Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="feedType"
                    value="USER"
                    checked={feedType === 'USER'}
                    onChange={() => setFeedType('USER')}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">All My Schedules</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="feedType"
                    value="TEAM"
                    checked={feedType === 'TEAM'}
                    onChange={() => setFeedType('TEAM')}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Specific Team</span>
                </label>
              </div>
            </div>

            {feedType === 'TEAM' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a team...</option>
                  {teams.map((team: Team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} - {team.sport} ({team.level})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Feed'}
            </button>
          </div>
        </div>

        {/* Existing Feeds */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Your Feeds</h2>
          </div>

          {feedsLoading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : activeFeeds.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No active feeds. Create one above to get started.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {activeFeeds.map((feed) => {
                const icsUrl = calendarFeedsApi.getIcsUrl(feed.token);
                return (
                  <li key={feed.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {feed.type}
                          </span>
                          {feed.team && (
                            <span className="text-sm font-medium text-gray-900">
                              {feed.team.name} - {feed.team.sport}
                            </span>
                          )}
                          {feed.type === 'USER' && (
                            <span className="text-sm font-medium text-gray-900">
                              All Schedules
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="text"
                            readOnly
                            value={icsUrl}
                            className="flex-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-1 font-mono truncate"
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                          />
                          <CopyButton text={icsUrl} />
                        </div>
                        {feed.lastAccessed && (
                          <p className="text-xs text-gray-400 mt-1">
                            Last accessed: {new Date(feed.lastAccessed).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (confirm('Deactivate this feed? Calendar apps will no longer receive updates.')) {
                            deactivateMutation.mutate(feed.id);
                          }
                        }}
                        className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                      >
                        Deactivate
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
}
