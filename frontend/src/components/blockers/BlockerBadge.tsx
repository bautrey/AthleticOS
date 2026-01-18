// frontend/src/components/blockers/BlockerBadge.tsx
import type { BlockerType } from '../../api/blockers';
import { BlockerTypeIcon, BLOCKER_TYPE_LABELS } from './BlockerTypeIcon';

const BLOCKER_TYPE_BG_COLORS: Record<BlockerType, string> = {
  EXAM: 'bg-purple-100 text-purple-800',
  MAINTENANCE: 'bg-orange-100 text-orange-800',
  EVENT: 'bg-blue-100 text-blue-800',
  TRAVEL: 'bg-green-100 text-green-800',
  HOLIDAY: 'bg-red-100 text-red-800',
  WEATHER: 'bg-cyan-100 text-cyan-800',
  CUSTOM: 'bg-gray-100 text-gray-800',
};

interface BlockerBadgeProps {
  type: BlockerType;
  showLabel?: boolean;
}

export function BlockerBadge({ type, showLabel = true }: BlockerBadgeProps) {
  const colorClass = BLOCKER_TYPE_BG_COLORS[type];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${colorClass}`}>
      <BlockerTypeIcon type={type} className="h-3.5 w-3.5" />
      {showLabel && BLOCKER_TYPE_LABELS[type]}
    </span>
  );
}
