// frontend/src/components/EditGameModal.tsx
import { useState, useEffect, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { gamesApi, type Game } from '../api/games';
import { facilitiesApi } from '../api/facilities';

interface EditGameModalProps {
  game: Game;
  schoolId: string;
  isOpen: boolean;
  onClose: () => void;
}

const HOME_AWAY_OPTIONS: Game['homeAway'][] = ['HOME', 'AWAY', 'NEUTRAL'];
const STATUS_OPTIONS: Game['status'][] = ['SCHEDULED', 'CONFIRMED', 'CANCELLED', 'POSTPONED', 'COMPLETED'];

export function EditGameModal({ game, schoolId, isOpen, onClose }: EditGameModalProps) {
  const [opponent, setOpponent] = useState(game.opponent);
  const [datetime, setDatetime] = useState('');
  const [homeAway, setHomeAway] = useState<Game['homeAway']>(game.homeAway);
  const [status, setStatus] = useState<Game['status']>(game.status);
  const [facilityId, setFacilityId] = useState(game.facilityId || '');
  const [notes, setNotes] = useState(game.notes || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const queryClient = useQueryClient();

  // Format datetime for input on mount/game change
  useEffect(() => {
    if (game.datetime) {
      const date = new Date(game.datetime);
      // Format as YYYY-MM-DDTHH:mm for datetime-local input
      const formatted = date.toISOString().slice(0, 16);
      setDatetime(formatted);
    }
    setOpponent(game.opponent);
    setHomeAway(game.homeAway);
    setStatus(game.status);
    setFacilityId(game.facilityId || '');
    setNotes(game.notes || '');
  }, [game]);

  const { data: facilities } = useQuery({
    queryKey: ['facilities', schoolId],
    queryFn: () => facilitiesApi.list(schoolId),
    enabled: isOpen,
  });

  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof gamesApi.update>[1]) =>
      gamesApi.update(game.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games', game.seasonId] });
      queryClient.invalidateQueries({ queryKey: ['season-conflicts', game.seasonId] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => gamesApi.delete(game.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games', game.seasonId] });
      queryClient.invalidateQueries({ queryKey: ['season-conflicts', game.seasonId] });
      onClose();
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      opponent,
      datetime: new Date(datetime).toISOString(),
      homeAway,
      status,
      facilityId: facilityId || undefined,
      notes: notes || undefined,
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const isPending = updateMutation.isPending || deleteMutation.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Game">
      {showDeleteConfirm ? (
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete the game against <strong>{game.opponent}</strong>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              disabled={deleteMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Game'}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {(updateMutation.error || deleteMutation.error) && (
            <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
              {updateMutation.error instanceof Error ? updateMutation.error.message :
               deleteMutation.error instanceof Error ? deleteMutation.error.message :
               'Failed to update game'}
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
          <div className="grid grid-cols-2 gap-4">
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
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Game['status'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option.charAt(0) + option.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
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
          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-md"
              disabled={isPending}
            >
              Delete
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
