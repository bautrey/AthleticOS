// frontend/src/components/blockers/BlockerForm.tsx
import { useState, useEffect, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import {
  blockersApi,
  type Blocker,
  type BlockerType,
  type BlockerScope,
  type CreateBlockerInput,
  type UpdateBlockerInput,
} from '../../api/blockers';
import { teamsApi } from '../../api/teams';
import { facilitiesApi } from '../../api/facilities';
import { BlockerTypeIcon, BLOCKER_TYPE_LABELS } from './BlockerTypeIcon';

const BLOCKER_TYPES: BlockerType[] = ['EXAM', 'MAINTENANCE', 'EVENT', 'TRAVEL', 'HOLIDAY', 'WEATHER', 'CUSTOM'];
const BLOCKER_SCOPES: BlockerScope[] = ['SCHOOL_WIDE', 'TEAM', 'FACILITY'];

const SCOPE_LABELS: Record<BlockerScope, string> = {
  SCHOOL_WIDE: 'School-wide',
  TEAM: 'Specific Team',
  FACILITY: 'Specific Facility',
};

interface BlockerFormProps {
  schoolId: string;
  isOpen: boolean;
  onClose: () => void;
  blocker?: Blocker | null;
  onSuccess?: (conflictCount: number) => void;
}

// Format datetime for input element (local time)
const formatDatetimeForInput = (isoString: string): string => {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export function BlockerForm({ schoolId, isOpen, onClose, blocker, onSuccess }: BlockerFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!blocker;

  // Form state
  const [type, setType] = useState<BlockerType>('EXAM');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<BlockerScope>('SCHOOL_WIDE');
  const [teamId, setTeamId] = useState('');
  const [facilityId, setFacilityId] = useState('');
  const [startDatetime, setStartDatetime] = useState('');
  const [endDatetime, setEndDatetime] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load teams and facilities
  const { data: teams } = useQuery({
    queryKey: ['teams', schoolId],
    queryFn: () => teamsApi.list(schoolId),
    enabled: isOpen,
  });

  const { data: facilities } = useQuery({
    queryKey: ['facilities', schoolId],
    queryFn: () => facilitiesApi.list(schoolId),
    enabled: isOpen,
  });

  // Reset form when opening/closing or when blocker changes
  useEffect(() => {
    if (isOpen) {
      if (blocker) {
        setType(blocker.type);
        setName(blocker.name);
        setDescription(blocker.description || '');
        setScope(blocker.scope);
        setTeamId(blocker.teamId || '');
        setFacilityId(blocker.facilityId || '');
        setStartDatetime(formatDatetimeForInput(blocker.startDatetime));
        setEndDatetime(formatDatetimeForInput(blocker.endDatetime));
      } else {
        resetForm();
      }
      setValidationError(null);
    }
  }, [isOpen, blocker]);

  const resetForm = () => {
    setType('EXAM');
    setName('');
    setDescription('');
    setScope('SCHOOL_WIDE');
    setTeamId('');
    setFacilityId('');
    setStartDatetime('');
    setEndDatetime('');
    setValidationError(null);
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (input: CreateBlockerInput) => blockersApi.create(schoolId, input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['blockers', schoolId] });
      onClose();
      resetForm();
      onSuccess?.(result.meta.conflictingEvents.total);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBlockerInput }) =>
      blockersApi.update(schoolId, id, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['blockers', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['blockers', schoolId, blocker?.id] });
      onClose();
      resetForm();
      onSuccess?.(result.meta.conflictingEvents.total);
    },
  });

  const mutation = isEditing ? updateMutation : createMutation;

  // Client-side validation
  const validate = (): boolean => {
    if (!name.trim()) {
      setValidationError('Name is required');
      return false;
    }
    if (name.length > 100) {
      setValidationError('Name must be 100 characters or less');
      return false;
    }
    if (description.length > 500) {
      setValidationError('Description must be 500 characters or less');
      return false;
    }
    if (!startDatetime) {
      setValidationError('Start date/time is required');
      return false;
    }
    if (!endDatetime) {
      setValidationError('End date/time is required');
      return false;
    }
    if (new Date(endDatetime) <= new Date(startDatetime)) {
      setValidationError('End datetime must be after start datetime');
      return false;
    }
    if (scope === 'TEAM' && !teamId) {
      setValidationError('Please select a team');
      return false;
    }
    if (scope === 'FACILITY' && !facilityId) {
      setValidationError('Please select a facility');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const input = {
      type,
      name: name.trim(),
      description: description.trim() || null,
      scope,
      teamId: scope === 'TEAM' ? teamId : null,
      facilityId: scope === 'FACILITY' ? facilityId : null,
      startDatetime: new Date(startDatetime).toISOString(),
      endDatetime: new Date(endDatetime).toISOString(),
    };

    if (isEditing && blocker) {
      updateMutation.mutate({ id: blocker.id, data: input });
    } else {
      createMutation.mutate(input);
    }
  };

  const error = mutation.error instanceof Error ? mutation.error.message : mutation.error ? 'An error occurred' : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Blocker' : 'Create Blocker'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {(validationError || error) && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
            {validationError || error}
          </div>
        )}

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as BlockerType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="blocker-type"
          >
            {BLOCKER_TYPES.map((t) => (
              <option key={t} value={t}>
                {BLOCKER_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
            <BlockerTypeIcon type={type} className="h-4 w-4" />
            <span>{BLOCKER_TYPE_LABELS[type]}</span>
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Final Exams, Gym Resurfacing"
            maxLength={100}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="blocker-name"
            required
          />
          <div className="text-xs text-gray-400 mt-1">{name.length}/100</div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details about this blocker..."
            maxLength={500}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="text-xs text-gray-400 mt-1">{description.length}/500</div>
        </div>

        {/* Scope */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Scope</label>
          <div className="space-y-2">
            {BLOCKER_SCOPES.map((s) => (
              <label key={s} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value={s}
                  checked={scope === s}
                  onChange={() => setScope(s)}
                  className="text-blue-600 focus:ring-blue-500"
                  data-testid={`scope-${s.toLowerCase().replace('_', '-')}`}
                />
                <span className="text-sm text-gray-700">{SCOPE_LABELS[s]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Team Selector (conditional) */}
        {scope === 'TEAM' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team <span className="text-red-500">*</span>
            </label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a team...</option>
              {teams?.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.sport} - {team.level})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Facility Selector (conditional) */}
        {scope === 'FACILITY' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Facility <span className="text-red-500">*</span>
            </label>
            <select
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a facility...</option>
              {facilities?.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name} ({facility.type.toLowerCase()})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={startDatetime}
              onChange={(e) => setStartDatetime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="start-datetime"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={endDatetime}
              onChange={(e) => setEndDatetime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="end-datetime"
              required
            />
          </div>
        </div>

        {/* Actions */}
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
            data-testid="submit-blocker"
          >
            {mutation.isPending ? 'Saving...' : isEditing ? 'Update Blocker' : 'Create Blocker'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
