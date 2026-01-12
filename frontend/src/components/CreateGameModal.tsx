// frontend/src/components/CreateGameModal.tsx
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { gamesApi, type Game } from '../api/games';
import { facilitiesApi } from '../api/facilities';

interface CreateGameModalProps {
  seasonId: string;
  schoolId: string;
  isOpen: boolean;
  onClose: () => void;
}

const HOME_AWAY_OPTIONS: Game['homeAway'][] = ['HOME', 'AWAY', 'NEUTRAL'];

export function CreateGameModal({ seasonId, schoolId, isOpen, onClose }: CreateGameModalProps) {
  const [opponent, setOpponent] = useState('');
  const [datetime, setDatetime] = useState('');
  const [homeAway, setHomeAway] = useState<Game['homeAway']>('HOME');
  const [facilityId, setFacilityId] = useState('');
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: facilities } = useQuery({
    queryKey: ['facilities', schoolId],
    queryFn: () => facilitiesApi.list(schoolId),
    enabled: isOpen,
  });

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof gamesApi.create>[1]) =>
      gamesApi.create(seasonId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games', seasonId] });
      onClose();
      resetForm();
    },
  });

  const resetForm = () => {
    setOpponent('');
    setDatetime('');
    setHomeAway('HOME');
    setFacilityId('');
    setNotes('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      opponent,
      datetime: new Date(datetime).toISOString(),
      homeAway,
      facilityId: facilityId || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule Game">
      <form onSubmit={handleSubmit} className="space-y-4">
        {mutation.error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
            {mutation.error instanceof Error ? mutation.error.message : 'Failed to create game'}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Opponent
          </label>
          <input
            type="text"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="e.g., Central High School"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date & Time
          </label>
          <input
            type="datetime-local"
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Home/Away
          </label>
          <select
            value={homeAway}
            onChange={(e) => setHomeAway(e.target.value as Game['homeAway'])}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {HOME_AWAY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0) + option.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Facility (optional)
          </label>
          <select
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a facility...</option>
            {facilities?.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.name} ({facility.type.toLowerCase()})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional information..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
            disabled={mutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Scheduling...' : 'Schedule Game'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
