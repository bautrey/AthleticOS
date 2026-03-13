// frontend/src/components/recurring/RecurrencePreview.tsx
import type { RecurringPreview } from '../../api/recurring';

interface RecurrencePreviewProps {
  preview: RecurringPreview;
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export function RecurrencePreview({ preview }: RecurrencePreviewProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm">
        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
          {preview.totalOk} practices
        </span>
        {preview.totalExcluded > 0 && (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded">
            {preview.totalExcluded} excluded
          </span>
        )}
        <span className="px-2 py-1 bg-gray-50 text-gray-500 rounded">
          {preview.totalGenerated} total dates
        </span>
      </div>

      <div className="max-h-64 overflow-y-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {preview.dates.map((d, i) => (
              <tr
                key={i}
                className={d.status === 'excluded' ? 'bg-gray-50 text-gray-400' : ''}
              >
                <td className="px-4 py-2">{formatDate(d.date)}</td>
                <td className="px-4 py-2">{d.dayOfWeek}</td>
                <td className="px-4 py-2">
                  {d.status === 'ok' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600" title={d.reason}>
                      Excluded{d.reason ? ` - ${d.reason}` : ''}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
