// frontend/src/components/facility-requests/FacilityRequestForm.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { facilitiesApi } from '../../api/facilities';
import { useCreateFacilityRequest } from '../../hooks/useFacilityRequests';

interface Props {
  schoolId: string;
}

export function FacilityRequestForm({ schoolId }: Props) {
  const [facilityId, setFacilityId] = useState('');
  const [type, setType] = useState('BOOKING');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities', schoolId],
    queryFn: () => facilitiesApi.list(schoolId),
    enabled: !!schoolId,
  });

  const createMutation = useCreateFacilityRequest(schoolId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflicts([]);
    setSuccess(false);

    try {
      const result = await createMutation.mutateAsync({
        facilityId,
        type,
        title,
        description: description || undefined,
        requestedDate,
        startTime,
        endTime,
      });
      if (result.conflicts && result.conflicts.length > 0) {
        setConflicts(result.conflicts);
      }
      setSuccess(true);
      setTitle('');
      setDescription('');
      setRequestedDate('');
      setStartTime('');
      setEndTime('');
    } catch {
      // Error handled by mutation state
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">New Facility Request</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Facility</label>
          <select
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">Select facility...</option>
            {facilities.map((f: any) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="BOOKING">Booking</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="SETUP">Setup</option>
            <option value="TEARDOWN">Teardown</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          placeholder="e.g., Youth Soccer Tournament"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={2000}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            value={requestedDate}
            onChange={(e) => setRequestedDate(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
          <p className="text-sm font-medium text-amber-800 mb-1">Scheduling conflicts detected:</p>
          <ul className="text-sm text-amber-700 list-disc list-inside">
            {conflicts.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
          <p className="text-xs text-amber-600 mt-1">Request was submitted but may need review.</p>
        </div>
      )}

      {success && conflicts.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-700">
          Request submitted successfully!
        </div>
      )}

      {createMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {(createMutation.error as any)?.response?.data?.error?.message || 'Failed to submit request'}
        </div>
      )}

      <button
        type="submit"
        disabled={createMutation.isPending}
        className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
      </button>
    </form>
  );
}
