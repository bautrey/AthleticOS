// frontend/src/pages/ConflictsPage.tsx
import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ConflictsList } from '../components/conflicts/ConflictsList';
import { BatchActionsBar } from '../components/conflicts/BatchActionsBar';
import { useConflictList } from '../hooks/useConflicts';
import type { BlockerType, ConflictListQuery } from '../api/conflicts';

const BLOCKER_TYPES: { value: BlockerType; label: string }[] = [
  { value: 'EXAM', label: 'Exam' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'EVENT', label: 'Event' },
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'HOLIDAY', label: 'Holiday' },
  { value: 'WEATHER', label: 'Weather' },
  { value: 'CUSTOM', label: 'Custom' },
];

export function ConflictsPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const [query, setQuery] = useState<ConflictListQuery>({
    page: 1,
    limit: 25,
    sortBy: 'datetime',
    sortOrder: 'asc',
    includeSuggestions: true,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeDetailIndex, setActiveDetailIndex] = useState<number | null>(null);

  const { data, isLoading } = useConflictList(schoolId!, query);

  const updateFilter = (updates: Partial<ConflictListQuery>) => {
    setQuery((prev) => ({ ...prev, ...updates, page: 1 }));
    setSelectedIds(new Set());
  };

  const handleSelectToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!data?.data) return;
    const allIds = data.data.map(item => `${item.type}-${item.id}`);
    const allSelected = allIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }, [data?.data, selectedIds]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Get the selected items for batch operations
  const selectedItems = data?.data?.filter(item => selectedIds.has(`${item.type}-${item.id}`)) ?? [];

  return (
    <Layout>
      <div className="mb-6">
        <nav className="text-sm mb-4">
          <Link to="/" className="text-gray-500 hover:text-gray-700">Dashboard</Link>
          <span className="mx-2 text-gray-400">/</span>
          <Link to={`/schools/${schoolId}`} className="text-gray-500 hover:text-gray-700">School</Link>
          <span className="mx-2 text-gray-400">/</span>
          <span className="text-gray-900">Conflicts</span>
        </nav>
        <h1 className="text-2xl font-bold">Conflict Resolution</h1>
        <p className="text-gray-500 mt-1">Review and resolve scheduling conflicts across all events.</p>
      </div>

      {/* Summary Cards */}
      {data?.summary && (
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className={`text-2xl font-semibold ${data.summary.total > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {data.summary.total}
            </div>
            <div className="text-sm text-gray-500">Total Conflicts</div>
          </div>
          {Object.entries(data.summary.byBlockerType).slice(0, 3).map(([type, count]) => (
            <div key={type} className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-semibold text-gray-900">{count}</div>
              <div className="text-sm text-gray-500">{type.replace('_', ' ')}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <select
          value={query.eventType ?? ''}
          onChange={(e) => updateFilter({ eventType: (e.target.value || undefined) as ConflictListQuery['eventType'] })}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md"
        >
          <option value="">All Events</option>
          <option value="game">Games</option>
          <option value="practice">Practices</option>
        </select>

        <select
          value={query.blockerType ?? ''}
          onChange={(e) => updateFilter({ blockerType: (e.target.value || undefined) as BlockerType })}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md"
        >
          <option value="">All Blocker Types</option>
          {BLOCKER_TYPES.map((bt) => (
            <option key={bt.value} value={bt.value}>{bt.label}</option>
          ))}
        </select>

        {/* T-032: Conflict type filter */}
        <select
          value={query.types ?? 'blocker'}
          onChange={(e) => updateFilter({ types: e.target.value })}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md"
        >
          <option value="blocker">Blockers Only</option>
          <option value="facility">Facility Double-Bookings</option>
          <option value="blocker,facility">All Types</option>
        </select>

        <select
          value={query.sortOrder ?? 'asc'}
          onChange={(e) => updateFilter({ sortOrder: e.target.value as 'asc' | 'desc' })}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md"
        >
          <option value="asc">Soonest First</option>
          <option value="desc">Latest First</option>
        </select>
      </div>

      {/* Conflicts List */}
      <div className={`bg-white rounded-lg shadow ${selectedIds.size > 0 ? 'pb-16' : ''}`}>
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading conflicts...</div>
        ) : (
          <>
            <ConflictsList
              items={data?.data ?? []}
              schoolId={schoolId!}
              selectedIds={selectedIds}
              onSelectToggle={handleSelectToggle}
              onSelectAll={handleSelectAll}
              activeDetailIndex={activeDetailIndex}
              onOpenDetail={setActiveDetailIndex}
              onCloseDetail={() => setActiveDetailIndex(null)}
            />

            {/* Pagination */}
            {data?.meta && data.meta.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center text-sm">
                <span className="text-gray-500">
                  Showing {(data.meta.page - 1) * data.meta.limit + 1}-
                  {Math.min(data.meta.page * data.meta.limit, data.meta.total)} of {data.meta.total}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={data.meta.page <= 1}
                    onClick={() => setQuery((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}
                    className="px-3 py-1 border rounded-md disabled:opacity-50 hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={data.meta.page >= data.meta.totalPages}
                    onClick={() => setQuery((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
                    className="px-3 py-1 border rounded-md disabled:opacity-50 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Batch Actions Bar */}
      <BatchActionsBar
        selectedCount={selectedIds.size}
        selectedItems={selectedItems}
        schoolId={schoolId!}
        onClearSelection={handleClearSelection}
      />
    </Layout>
  );
}
