// frontend/src/components/CreateFacilityModal.tsx
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { facilitiesApi, type Facility } from '../api/facilities';

interface CreateFacilityModalProps {
  schoolId: string;
  isOpen: boolean;
  onClose: () => void;
}

const FACILITY_TYPES: Facility['type'][] = ['GYM', 'FIELD', 'POOL', 'COURT', 'TRACK', 'OTHER'];

export function CreateFacilityModal({ schoolId, isOpen, onClose }: CreateFacilityModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<Facility['type']>('FIELD');
  const [capacity, setCapacity] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof facilitiesApi.create>[1]) =>
      facilitiesApi.create(schoolId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities', schoolId] });
      onClose();
      setName('');
      setCapacity('');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      name,
      type,
      capacity: capacity ? parseInt(capacity, 10) : undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Facility">
      <form onSubmit={handleSubmit} className="space-y-4">
        {mutation.error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
            {mutation.error instanceof Error ? mutation.error.message : 'Failed to create facility'}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Facility Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Main Gymnasium"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Facility['type'])}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {FACILITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Capacity (optional)
          </label>
          <input
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="e.g., 500"
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
            {mutation.isPending ? 'Adding...' : 'Add Facility'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
