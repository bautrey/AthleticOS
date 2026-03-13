// frontend/src/components/operations/EventChecklistPanel.tsx
import { useChecklist, useUpdateChecklist } from '../../hooks/useOperations';
import type { ChecklistItem } from '../../api/operations';

interface EventChecklistPanelProps {
  schoolId: string;
  eventId: string;
  eventType?: string;
}

const STATUS_OPTIONS: { value: ChecklistItem['status']; label: string; color: string }[] = [
  { value: 'NOT_STARTED', label: 'Not Started', color: 'bg-gray-100 text-gray-700' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'COMPLETED', label: 'Completed', color: 'bg-green-100 text-green-700' },
  { value: 'SKIPPED', label: 'Skipped', color: 'bg-gray-50 text-gray-400' },
];

function getStatusColor(status: ChecklistItem['status']): string {
  return STATUS_OPTIONS.find(s => s.value === status)?.color || 'bg-gray-100 text-gray-700';
}

export function EventChecklistPanel({ schoolId, eventId, eventType = 'HOME_GAME' }: EventChecklistPanelProps) {
  const { data: checklist, isLoading } = useChecklist(schoolId, eventId, eventType);
  const updateMutation = useUpdateChecklist(schoolId, eventId, eventType);

  const handleStatusChange = (index: number, status: ChecklistItem['status']) => {
    updateMutation.mutate([{ index, status }]);
  };

  if (isLoading) {
    return <div className="text-sm text-gray-500 py-4">Loading checklist...</div>;
  }

  if (!checklist) {
    return (
      <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">
        No checklist available. Create a matching operations template to auto-generate one.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Event Checklist</h4>
          {checklist.template && (
            <span className="text-xs text-gray-500">Template: {checklist.template.name}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${checklist.completionPercent}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-600">{checklist.completionPercent}%</span>
        </div>
      </div>

      <div className="space-y-1">
        {checklist.items.map((item, index) => (
          <div
            key={item.id}
            className={`flex items-center gap-2 p-2 rounded ${
              item.status === 'COMPLETED' ? 'bg-green-50' : 'bg-white'
            }`}
          >
            <select
              value={item.status}
              onChange={e => handleStatusChange(index, e.target.value as ChecklistItem['status'])}
              className={`text-xs px-2 py-1 rounded border-0 cursor-pointer ${getStatusColor(item.status)}`}
              disabled={updateMutation.isPending}
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <div className="flex-1 min-w-0">
              <span className={`text-sm ${item.status === 'COMPLETED' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                {item.title}
              </span>
              {item.description && (
                <div className="text-xs text-gray-400 truncate">{item.description}</div>
              )}
            </div>

            {item.assignee && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {item.assignee.name || item.assignee.email}
              </span>
            )}

            {item.completedAt && (
              <span className="text-xs text-green-600">
                {new Date(item.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
