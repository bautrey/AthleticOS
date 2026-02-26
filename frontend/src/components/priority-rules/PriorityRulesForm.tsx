// frontend/src/components/priority-rules/PriorityRulesForm.tsx
import { useState, useEffect, useCallback, type FormEvent } from 'react';
import type { PriorityRule, UpdatePriorityRulesInput, CalculatePriorityInput } from '../../api/priorityRules';
import { useUpdatePriorityRules, useCalculatePriority } from '../../hooks/usePriorityRules';
import { PriorityScoreBreakdown } from './PriorityScoreBreakdown';

interface PriorityRulesFormProps {
  schoolId: string;
  rules: PriorityRule;
}

type WeightKey = 'teamLevelWeight' | 'seasonStatusWeight' | 'eventTypeWeight' | 'homeAwayWeight';

const WEIGHT_FIELDS: { key: WeightKey; label: string; color: string }[] = [
  { key: 'teamLevelWeight', label: 'Team Level', color: 'bg-blue-500' },
  { key: 'seasonStatusWeight', label: 'Season Status', color: 'bg-green-500' },
  { key: 'eventTypeWeight', label: 'Event Type', color: 'bg-orange-500' },
  { key: 'homeAwayWeight', label: 'Home/Away', color: 'bg-purple-500' },
];

const TEAM_LEVEL_OPTIONS = ['VARSITY', 'JV', 'FRESHMAN'] as const;
const SEASON_STATUS_OPTIONS = ['IN_SEASON', 'OFF_SEASON'] as const;
const EVENT_TYPE_OPTIONS = ['GAME', 'PRACTICE'] as const;
const HOME_AWAY_OPTIONS = ['HOME', 'AWAY', 'NEUTRAL'] as const;

const LABEL_MAP: Record<string, string> = {
  VARSITY: 'Varsity',
  JV: 'JV',
  FRESHMAN: 'Freshman',
  IN_SEASON: 'In-Season',
  OFF_SEASON: 'Off-Season',
  GAME: 'Game',
  PRACTICE: 'Practice',
  HOME: 'Home',
  AWAY: 'Away',
  NEUTRAL: 'Neutral',
};

// Default preview input for live calculation
const DEFAULT_PREVIEW: CalculatePriorityInput = {
  teamLevel: 'VARSITY',
  seasonStatus: 'IN_SEASON',
  eventType: 'GAME',
  homeAway: 'HOME',
};

export function PriorityRulesForm({ schoolId, rules }: PriorityRulesFormProps) {
  // Weight state
  const [weights, setWeights] = useState({
    teamLevelWeight: rules.teamLevelWeight,
    seasonStatusWeight: rules.seasonStatusWeight,
    eventTypeWeight: rules.eventTypeWeight,
    homeAwayWeight: rules.homeAwayWeight,
  });

  // Score state
  const [teamLevelScores, setTeamLevelScores] = useState(
    rules.teamLevelScores as Record<string, number>,
  );
  const [seasonStatusScores, setSeasonStatusScores] = useState(
    rules.seasonStatusScores as Record<string, number>,
  );
  const [eventTypeScores, setEventTypeScores] = useState(
    rules.eventTypeScores as Record<string, number>,
  );
  const [homeAwayScores, setHomeAwayScores] = useState(
    rules.homeAwayScores as Record<string, number>,
  );

  // Preview input state
  const [previewInput, setPreviewInput] = useState<CalculatePriorityInput>(DEFAULT_PREVIEW);

  // UI state
  const [success, setSuccess] = useState(false);

  const updateMutation = useUpdatePriorityRules(schoolId);
  const calculateMutation = useCalculatePriority(schoolId);

  // Sync when rules change from server
  useEffect(() => {
    setWeights({
      teamLevelWeight: rules.teamLevelWeight,
      seasonStatusWeight: rules.seasonStatusWeight,
      eventTypeWeight: rules.eventTypeWeight,
      homeAwayWeight: rules.homeAwayWeight,
    });
    setTeamLevelScores(rules.teamLevelScores as Record<string, number>);
    setSeasonStatusScores(rules.seasonStatusScores as Record<string, number>);
    setEventTypeScores(rules.eventTypeScores as Record<string, number>);
    setHomeAwayScores(rules.homeAwayScores as Record<string, number>);
  }, [rules]);

  // Auto-adjust weights to sum to 100
  const handleWeightChange = useCallback((changedKey: WeightKey, newValue: number) => {
    setWeights((prev) => {
      const clamped = Math.max(0, Math.min(100, newValue));
      const otherKeys = WEIGHT_FIELDS.map((f) => f.key).filter((k) => k !== changedKey);
      const otherSum = otherKeys.reduce((sum, k) => sum + prev[k], 0);
      const remaining = 100 - clamped;

      const next = { ...prev, [changedKey]: clamped };

      if (otherSum === 0) {
        // Distribute remaining equally among others
        const each = Math.floor(remaining / otherKeys.length);
        let leftover = remaining - each * otherKeys.length;
        otherKeys.forEach((k, i) => {
          next[k] = each + (i < leftover ? 1 : 0);
        });
      } else {
        // Proportionally adjust others
        let distributed = 0;
        otherKeys.forEach((k, i) => {
          if (i === otherKeys.length - 1) {
            // Last one gets the remainder to ensure exact sum
            next[k] = remaining - distributed;
          } else {
            const proportion = prev[k] / otherSum;
            const adjusted = Math.round(remaining * proportion);
            next[k] = Math.max(0, adjusted);
            distributed += next[k];
          }
        });
      }

      return next;
    });
  }, []);

  // Trigger live preview calculation
  const handlePreview = useCallback(() => {
    calculateMutation.mutate(previewInput);
  }, [calculateMutation, previewInput]);

  // Calculate on mount and when preview input changes
  useEffect(() => {
    handlePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewInput]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const input: UpdatePriorityRulesInput = {
      ...weights,
      teamLevelScores: teamLevelScores as UpdatePriorityRulesInput['teamLevelScores'],
      seasonStatusScores: seasonStatusScores as UpdatePriorityRulesInput['seasonStatusScores'],
      eventTypeScores: eventTypeScores as UpdatePriorityRulesInput['eventTypeScores'],
      homeAwayScores: homeAwayScores as UpdatePriorityRulesInput['homeAwayScores'],
      facilityOverrides: {},
    };

    updateMutation.mutate(input, {
      onSuccess: () => {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      },
    });
  };

  const weightsSum = Object.values(weights).reduce((a, b) => a + b, 0);
  const isValid = weightsSum === 100;

  const hasChanges =
    weights.teamLevelWeight !== rules.teamLevelWeight ||
    weights.seasonStatusWeight !== rules.seasonStatusWeight ||
    weights.eventTypeWeight !== rules.eventTypeWeight ||
    weights.homeAwayWeight !== rules.homeAwayWeight ||
    JSON.stringify(teamLevelScores) !== JSON.stringify(rules.teamLevelScores) ||
    JSON.stringify(seasonStatusScores) !== JSON.stringify(rules.seasonStatusScores) ||
    JSON.stringify(eventTypeScores) !== JSON.stringify(rules.eventTypeScores) ||
    JSON.stringify(homeAwayScores) !== JSON.stringify(rules.homeAwayScores);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Status messages */}
      {updateMutation.error && (
        <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
          {updateMutation.error instanceof Error ? updateMutation.error.message : 'Failed to save rules'}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 p-3 rounded text-sm">
          Priority rules saved successfully!
        </div>
      )}

      {/* Weight Sliders Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Factor Weights</h3>
        <p className="text-sm text-gray-500 mb-4">
          Adjust how much each factor contributes to the priority score. Weights must sum to 100.
        </p>

        <div className="space-y-4">
          {WEIGHT_FIELDS.map(({ key, label, color }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor={key} className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${color}`} />
                  {label}
                </label>
                <span className="text-sm font-mono text-gray-600">{weights[key]}</span>
              </div>
              <input
                id={key}
                type="range"
                min={0}
                max={100}
                value={weights[key]}
                onChange={(e) => handleWeightChange(key, parseInt(e.target.value, 10))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          ))}
        </div>

        {/* Sum indicator */}
        <div className={`mt-3 text-sm font-medium ${isValid ? 'text-green-600' : 'text-red-600'}`}>
          Total: {weightsSum} / 100
          {!isValid && ' (must equal 100)'}
        </div>
      </div>

      {/* Score Tables Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Factor Scores</h3>
        <p className="text-sm text-gray-500 mb-4">
          Set the score (0-100) for each value within a factor.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Team Level Scores */}
          <ScoreTable
            title="Team Level"
            color="bg-blue-500"
            options={TEAM_LEVEL_OPTIONS}
            scores={teamLevelScores}
            onChange={setTeamLevelScores}
          />

          {/* Season Status Scores */}
          <ScoreTable
            title="Season Status"
            color="bg-green-500"
            options={SEASON_STATUS_OPTIONS}
            scores={seasonStatusScores}
            onChange={setSeasonStatusScores}
          />

          {/* Event Type Scores */}
          <ScoreTable
            title="Event Type"
            color="bg-orange-500"
            options={EVENT_TYPE_OPTIONS}
            scores={eventTypeScores}
            onChange={setEventTypeScores}
          />

          {/* Home/Away Scores */}
          <ScoreTable
            title="Home/Away"
            color="bg-purple-500"
            options={HOME_AWAY_OPTIONS}
            scores={homeAwayScores}
            onChange={setHomeAwayScores}
          />
        </div>
      </div>

      {/* Live Preview */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Live Preview</h3>
        <p className="text-sm text-gray-500 mb-4">
          Select parameters to preview how a score would be calculated.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label htmlFor="preview-teamLevel" className="block text-xs font-medium text-gray-500 mb-1">Team Level</label>
            <select
              id="preview-teamLevel"
              value={previewInput.teamLevel}
              onChange={(e) => setPreviewInput((prev) => ({ ...prev, teamLevel: e.target.value as CalculatePriorityInput['teamLevel'] }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TEAM_LEVEL_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{LABEL_MAP[opt]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="preview-seasonStatus" className="block text-xs font-medium text-gray-500 mb-1">Season Status</label>
            <select
              id="preview-seasonStatus"
              value={previewInput.seasonStatus}
              onChange={(e) => setPreviewInput((prev) => ({ ...prev, seasonStatus: e.target.value as CalculatePriorityInput['seasonStatus'] }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SEASON_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{LABEL_MAP[opt]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="preview-eventType" className="block text-xs font-medium text-gray-500 mb-1">Event Type</label>
            <select
              id="preview-eventType"
              value={previewInput.eventType}
              onChange={(e) => setPreviewInput((prev) => ({ ...prev, eventType: e.target.value as CalculatePriorityInput['eventType'] }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{LABEL_MAP[opt]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="preview-homeAway" className="block text-xs font-medium text-gray-500 mb-1">Home/Away</label>
            <select
              id="preview-homeAway"
              value={previewInput.homeAway}
              onChange={(e) => setPreviewInput((prev) => ({ ...prev, homeAway: e.target.value as CalculatePriorityInput['homeAway'] }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {HOME_AWAY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{LABEL_MAP[opt]}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePreview}
          className="mb-4 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
        >
          Recalculate Preview
        </button>

        {calculateMutation.data && (
          <PriorityScoreBreakdown
            score={calculateMutation.data.score}
            breakdown={calculateMutation.data.breakdown}
            explanation={calculateMutation.data.explanation}
          />
        )}

        {calculateMutation.isPending && (
          <p className="text-sm text-gray-500">Calculating...</p>
        )}
      </div>

      {/* Submit */}
      <div className="border-t border-gray-200 pt-6">
        <button
          type="submit"
          disabled={updateMutation.isPending || !isValid || !hasChanges}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
        {!isValid && (
          <span className="ml-3 text-sm text-red-500">Weights must sum to 100</span>
        )}
        {isValid && !hasChanges && (
          <span className="ml-3 text-sm text-gray-400">No changes to save</span>
        )}
      </div>
    </form>
  );
}

// Score table sub-component
interface ScoreTableProps {
  title: string;
  color: string;
  options: readonly string[];
  scores: Record<string, number>;
  onChange: (scores: Record<string, number>) => void;
}

function ScoreTable({ title, color, options, scores, onChange }: ScoreTableProps) {
  const handleScoreChange = (key: string, value: number) => {
    const clamped = Math.max(0, Math.min(100, value));
    onChange({ ...scores, [key]: clamped });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
        {title}
      </h4>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 text-gray-500 font-medium">Value</th>
            <th className="text-right py-2 text-gray-500 font-medium">Score</th>
          </tr>
        </thead>
        <tbody>
          {options.map((opt) => (
            <tr key={opt} className="border-b border-gray-50">
              <td className="py-2 text-gray-700">{LABEL_MAP[opt] || opt}</td>
              <td className="py-2 text-right">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={scores[opt] ?? 0}
                  onChange={(e) => handleScoreChange(opt, parseInt(e.target.value, 10) || 0)}
                  className="w-20 text-right px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label={`${LABEL_MAP[opt] || opt} score`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
