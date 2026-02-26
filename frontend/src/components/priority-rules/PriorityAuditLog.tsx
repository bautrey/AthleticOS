// frontend/src/components/priority-rules/PriorityAuditLog.tsx
import { useState } from 'react';
import { usePriorityAudits } from '../../hooks/usePriorityRules';
import { EmptyState } from '../EmptyState';

interface PriorityAuditLogProps {
  schoolId: string;
}

const FIELD_LABELS: Record<string, string> = {
  teamLevelWeight: 'Team Level Weight',
  seasonStatusWeight: 'Season Status Weight',
  eventTypeWeight: 'Event Type Weight',
  homeAwayWeight: 'Home/Away Weight',
  teamLevelScores: 'Team Level Scores',
  seasonStatusScores: 'Season Status Scores',
  eventTypeScores: 'Event Type Scores',
  homeAwayScores: 'Home/Away Scores',
  facilityOverrides: 'Facility Overrides',
};

function formatValue(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export function PriorityAuditLog({ schoolId }: PriorityAuditLogProps) {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: auditsData, isLoading } = usePriorityAudits(schoolId, { page, limit });

  if (isLoading) {
    return <p className="text-gray-500">Loading audit log...</p>;
  }

  const audits = auditsData?.data || [];
  const meta = auditsData?.meta;
  const totalPages = meta?.totalPages || 1;

  if (audits.length === 0) {
    return (
      <EmptyState
        title="No changes recorded"
        description="Changes to priority rules will appear here."
      />
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">User</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Field</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Old Value</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">New Value</th>
            </tr>
          </thead>
          <tbody>
            {audits.map((audit) => (
              <tr key={audit.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-gray-700 whitespace-nowrap">
                  {formatDate(audit.changedAt)}
                </td>
                <td className="py-3 px-4 text-gray-700">
                  {audit.changedByUser?.email || audit.changedBy}
                </td>
                <td className="py-3 px-4 text-gray-900 font-medium">
                  {FIELD_LABELS[audit.fieldChanged] || audit.fieldChanged}
                </td>
                <td className="py-3 px-4">
                  <code className="text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded">
                    {formatValue(audit.oldValue)}
                  </code>
                </td>
                <td className="py-3 px-4">
                  <code className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">
                    {formatValue(audit.newValue)}
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex justify-center items-center gap-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages} ({meta?.total} total)
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
