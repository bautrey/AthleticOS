// frontend/src/components/quick-add/QuickAddPreview.tsx
import type { QuickAddResult } from '../../api/quickAdd';

interface QuickAddPreviewProps {
  result: QuickAddResult;
  onConfirm: () => void;
  onDismiss: () => void;
  onOpenFullForm?: () => void;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  let color = 'bg-red-100 text-red-700';
  let label = 'Low';
  if (confidence >= 0.8) {
    color = 'bg-green-100 text-green-700';
    label = 'High';
  } else if (confidence >= 0.5) {
    color = 'bg-yellow-100 text-yellow-700';
    label = 'Medium';
  }

  return (
    <span className={`text-xs px-2 py-0.5 rounded ${color}`}>
      {label} ({Math.round(confidence * 100)}%)
    </span>
  );
}

function FieldRow({ label, value, ambiguous }: { label: string; value: string | null; ambiguous?: string[] }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500 w-20">{label}:</span>
      {value ? (
        <span className="text-gray-900 font-medium">{value}</span>
      ) : ambiguous && ambiguous.length > 0 ? (
        <select className="text-sm border border-yellow-300 bg-yellow-50 rounded px-2 py-0.5">
          <option value="">Select...</option>
          {ambiguous.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      ) : (
        <span className="text-gray-400 italic">Not detected</span>
      )}
    </div>
  );
}

export function QuickAddPreview({ result, onConfirm, onDismiss, onOpenFullForm }: QuickAddPreviewProps) {
  const { parsed, conflicts } = result;
  const canConfirm = parsed.datetime && parsed.seasonId &&
    (parsed.eventType === 'PRACTICE' || parsed.opponent);

  return (
    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
            parsed.eventType === 'GAME' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
          }`}>
            {parsed.eventType}
          </span>
          <ConfidenceBadge confidence={parsed.confidence} />
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          X
        </button>
      </div>

      {/* Parsed fields */}
      <div className="space-y-1.5">
        <FieldRow label="Day" value={parsed.dayOfWeek} />
        <FieldRow
          label="Time"
          value={parsed.startTime ? `${parsed.startTime}${parsed.endTime ? ` - ${parsed.endTime}` : ''}` : null}
        />
        <FieldRow
          label="Team"
          value={parsed.teamName}
          ambiguous={parsed.teamMatches.map(t => t.name)}
        />
        <FieldRow
          label="Facility"
          value={parsed.facilityName}
          ambiguous={parsed.facilityMatches.map(f => f.name)}
        />
        {parsed.eventType === 'GAME' && (
          <FieldRow label="Opponent" value={parsed.opponent} />
        )}
        {parsed.durationMinutes && (
          <FieldRow label="Duration" value={`${parsed.durationMinutes} min`} />
        )}
      </div>

      {/* Missing fields warning */}
      {parsed.missingFields.length > 0 && (
        <div className="text-xs text-amber-600 bg-amber-50 rounded p-2">
          Missing: {parsed.missingFields.join(', ')}
        </div>
      )}

      {/* Conflicts */}
      {conflicts.hasConflicts && (
        <div className="text-xs text-red-600 bg-red-50 rounded p-2">
          Warning: {(conflicts.conflicts as unknown[]).length} potential conflict(s) detected
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {canConfirm && (
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Confirm
          </button>
        )}
        {parsed.confidence < 0.3 && onOpenFullForm && (
          <button
            onClick={onOpenFullForm}
            className="px-4 py-1.5 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50"
          >
            Open Full Form
          </button>
        )}
        <button
          onClick={onDismiss}
          className="px-4 py-1.5 text-gray-500 text-sm hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
