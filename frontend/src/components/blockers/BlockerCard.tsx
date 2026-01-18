// frontend/src/components/blockers/BlockerCard.tsx
import type { Blocker, BlockerScope } from '../../api/blockers';
import { BlockerBadge } from './BlockerBadge';

const SCOPE_LABELS: Record<BlockerScope, string> = {
  SCHOOL_WIDE: 'School-wide',
  TEAM: 'Team',
  FACILITY: 'Facility',
};

const SCOPE_COLORS: Record<BlockerScope, string> = {
  SCHOOL_WIDE: 'bg-indigo-100 text-indigo-800',
  TEAM: 'bg-emerald-100 text-emerald-800',
  FACILITY: 'bg-amber-100 text-amber-800',
};

const formatDateRange = (start: string, end: string): string => {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const startFormatted = startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const endFormatted = endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (startFormatted === endFormatted) {
    return startFormatted;
  }

  return `${startFormatted} - ${endFormatted}`;
};

interface BlockerCardProps {
  blocker: Blocker;
  onClick?: () => void;
  teamName?: string;
  facilityName?: string;
}

export function BlockerCard({ blocker, onClick, teamName, facilityName }: BlockerCardProps) {
  const scopeLabel = SCOPE_LABELS[blocker.scope];
  const scopeColor = SCOPE_COLORS[blocker.scope];

  // Get the specific entity name for Team/Facility scopes
  const entityName = blocker.scope === 'TEAM' ? teamName : blocker.scope === 'FACILITY' ? facilityName : null;

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-lg p-4 ${onClick ? 'cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <BlockerBadge type={blocker.type} />
            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${scopeColor}`}>
              {scopeLabel}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 truncate">{blocker.name}</h3>
          {blocker.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{blocker.description}</p>
          )}
          {entityName && (
            <p className="text-xs text-gray-400 mt-1">{entityName}</p>
          )}
        </div>
        <div className="text-right text-sm text-gray-500 whitespace-nowrap">
          {formatDateRange(blocker.startDatetime, blocker.endDatetime)}
        </div>
      </div>
    </div>
  );
}
