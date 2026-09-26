// frontend/src/components/WeatherPolicyForm.tsx
//
// Where a school states its own heat threshold.
//
// The screen ships with the number blank and stays that way until someone fills it
// in. It offers no suggested value and no placeholder that could be mistaken for
// one. TCA is TAPPS rather than UIL, so the mandatory state limits do not bind them
// and the number is theirs to set; a default we chose would look exactly like one
// their athletic trainer wrote, and would be wrong silently.
//
// The other thing this screen has to carry is that these are forecasts. A
// temperature on a schedule reads as a measurement unless something says otherwise,
// and the reading a heat policy is administered from is taken on the field within
// 15 minutes of practice. That caption is not decoration.

import { useState, useEffect, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  schoolsApi,
  type School,
  type HeatMeasure,
  type WeatherPolicy,
} from '../api/schools';

interface WeatherPolicyFormProps {
  school: School;
}

const DEFAULTS: Omit<WeatherPolicy, 'thresholdF'> = {
  measure: 'WBGT',
  lookaheadDays: 3,
  practiceWindow: { start: '15:00', end: '18:30' },
};

const MEASURES: Array<{ value: HeatMeasure; label: string; help: string }> = [
  {
    value: 'WBGT',
    label: 'Wet bulb globe temperature (WBGT)',
    help: 'Accounts for humidity, wind and sun. This is the measure UIL requires and TAPPS recommends, so it is usually the one a written heat plan is stated in.',
  },
  {
    value: 'HEAT_INDEX',
    label: 'Heat index',
    help: 'Temperature and humidity only. Runs higher than WBGT and is what a consumer weather app shows. Pick this only if your written plan is stated in heat index.',
  },
];

function readPolicy(school: School): WeatherPolicy {
  const stored = school.settings?.weather ?? {};
  return {
    thresholdF: stored.thresholdF ?? null,
    measure: stored.measure ?? DEFAULTS.measure,
    lookaheadDays: stored.lookaheadDays ?? DEFAULTS.lookaheadDays,
    practiceWindow: stored.practiceWindow ?? DEFAULTS.practiceWindow,
  };
}

export function WeatherPolicyForm({ school }: WeatherPolicyFormProps) {
  const [policy, setPolicy] = useState<WeatherPolicy>(() => readPolicy(school));
  const [thresholdText, setThresholdText] = useState(() => {
    const value = readPolicy(school).thresholdF;
    return value === null ? '' : String(value);
  });
  const [latitude, setLatitude] = useState(school.latitude?.toString() ?? '');
  const [longitude, setLongitude] = useState(school.longitude?.toString() ?? '');
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const next = readPolicy(school);
    setPolicy(next);
    setThresholdText(next.thresholdF === null ? '' : String(next.thresholdF));
    setLatitude(school.latitude?.toString() ?? '');
    setLongitude(school.longitude?.toString() ?? '');
  }, [school]);

  const mutation = useMutation({
    mutationFn: () =>
      schoolsApi.update(school.id, {
        latitude: latitude.trim() === '' ? null : Number(latitude),
        longitude: longitude.trim() === '' ? null : Number(longitude),
        settings: {
          ...school.settings,
          weather: {
            ...policy,
            // An empty field means no policy, which is a real state and not a zero.
            thresholdF: thresholdText.trim() === '' ? null : Number(thresholdText),
          },
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school', school.id] });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const hasLocation = latitude.trim() !== '' && longitude.trim() !== '';
  const hasThreshold = thresholdText.trim() !== '';
  const measureHelp = MEASURES.find((m) => m.value === policy.measure)?.help;

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold mb-1">Heat alerts</h2>
      <p className="text-sm text-gray-500 mb-4">
        Warns you days ahead when the forecast for an outdoor practice reaches the
        threshold your school has set, while there is still time to move indoors.
      </p>

      <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3 rounded mb-6">
        These are <strong>forecasts</strong>, for planning. They are not a substitute for
        the on-site reading your heat policy is administered from, which is taken at the
        field shortly before and during practice.
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {mutation.error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
            {mutation.error instanceof Error ? mutation.error.message : 'Failed to save'}
          </div>
        )}
        {success && (
          <div className="bg-green-50 text-green-600 p-3 rounded text-sm">Saved.</div>
        )}

        <fieldset>
          <legend className="text-sm font-medium text-gray-700 mb-1">
            Your threshold
          </legend>
          <p className="text-sm text-gray-500 mb-2">
            The number from your school's own heat plan. We do not supply one: leave this
            blank and nothing is raised, though conditions are still shown.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              min="0"
              max="150"
              value={thresholdText}
              onChange={(e) => setThresholdText(e.target.value)}
              aria-label="Heat threshold in Fahrenheit"
              className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-600">&deg;F</span>
            {!hasThreshold && (
              <span className="text-sm text-gray-500">
                No threshold set, so no alerts will be raised.
              </span>
            )}
          </div>
        </fieldset>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="measure">
            Measured as
          </label>
          <select
            id="measure"
            value={policy.measure}
            onChange={(e) => setPolicy({ ...policy, measure: e.target.value as HeatMeasure })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MEASURES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-500 mt-1">{measureHelp}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="window-start">
              Practice window starts
            </label>
            <input
              id="window-start"
              type="time"
              value={policy.practiceWindow.start}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  practiceWindow: { ...policy.practiceWindow, start: e.target.value },
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="window-end">
              and ends
            </label>
            <input
              id="window-end"
              type="time"
              value={policy.practiceWindow.end}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  practiceWindow: { ...policy.practiceWindow, end: e.target.value },
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <p className="text-sm text-gray-500 -mt-4">
          Only the hottest part of this window counts, in {school.timezone}.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="lookahead">
            Warn this many days ahead
          </label>
          <input
            id="lookahead"
            type="number"
            min="1"
            max="7"
            value={policy.lookaheadDays}
            onChange={(e) => setPolicy({ ...policy, lookaheadDays: Number(e.target.value) })}
            className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            Three days gives you time to rebook a gym and tell parents. A forecast a week
            out is soft enough that people stop trusting it.
          </p>
        </div>

        <fieldset className="border-t pt-4">
          <legend className="text-sm font-medium text-gray-700 mb-1">Where you are</legend>
          <p className="text-sm text-gray-500 mb-2">
            Needed to look up the forecast. Without it no alerts can be raised at all.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              step="0.0001"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="Latitude"
              aria-label="Latitude"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              step="0.0001"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="Longitude"
              aria-label="Longitude"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {!hasLocation && (
            <p className="text-sm text-amber-700 mt-2">
              No location set, so this school is skipped by the forecast.
            </p>
          )}
        </fieldset>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving...' : 'Save heat policy'}
        </button>
      </form>
    </div>
  );
}
