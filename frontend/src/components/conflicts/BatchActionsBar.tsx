// frontend/src/components/conflicts/BatchActionsBar.tsx
import { useState } from 'react';
import type { ConflictListItem } from '../../api/conflicts';
import { useBatchOverride, useCreateConflictOverride } from '../../hooks/useConflicts';

interface BatchActionsBarProps {
  selectedCount: number;
  selectedItems: ConflictListItem[];
  schoolId?: string;
  onClearSelection: () => void;
}

export function BatchActionsBar({
  selectedCount,
  selectedItems,
  onClearSelection,
}: BatchActionsBarProps) {
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [batchResult, setBatchResult] = useState<{ succeeded: number; failed: number } | null>(null);
  const batchOverrideMutation = useBatchOverride();
  const singleOverrideMutation = useCreateConflictOverride();

  if (selectedCount === 0) return null;

  const handleOverrideAll = async () => {
    if (!overrideReason.trim()) return;

    // Build batch override input
    const overrides = selectedItems.flatMap(item =>
      item.conflicts.map(c => ({
        eventType: (item.type === 'game' ? 'GAME' : 'PRACTICE') as 'GAME' | 'PRACTICE',
        eventId: item.id,
        blockerId: c.blockerId,
      }))
    );

    try {
      const result = await batchOverrideMutation.mutateAsync({
        overrides,
        reason: overrideReason,
      });
      setBatchResult(result);
      setOverrideReason('');
      setTimeout(() => {
        setBatchResult(null);
        setShowOverrideModal(false);
        onClearSelection();
      }, 3000);
    } catch {
      // Fallback: do individual overrides
      let succeeded = 0;
      let failed = 0;
      for (const override of overrides) {
        try {
          await singleOverrideMutation.mutateAsync({
            ...override,
            reason: overrideReason,
          });
          succeeded++;
        } catch {
          failed++;
        }
      }
      setBatchResult({ succeeded, failed });
      setOverrideReason('');
      setTimeout(() => {
        setBatchResult(null);
        setShowOverrideModal(false);
        onClearSelection();
      }, 3000);
    }
  };

  const handleApplySuggestions = async () => {
    const highConfidence = selectedItems.filter(
      item => item.suggestion && (item.suggestion.confidence === 'high' || item.suggestion.confidence === 'medium')
    );

    if (highConfidence.length === 0) return;

    let succeeded = 0;
    let failed = 0;

    for (const item of highConfidence) {
      for (const conflict of item.conflicts) {
        try {
          await singleOverrideMutation.mutateAsync({
            eventType: item.type === 'game' ? 'GAME' : 'PRACTICE',
            eventId: item.id,
            blockerId: conflict.blockerId,
            reason: `Auto-applied: ${item.suggestion!.reason}`,
          });
          succeeded++;
        } catch {
          failed++;
        }
      }
    }

    setBatchResult({ succeeded, failed });
    setTimeout(() => {
      setBatchResult(null);
      onClearSelection();
    }, 3000);
  };

  const suggestableCount = selectedItems.filter(
    item => item.suggestion && (item.suggestion.confidence === 'high' || item.suggestion.confidence === 'medium')
  ).length;

  return (
    <>
      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-200 p-4 flex items-center justify-between z-40 shadow-lg">
        <span className="text-sm text-gray-500 font-mono">{selectedCount} selected</span>
        <div className="flex gap-3">
          <button
            onClick={onClearSelection}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900"
          >
            Clear
          </button>
          {suggestableCount > 0 && (
            <button
              onClick={handleApplySuggestions}
              disabled={singleOverrideMutation.isPending}
              className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded font-medium"
            >
              Apply Suggestions ({suggestableCount})
            </button>
          )}
          <button
            onClick={() => setShowOverrideModal(true)}
            className="px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded font-medium"
          >
            Override All
          </button>
        </div>
      </div>

      {/* Batch override modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowOverrideModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Override {selectedCount} Event{selectedCount !== 1 ? 's' : ''}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              This will override all conflicts for the {selectedCount} selected event{selectedCount !== 1 ? 's' : ''}.
              The reason will be logged for all overrides.
            </p>

            {batchResult ? (
              <div className={`p-3 rounded-lg text-sm ${batchResult.failed > 0 ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800'}`}>
                {batchResult.succeeded} override{batchResult.succeeded !== 1 ? 's' : ''} saved
                {batchResult.failed > 0 && `, ${batchResult.failed} failed`}
              </div>
            ) : (
              <>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Reason for override (required)"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowOverrideModal(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleOverrideAll}
                    disabled={!overrideReason.trim() || batchOverrideMutation.isPending}
                    className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded font-medium"
                  >
                    {batchOverrideMutation.isPending ? 'Overriding...' : 'Confirm Override'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
