// frontend/src/components/dashboard/ConflictBreakdown.tsx
import { Link } from 'react-router-dom';
import type { SchoolConflictSummary } from '../../api/conflicts';

interface ConflictBreakdownProps {
  summary: SchoolConflictSummary | undefined;
  schoolId: string;
}

const typeColors: Record<string, string> = {
  EXAM: '#f59e0b',
  MAINTENANCE: '#6366f1',
  EVENT: '#3b82f6',
  TRAVEL: '#10b981',
  HOLIDAY: '#ec4899',
  WEATHER: '#8b5cf6',
  CUSTOM: '#6b7280',
};

const typeLabels: Record<string, string> = {
  EXAM: 'Exams',
  MAINTENANCE: 'Maintenance',
  EVENT: 'Events',
  TRAVEL: 'Travel',
  HOLIDAY: 'Holidays',
  WEATHER: 'Weather',
  CUSTOM: 'Custom',
};

export function ConflictBreakdown({ summary, schoolId }: ConflictBreakdownProps) {
  if (!summary || summary.totalConflicts === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Conflicts</h3>
        <div className="text-center py-4">
          <div className="text-2xl text-green-600 font-bold">0</div>
          <div className="text-sm text-gray-500 mt-1">All clear</div>
        </div>
      </div>
    );
  }

  const entries = Object.entries(summary.byType).sort((a, b) => b[1] - a[1]);
  const total = summary.totalConflicts;

  // Build CSS conic-gradient
  let gradientParts: string[] = [];
  let cumulative = 0;
  for (const [type, count] of entries) {
    const startPct = (cumulative / total) * 100;
    cumulative += count;
    const endPct = (cumulative / total) * 100;
    const color = typeColors[type] || '#6b7280';
    gradientParts.push(`${color} ${startPct}% ${endPct}%`);
  }

  const gradient = `conic-gradient(${gradientParts.join(', ')})`;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Conflicts</h3>
        <Link to={`/schools/${schoolId}/conflicts`} className="text-xs text-blue-600 hover:underline">
          View all
        </Link>
      </div>

      <div className="flex items-center gap-6">
        {/* Donut chart */}
        <div className="relative w-20 h-20 flex-shrink-0">
          <div
            className="w-full h-full rounded-full"
            style={{ background: gradient }}
          />
          <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
            <span className="text-lg font-bold text-gray-900">{total}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-1.5">
          {entries.map(([type, count]) => (
            <div key={type} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: typeColors[type] || '#6b7280' }}
                />
                <span className="text-gray-600">{typeLabels[type] || type}</span>
              </div>
              <span className="font-medium text-gray-900">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
