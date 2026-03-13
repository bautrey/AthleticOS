// frontend/src/components/conflicts/ConflictRow.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ConflictListItem } from '../../api/conflicts';
import { ConflictDetailPanel } from './ConflictDetailPanel';
import { ConflictWarningModal } from './ConflictWarningModal';
import { SuggestionBadge } from './SuggestionBadge';
import { useCreateConflictOverride } from '../../hooks/useConflicts';

interface ConflictRowProps {
  item: ConflictListItem;
  schoolId: string;
  isSelected?: boolean;
  onSelectToggle?: (id: string) => void;
  onNextConflict?: () => void;
  onPrevConflict?: () => void;
  isDetailOpen?: boolean;
  onOpenDetail?: () => void;
  onCloseDetail?: () => void;
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export function ConflictRow({
  item,
  schoolId,
  isSelected,
  onSelectToggle,
  onNextConflict,
  onPrevConflict,
  isDetailOpen,
  onOpenDetail,
  onCloseDetail,
}: ConflictRowProps) {
  const [localShowDetail, setLocalShowDetail] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const overrideMutation = useCreateConflictOverride();

  // Support both controlled (from parent) and uncontrolled (local) detail panel
  const showDetail = isDetailOpen !== undefined ? isDetailOpen : localShowDetail;
  const setShowDetail = onOpenDetail && onCloseDetail
    ? (open: boolean) => { open ? onOpenDetail() : onCloseDetail(); }
    : setLocalShowDetail;

  const handleOverride = (reason?: string) => {
    // Override all conflicts for this event
    for (const conflict of item.conflicts) {
      overrideMutation.mutate({
        eventType: item.type === 'game' ? 'GAME' : 'PRACTICE',
        eventId: item.id,
        blockerId: conflict.blockerId,
        reason,
      });
    }
    setShowOverride(false);
  };

  const isOverridden = item.overrideCount >= item.conflicts.length;

  return (
    <>
      <tr
        className={`border-b border-gray-100 hover:bg-gray-100 cursor-pointer transition-colors ${isOverridden ? 'opacity-60' : ''}`}
        onClick={() => setShowDetail(true)}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowDetail(true); } }}
        role="button"
        aria-label={`View conflict details for ${item.teamName} ${item.type}`}
      >
        {onSelectToggle && (
          <td className="px-4 py-3">
            <input
              type="checkbox"
              checked={isSelected ?? false}
              onChange={() => onSelectToggle(`${item.type}-${item.id}`)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </td>
        )}
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            item.type === 'game' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
          }`}>
            {item.type === 'game' ? 'Game' : 'Practice'}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="font-medium text-gray-900">{item.teamName}</div>
          <div className="text-xs text-gray-500">{item.teamLevel}</div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">
          {formatDate(item.datetime)}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">
          {item.type === 'game' && item.opponent ? `vs ${item.opponent}` : '-'}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">
          {item.facilityName ?? '-'}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {item.conflicts.length} conflict{item.conflicts.length !== 1 ? 's' : ''}
            </span>
            {/* T-031: Conflict type indicator */}
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
              BLOCKER
            </span>
            {item.suggestion && <SuggestionBadge suggestion={item.suggestion} />}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-2">
            <Link
              to={`/schools/${schoolId}/seasons/${item.seasonId}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Reschedule
            </Link>
            {!isOverridden && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowOverride(true); }}
                className="text-xs text-amber-600 hover:text-amber-800"
              >
                Override
              </button>
            )}
            {isOverridden && (
              <span className="text-xs text-green-600">Overridden</span>
            )}
          </div>
        </td>
      </tr>

      <ConflictDetailPanel
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        event={{
          type: item.type,
          id: item.id,
          datetime: item.datetime,
          opponent: item.opponent,
          teamName: item.teamName,
          teamLevel: item.teamLevel,
          seasonId: item.seasonId,
          facilityName: item.facilityName,
          facilityId: item.facilityId,
        }}
        conflicts={item.conflicts}
        schoolId={schoolId}
        onNextConflict={onNextConflict}
        onPrevConflict={onPrevConflict}
      />

      <ConflictWarningModal
        isOpen={showOverride}
        onClose={() => setShowOverride(false)}
        onProceed={handleOverride}
        conflicts={item.conflicts}
        eventType={item.type}
      />
    </>
  );
}
