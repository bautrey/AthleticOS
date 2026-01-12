// frontend/src/components/FacilitiesTab.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { facilitiesApi } from '../api/facilities';
import { CreateFacilityModal } from './CreateFacilityModal';
import { EmptyState } from './EmptyState';

interface FacilitiesTabProps {
  schoolId: string;
}

export function FacilitiesTab({ schoolId }: FacilitiesTabProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: facilities, isLoading } = useQuery({
    queryKey: ['facilities', schoolId],
    queryFn: () => facilitiesApi.list(schoolId),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Facilities</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          + Add Facility
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : facilities?.length === 0 ? (
        <EmptyState
          title="No facilities yet"
          description="Add your first facility to get started."
          action={{
            label: '+ Add Facility',
            onClick: () => setIsCreateModalOpen(true),
          }}
        />
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {facilities?.map((facility) => (
                <tr key={facility.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{facility.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{facility.type}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{facility.capacity ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateFacilityModal
        schoolId={schoolId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
