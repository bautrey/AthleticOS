// frontend/src/components/priority-rules/PriorityComparisonCard.tsx
import type { CompareResult } from '../../api/priorityRules';
import { PriorityScoreBreakdown } from './PriorityScoreBreakdown';

interface PriorityComparisonCardProps {
  result: CompareResult;
  eventALabel?: string;
  eventBLabel?: string;
  onOverride?: () => void;
}

export function PriorityComparisonCard({
  result,
  eventALabel = 'Event A',
  eventBLabel = 'Event B',
  onOverride,
}: PriorityComparisonCardProps) {
  const { eventA, eventB, winner, margin, explanation, suggestion } = result;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Priority Comparison</h3>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
        {/* Event A */}
        <div className={`p-4 ${winner === 'eventA' ? 'bg-green-50' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            {winner === 'eventA' && (
              <span className="flex-shrink-0 w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                &#10003;
              </span>
            )}
            <h4 className="text-sm font-semibold text-gray-900">{eventALabel}</h4>
            {winner === 'eventA' && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                Higher Priority
              </span>
            )}
          </div>
          <PriorityScoreBreakdown
            score={eventA.score}
            breakdown={eventA.breakdown}
            compact
          />
        </div>

        {/* Event B */}
        <div className={`p-4 ${winner === 'eventB' ? 'bg-green-50' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            {winner === 'eventB' && (
              <span className="flex-shrink-0 w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                &#10003;
              </span>
            )}
            <h4 className="text-sm font-semibold text-gray-900">{eventBLabel}</h4>
            {winner === 'eventB' && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                Higher Priority
              </span>
            )}
          </div>
          <PriorityScoreBreakdown
            score={eventB.score}
            breakdown={eventB.breakdown}
            compact
          />
        </div>
      </div>

      {/* Recommendation footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm text-gray-700">{explanation}</p>
            {margin > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Margin: {margin} points
              </p>
            )}
            <p className="text-sm text-gray-600 mt-1 italic">{suggestion}</p>
          </div>
          {onOverride && (
            <button
              onClick={onOverride}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-md hover:bg-gray-100 text-gray-700"
            >
              Override
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
