// frontend/src/components/facility-requests/RequestQueue.tsx
import { useState } from 'react';
import { useFacilityRequests, useUpdateRequestStatus } from '../../hooks/useFacilityRequests';
import type { FacilityRequest } from '../../api/facilityRequests';

interface Props {
  schoolId: string;
  canReview: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  DENIED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

export function RequestQueue({ schoolId, canReview }: Props) {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const { data, isLoading } = useFacilityRequests(schoolId, {
    status: statusFilter || undefined,
    page,
    limit: 20,
  });

  const updateMutation = useUpdateRequestStatus(schoolId);

  const handleAction = async (requestId: string, status: 'APPROVED' | 'DENIED') => {
    await updateMutation.mutateAsync({
      requestId,
      status,
      reviewNotes: reviewNotes[requestId],
    });
    setReviewNotes((prev) => {
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
  };

  if (isLoading) {
    return <div className="text-gray-500 text-center py-8">Loading requests...</div>;
  }

  const requests = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Facility Requests</h3>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="DENIED">Denied</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {requests.length === 0 ? (
        <div className="p-8 text-center text-gray-500 text-sm">No facility requests found.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {requests.map((req: FacilityRequest) => (
            <div key={req.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-800 text-sm">{req.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[req.status]}`}>
                      {req.status}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {req.type}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 space-x-3">
                    <span>{req.facility.name}</span>
                    <span>{new Date(req.requestedDate).toLocaleDateString()}</span>
                    <span>{req.startTime} - {req.endTime}</span>
                    <span>by {req.requester.name || req.requester.email}</span>
                  </div>
                  {req.description && (
                    <p className="text-xs text-gray-600 mt-1 truncate">{req.description}</p>
                  )}
                  {req.reviewNotes && (
                    <p className="text-xs text-gray-500 mt-1 italic">Review: {req.reviewNotes}</p>
                  )}
                </div>

                {canReview && req.status === 'PENDING' && (
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleAction(req.id, 'APPROVED')}
                        disabled={updateMutation.isPending}
                        className="bg-green-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(req.id, 'DENIED')}
                        disabled={updateMutation.isPending}
                        className="bg-red-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        Deny
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Notes (optional)"
                      value={reviewNotes[req.id] || ''}
                      onChange={(e) => setReviewNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                      className="border border-gray-300 rounded px-2 py-1 text-xs w-40"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="p-4 border-t border-gray-200 flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Page {meta.page} of {meta.totalPages} ({meta.total} total)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= meta.totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
