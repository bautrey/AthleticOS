// frontend/src/components/bulk-ops/RainPlanDialog.tsx
import { useState } from 'react';
import { useRainPlan } from '../../hooks/useBulkOps';
import type { RainPlanResult } from '../../api/bulkOps';

interface Props {
  schoolId: string;
  onClose: () => void;
}

export function RainPlanDialog({ schoolId, onClose }: Props) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [preview, setPreview] = useState<RainPlanResult | null>(null);

  const mutation = useRainPlan(schoolId);

  const handlePreview = async () => {
    const result = await mutation.mutateAsync({ fromDate, toDate, dryRun: true });
    setPreview(result);
  };

  const handleExecute = async () => {
    await mutation.mutateAsync({ fromDate, toDate, dryRun: false });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Rain Plan</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Move outdoor events (fields, tracks, courts) to their configured rain fallback facilities.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
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
                  ? preview.message || 'No outdoor events found in this range.'
                  : `Preview: ${preview.count} event${preview.count !== 1 ? 's' : ''} will be moved indoors`}
              </div>
              {preview.moves.length > 0 && (
                <div className="max-h-48 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Event</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">From</th>
                        <th className="px-3 py-2 text-left">To</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.moves.map((m) => (
                        <tr key={m.id}>
                          <td className="px-3 py-2">
                            <span className={`inline-block w-2 h-2 rounded-full mr-1 ${m.type === 'game' ? 'bg-blue-500' : 'bg-green-500'}`} />
                            {m.teamName} {m.opponent ? `vs ${m.opponent}` : m.type}
                          </td>
                          <td className="px-3 py-2 text-gray-500">
                            {new Date(m.datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-3 py-2 text-red-600">{m.originalFacility}</td>
                          <td className="px-3 py-2 text-green-600 font-medium">{m.fallbackFacility}</td>
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
          <button onClick={handlePreview} disabled={!fromDate || !toDate || mutation.isPending}
            className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700 disabled:opacity-50">
            {mutation.isPending ? 'Loading...' : 'Preview'}
          </button>
          {preview && preview.count > 0 && (
            <button onClick={handleExecute} disabled={mutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
              Execute Rain Plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
