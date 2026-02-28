// frontend/src/components/conflicts/SuggestionBadge.tsx
import type { ConflictSuggestion } from '../../api/conflicts';

interface SuggestionBadgeProps {
  suggestion: ConflictSuggestion;
}

const confidenceColors = {
  high: 'bg-green-100 text-green-700 border-green-300',
  medium: 'bg-amber-100 text-amber-700 border-amber-300',
  low: 'bg-gray-100 text-gray-500 border-gray-300',
};

const confidenceLabels = {
  high: 'Suggested',
  medium: 'Review',
  low: 'Manual',
};

export function SuggestionBadge({ suggestion }: SuggestionBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${confidenceColors[suggestion.confidence]}`}
      title={suggestion.reason}
    >
      <span className="font-medium">{confidenceLabels[suggestion.confidence]}:</span>
      <span className="truncate max-w-[120px]">
        {suggestion.action === 'override' ? 'Override' : suggestion.action === 'manual_review' ? 'Review needed' : 'Reschedule'}
      </span>
      {suggestion.eventScore > 0 && (
        <span className="text-[10px] opacity-75">({suggestion.eventScore})</span>
      )}
    </span>
  );
}
