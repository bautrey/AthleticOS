// frontend/src/components/CreatePracticeModal.tsx
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { practicesApi } from '../api/practices';
import { facilitiesApi } from '../api/facilities';

interface CreatePracticeModalProps {
  seasonId: string;
  schoolId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePracticeModal({ seasonId, schoolId, isOpen, onClose }: CreatePracticeModalProps) {
  const [datetime, setDatetime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [facilityId, setFacilityId] = useState('');
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: facilities } = useQuery({
    queryKey: ['facilities', schoolId],
    queryFn: () => facilitiesApi.list(schoolId),
    enabled: isOpen,
  });

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof practicesApi.create>[1]) =>
      practicesApi.create(seasonId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practices', seasonId] });
      onClose();
      resetForm();
    },
  });

  const resetForm = () => {
    setDatetime('');
    setDurationMinutes(90);
    setFacilityId('');
    setNotes('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      datetime: new Date(datetime).toISOString(),
      durationMinutes,
      facilityId: facilityId || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule Practice">
      <form onSubmit={handleSubmit} className="space-y-4">
        {mutation.error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
            {mutation.error instanceof Error ? mutation.error.message : 'Failed to create practice'}
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
            {mutation.isPending ? 'Scheduling...' : 'Schedule Practice'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
