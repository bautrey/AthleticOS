// frontend/src/components/CreateSeasonModal.tsx
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { seasonsApi } from '../api/seasons';
import { teamsApi } from '../api/teams';

interface CreateSeasonModalProps {
  schoolId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CreateSeasonModal({ schoolId, isOpen, onClose }: CreateSeasonModalProps) {
  const [teamId, setTeamId] = useState('');
  const [name, setName] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const queryClient = useQueryClient();

  const { data: teams } = useQuery({
    queryKey: ['teams', schoolId],
    queryFn: () => teamsApi.list(schoolId),
    enabled: isOpen,
  });

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof seasonsApi.create>[1]) =>
      seasonsApi.create(schoolId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasons', schoolId] });
      onClose();
      setTeamId('');
      setName('');
      setStartDate('');
      setEndDate('');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate({ teamId, name, year, startDate: `${startDate}T00:00:00Z`, endDate: `${endDate}T00:00:00Z` });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Season">
      <form onSubmit={handleSubmit} className="space-y-4">
        {mutation.error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
            {mutation.error instanceof Error ? mutation.error.message : 'Failed to create season'}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Team
          </label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select a team...</option>
            {teams?.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.sport})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Season Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Fall 2026"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Year
          </label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            min={2000}
            max={2100}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || !teamId}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating...' : 'Create Season'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
