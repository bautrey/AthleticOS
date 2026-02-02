// frontend/src/components/PracticesTab.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { practicesApi, type Practice } from '../api/practices';
import { facilitiesApi, type Facility } from '../api/facilities';
import { CreatePracticeModal } from './CreatePracticeModal';
import { EditPracticeModal } from './EditPracticeModal';
import { EmptyState } from './EmptyState';
import { ConflictBadge, ConflictDetailPanel } from './conflicts';
import { useSeasonConflicts } from '../hooks/useConflicts';
import type { Conflict } from '../api/conflicts';

interface PracticesTabProps {
  seasonId: string;
  schoolId: string;
}

const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) {
    return `${mins} min`;
  }
  if (mins === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${mins} min`;
};

export function PracticesTab({ seasonId, schoolId }: PracticesTabProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPractice, setEditingPractice] = useState<Practice | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<{
    practice: Practice;
    conflicts: Conflict[];
  } | null>(null);

  const { data: practices, isLoading } = useQuery({
    queryKey: ['practices', seasonId],
    queryFn: () => practicesApi.list(seasonId),
  });

  const { data: facilities } = useQuery({
    queryKey: ['facilities', schoolId],
    queryFn: () => facilitiesApi.list(schoolId),
  });

  const { data: conflictSummary } = useSeasonConflicts(seasonId);

  // Build a map of practice ID to conflicts
  const practiceConflictsMap = new Map<string, Conflict[]>();
  conflictSummary?.conflictingEvents
    .filter((e) => e.type === 'practice')
    .forEach((e) => {
      practiceConflictsMap.set(e.id, e.conflicts);
    });

  // Create a map for quick facility lookup
  const facilityMap = new Map<string, Facility>(
    facilities?.map((f) => [f.id, f]) ?? []
  );

  const handleConflictClick = (practice: Practice, conflicts: Conflict[]) => {
    setSelectedEvent({ practice, conflicts });
  };

  const getFacilityName = (facilityId: string | null): string => {
    if (!facilityId) return '-';
    const facility = facilityMap.get(facilityId);
    return facility ? facility.name : '-';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Practices</h2>
          {conflictSummary && conflictSummary.practicesWithConflicts > 0 && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              {conflictSummary.practicesWithConflicts} with conflicts
            </span>
          )}
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          + Add Practice
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : practices?.length === 0 ? (
        <EmptyState
          title="No practices scheduled"
          description="Add your first practice to start building your training schedule."
          action={{
            label: '+ Add Practice',
            onClick: () => setIsCreateModalOpen(true),
          }}
        />
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Facility</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conflicts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {practices?.map((practice) => {
                const conflicts = practiceConflictsMap.get(practice.id) || [];
                return (
                  <tr
                    key={practice.id}
                    onClick={() => setEditingPractice(practice)}
                    className={`hover:bg-gray-50 cursor-pointer ${conflicts.length > 0 ? 'bg-amber-50/30' : ''}`}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {formatDateTime(practice.datetime)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDuration(practice.durationMinutes)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {getFacilityName(practice.facilityId)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {practice.notes || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <ConflictBadge
                        conflictCount={conflicts.length}
                        onClick={() => handleConflictClick(practice, conflicts)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreatePracticeModal
        seasonId={seasonId}
        schoolId={schoolId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {editingPractice && (
        <EditPracticeModal
          practice={editingPractice}
          schoolId={schoolId}
          isOpen={true}
          onClose={() => setEditingPractice(null)}
        />
      )}

      {selectedEvent && (
        <ConflictDetailPanel
          isOpen={true}
          onClose={() => setSelectedEvent(null)}
          event={{
            type: 'practice',
            id: selectedEvent.practice.id,
            datetime: selectedEvent.practice.datetime,
          }}
          conflicts={selectedEvent.conflicts}
        />
      )}
    </div>
  );
}
