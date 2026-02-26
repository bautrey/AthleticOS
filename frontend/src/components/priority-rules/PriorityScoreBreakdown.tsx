// frontend/src/components/priority-rules/PriorityScoreBreakdown.tsx
import type { PriorityBreakdown } from '../../api/priorityRules';

interface PriorityScoreBreakdownProps {
  score: number;
  breakdown: PriorityBreakdown;
  explanation?: string;
  compact?: boolean;
}

const FACTOR_CONFIG = [
  { key: 'teamLevel' as const, label: 'Team Level', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50' },
  { key: 'seasonStatus' as const, label: 'Season', color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-50' },
  { key: 'eventType' as const, label: 'Event Type', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50' },
  { key: 'homeAway' as const, label: 'Home/Away', color: 'bg-purple-500', textColor: 'text-purple-700', bgLight: 'bg-purple-50' },
];

export function PriorityScoreBreakdown({ score, breakdown, explanation, compact = false }: PriorityScoreBreakdownProps) {
  const maxScore = 100;

  return (
    <div className={compact ? '' : 'bg-white rounded-lg border border-gray-200 p-4'}>
      {/* Score display */}
      <div className={`flex items-center gap-3 ${compact ? 'mb-2' : 'mb-4'}`}>
        <div className={`${compact ? 'text-2xl' : 'text-3xl'} font-bold text-gray-900`}>
          {score}
        </div>
        <div className="text-sm text-gray-500">/ {maxScore}</div>
      </div>

      {/* Stacked bar */}
      <div className={`w-full ${compact ? 'h-4' : 'h-6'} bg-gray-100 rounded-full overflow-hidden flex`}>
        {FACTOR_CONFIG.map(({ key, color }) => {
          const factor = breakdown[key];
          const widthPercent = maxScore > 0 ? (factor.weighted / maxScore) * 100 : 0;
          if (widthPercent === 0) return null;
          return (
            <div
              key={key}
              className={`${color} transition-all duration-300`}
              style={{ width: `${widthPercent}%` }}
              title={`${FACTOR_CONFIG.find(f => f.key === key)?.label}: ${factor.weighted.toFixed(1)}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className={`grid grid-cols-2 gap-2 ${compact ? 'mt-2' : 'mt-4'}`}>
        {FACTOR_CONFIG.map(({ key, label, color, textColor, bgLight }) => {
          const factor = breakdown[key];
          return (
            <div key={key} className={`flex items-center gap-2 text-xs ${bgLight} rounded px-2 py-1`}>
              <div className={`w-2.5 h-2.5 rounded-full ${color} flex-shrink-0`} />
              <span className={`font-medium ${textColor}`}>{label}</span>
              <span className="text-gray-500 ml-auto">{factor.weighted.toFixed(1)}</span>
            </div>
          );
        })}
      </div>

      {/* Explanation */}
      {explanation && !compact && (
        <p className="mt-3 text-sm text-gray-600 italic">{explanation}</p>
      )}
    </div>
  );
}
