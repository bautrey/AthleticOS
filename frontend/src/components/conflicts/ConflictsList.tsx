// frontend/src/components/conflicts/ConflictsList.tsx
import type { ConflictListItem } from '../../api/conflicts';
import { ConflictRow } from './ConflictRow';

interface ConflictsListProps {
  items: ConflictListItem[];
  schoolId: string;
  selectedIds?: Set<string>;
  onSelectToggle?: (id: string) => void;
  onSelectAll?: () => void;
  activeDetailIndex?: number | null;
  onOpenDetail?: (index: number) => void;
  onCloseDetail?: () => void;
}

export function ConflictsList({
  items,
  schoolId,
  selectedIds,
  onSelectToggle,
  onSelectAll,
  activeDetailIndex,
  onOpenDetail,
  onCloseDetail,
}: ConflictsListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-12 h-12 text-green-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900">No conflicts found</h3>
        <p className="text-gray-500 mt-1">All events are clear of scheduling conflicts.</p>
      </div>
    );
  }

  const allSelected = selectedIds && items.length > 0 && items.every(item => selectedIds.has(`${item.type}-${item.id}`));

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            {onSelectToggle && (
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected ?? false}
                  onChange={onSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
            )}
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Team</th>
            <th className="px-4 py-3">Date/Time</th>
            <th className="px-4 py-3">Opponent</th>
            <th className="px-4 py-3">Facility</th>
            <th className="px-4 py-3">Conflicts</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <ConflictRow
              key={`${item.type}-${item.id}`}
              item={item}
              schoolId={schoolId}
              isSelected={selectedIds?.has(`${item.type}-${item.id}`)}
              onSelectToggle={onSelectToggle}
              isDetailOpen={activeDetailIndex === index}
              onOpenDetail={onOpenDetail ? () => onOpenDetail(index) : undefined}
              onCloseDetail={onCloseDetail}
              onNextConflict={
                onOpenDetail && index < items.length - 1
                  ? () => onOpenDetail(index + 1)
                  : undefined
              }
              onPrevConflict={
                onOpenDetail && index > 0
                  ? () => onOpenDetail(index - 1)
                  : undefined
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
