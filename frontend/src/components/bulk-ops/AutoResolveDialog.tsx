// frontend/src/components/bulk-ops/AutoResolveDialog.tsx
import { useState } from 'react';
import { useAutoResolve } from '../../hooks/useBulkOps';
import type { AutoResolveResult } from '../../api/bulkOps';

interface Props {
  schoolId: string;
  onClose: () => void;
}

export function AutoResolveDialog({ schoolId, onClose }: Props) {
  const [confidenceThreshold, setConfidenceThreshold] = useState<'high' | 'medium' | 'low'>('high');
  const [scope, setScope] = useState<'all' | 'facility' | 'blocker'>('all');
  const [preview, setPreview] = useState<AutoResolveResult | null>(null);

  const mutation = useAutoResolve(schoolId);

  const handlePreview = async () => {
    const result = await mutation.mutateAsync({
      confidenceThreshold, scope, dryRun: true,
    });
    setPreview(result);
  };

  const handleExecute = async () => {
    await mutation.mutateAsync({
      confidenceThreshold, scope, dryRun: false,
    });
    onClose();
  };

  const confidenceColors: Record<string, string> = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-red-100 text-red-700',
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Auto-Resolve Conflicts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Automatically resolve conflicts based on priority scoring confidence. Higher thresholds are safer.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confidence Threshold</label>
              <select value={confidenceThreshold} onChange={(e) => setConfidenceThreshold(e.target.value as any)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                <option value="high">High only (safest)</option>
                <option value="medium">Medium and above</option>
                <option value="low">All confidence levels</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
              <select value={scope} onChange={(e) => setScope(e.target.value as any)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                <option value="all">All Conflicts</option>
                <option value="facility">Facility Only</option>
                <option value="blocker">Blocker Only</option>
              </select>
            </div>
          </div>

          {mutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              {(mutation.error as any)?.response?.data?.error?.message || 'Operation failed'}
            </div>
          )}

          {preview && (
            <div className="border border-gray-200 rounded-lg">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 text-sm font-medium text-gray-700">
                {preview.count === 0
                  ? 'No conflicts match the selected criteria.'
                  : `Found ${preview.count} conflict${preview.count !== 1 ? 's' : ''} that can be auto-resolved`}
              </div>
              {preview.conflicts.length > 0 && (
                <div className="max-h-48 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Event</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Confidence</th>
                        <th className="px-3 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.conflicts.map((c) => (
                        <tr key={c.eventId}>
                          <td className="px-3 py-2">{c.teamName} ({c.eventType})</td>
                          <td className="px-3 py-2 text-gray-500">
                            {new Date(c.datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-3 py-2">
                            {c.suggestion && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${confidenceColors[c.suggestion.confidence]}`}>
                                {c.suggestion.confidence}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{c.suggestion?.action || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handlePreview} disabled={mutation.isPending}
            className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700 disabled:opacity-50">
            {mutation.isPending ? 'Loading...' : 'Preview'}
          </button>
          {preview && preview.count > 0 && (
            <button onClick={handleExecute} disabled={mutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
              Resolve {preview.count} Conflict{preview.count !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
