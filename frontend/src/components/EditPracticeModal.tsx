// frontend/src/components/EditPracticeModal.tsx
import { useState, useEffect, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { practicesApi, type Practice } from '../api/practices';
import { facilitiesApi } from '../api/facilities';

interface EditPracticeModalProps {
  practice: Practice;
  schoolId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function EditPracticeModal({ practice, schoolId, isOpen, onClose }: EditPracticeModalProps) {
  const [datetime, setDatetime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(practice.durationMinutes);
  const [facilityId, setFacilityId] = useState(practice.facilityId || '');
  const [notes, setNotes] = useState(practice.notes || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const queryClient = useQueryClient();

  // Format datetime for input on mount/practice change
  useEffect(() => {
    if (practice.datetime) {
      const date = new Date(practice.datetime);
      // Format as YYYY-MM-DDTHH:mm for datetime-local input
      const formatted = date.toISOString().slice(0, 16);
      setDatetime(formatted);
    }
    setDurationMinutes(practice.durationMinutes);
    setFacilityId(practice.facilityId || '');
    setNotes(practice.notes || '');
  }, [practice]);

  const { data: facilities } = useQuery({
    queryKey: ['facilities', schoolId],
    queryFn: () => facilitiesApi.list(schoolId),
    enabled: isOpen,
  });

  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof practicesApi.update>[1]) =>
      practicesApi.update(practice.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practices', practice.seasonId] });
      queryClient.invalidateQueries({ queryKey: ['season-conflicts', practice.seasonId] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => practicesApi.delete(practice.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practices', practice.seasonId] });
      queryClient.invalidateQueries({ queryKey: ['season-conflicts', practice.seasonId] });
      onClose();
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      datetime: new Date(datetime).toISOString(),
      durationMinutes,
      facilityId: facilityId || undefined,
      notes: notes || undefined,
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const isPending = updateMutation.isPending || deleteMutation.isPending;

  const formatDateForDisplay = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Practice">
      {showDeleteConfirm ? (
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete this practice scheduled for <strong>{formatDateForDisplay(practice.datetime)}</strong>? This action cannot be undone.
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
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Practice'}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {(updateMutation.error || deleteMutation.error) && (
            <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
              {updateMutation.error instanceof Error ? updateMutation.error.message :
               deleteMutation.error instanceof Error ? deleteMutation.error.message :
               'Failed to update practice'}
            </div>
          )}
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
              Duration (minutes)
            </label>
            <input
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 0)}
              min={15}
              max={480}
              step={15}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Common durations: 60, 90, 120 minutes
            </p>
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
              placeholder="e.g., Focus on defensive drills, bring equipment..."
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
