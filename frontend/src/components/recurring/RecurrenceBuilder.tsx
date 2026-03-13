// frontend/src/components/recurring/RecurrenceBuilder.tsx
import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { seasonsApi } from '../../api/seasons';
import { facilitiesApi } from '../../api/facilities';
import { useCreateRecurring } from '../../hooks/useRecurring';
import { RecurrencePreview } from './RecurrencePreview';
import type { DayOfWeek, RecurringPreview as RecurringPreviewType } from '../../api/recurring';

interface RecurrenceBuilderProps {
  schoolId: string;
  seasonId?: string;
  isOpen: boolean;
  onClose: () => void;
}

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 'MON', label: 'Mon' },
  { key: 'TUE', label: 'Tue' },
  { key: 'WED', label: 'Wed' },
  { key: 'THU', label: 'Thu' },
  { key: 'FRI', label: 'Fri' },
  { key: 'SAT', label: 'Sat' },
  { key: 'SUN', label: 'Sun' },
];

export function RecurrenceBuilder({ schoolId, seasonId: initialSeasonId, isOpen, onClose }: RecurrenceBuilderProps) {
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [startTime, setStartTime] = useState('15:30');
  const [endTime, setEndTime] = useState('17:00');
  const [seasonId, setSeasonId] = useState(initialSeasonId || '');
  const [facilityId, setFacilityId] = useState('');
  const [notes, setNotes] = useState('');
  const [excludeBlockers, setExcludeBlockers] = useState(true);
  const [preview, setPreview] = useState<RecurringPreviewType | null>(null);

  const createMutation = useCreateRecurring(schoolId);

  const { data: seasons } = useQuery({
    queryKey: ['seasons', schoolId],
    queryFn: () => seasonsApi.list(schoolId),
    enabled: isOpen,
  });

  const { data: facilities } = useQuery({
    queryKey: ['facilities', schoolId],
    queryFn: () => facilitiesApi.list(schoolId),
    enabled: isOpen,
  });

  const toggleDay = (day: DayOfWeek) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
    setPreview(null);
  };

  const resetForm = () => {
    setSelectedDays([]);
    setStartTime('15:30');
    setEndTime('17:00');
    setSeasonId(initialSeasonId || '');
    setFacilityId('');
    setNotes('');
    setExcludeBlockers(true);
    setPreview(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const buildInput = (dryRun: boolean) => ({
    seasonId,
    facilityId: facilityId || undefined,
    days: selectedDays,
    startTime,
    endTime,
    notes: notes || undefined,
    excludeBlockers,
    dryRun,
  });

  const handlePreview = async (e: FormEvent) => {
    e.preventDefault();
    const result = await createMutation.mutateAsync(buildInput(true));
    setPreview(result);
  };

  const handleCreate = async () => {
    const result = await createMutation.mutateAsync(buildInput(false));
    if (result.practices) {
      handleClose();
    }
  };

  const isValid = selectedDays.length > 0 && seasonId && startTime && endTime;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Recurring Practices" size="lg">
      <form onSubmit={handlePreview} className="space-y-4">
        {createMutation.error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
            {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create recurring practices'}
          </div>
        )}

        {/* Season selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Season</label>
          <select
            value={seasonId}
            onChange={(e) => { setSeasonId(e.target.value); setPreview(null); }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select a season...</option>
            {seasons?.map(s => (
              <option key={s.id} value={s.id}>
                {s.teamName} - {s.name} ({s.year})
              </option>
            ))}
          </select>
        </div>

        {/* Day of week checkboxes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Days of Week</label>
          <div className="flex gap-2">
            {DAYS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleDay(key)}
                className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                  selectedDays.includes(key)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Time inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => { setStartTime(e.target.value); setPreview(null); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => { setEndTime(e.target.value); setPreview(null); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {/* Facility selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Facility (optional)</label>
          <select
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a facility...</option>
            {facilities?.map(f => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.type.toLowerCase()})
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Regular practice schedule"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Exclude blockers checkbox */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={excludeBlockers}
            onChange={(e) => { setExcludeBlockers(e.target.checked); setPreview(null); }}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-gray-700">Exclude blocker dates (holidays, closures, etc.)</span>
        </label>

        {/* Preview results */}
        {preview && <RecurrencePreview preview={preview} />}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          {!preview ? (
            <button
              type="submit"
              disabled={!isValid || createMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Generating...' : 'Preview'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              disabled={preview.totalOk === 0 || createMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : `Create ${preview.totalOk} Practices`}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
