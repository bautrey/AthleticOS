// frontend/src/components/SettingsTab.tsx
import { useState, useEffect, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { schoolsApi, type School } from '../api/schools';

interface SettingsTabProps {
  school: School;
}

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
];

export function SettingsTab({ school }: SettingsTabProps) {
  const [name, setName] = useState(school.name);
  const [timezone, setTimezone] = useState(school.timezone);
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setName(school.name);
    setTimezone(school.timezone);
  }, [school]);

  const mutation = useMutation({
    mutationFn: (input: { name: string; timezone: string }) =>
      schoolsApi.update(school.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school', school.id] });
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate({ name, timezone });
  };

  const hasChanges = name !== school.name || timezone !== school.timezone;

  return (
    <div className="max-w-lg">
      <h2 className="text-lg font-semibold mb-4">School Settings</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mutation.error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
            {mutation.error instanceof Error ? mutation.error.message : 'Failed to update'}
          </div>
        )}
        {success && (
          <div className="bg-green-50 text-green-600 p-3 rounded text-sm">
            Settings saved successfully!
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            School Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={mutation.isPending || !hasChanges}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
