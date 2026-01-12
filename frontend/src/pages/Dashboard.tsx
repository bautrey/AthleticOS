// frontend/src/pages/Dashboard.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { SchoolCard } from '../components/SchoolCard';
import { CreateSchoolModal } from '../components/CreateSchoolModal';
import { EmptyState } from '../components/EmptyState';
import { schoolsApi } from '../api/schools';

export function Dashboard() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { data: schools, isLoading } = useQuery({
    queryKey: ['schools'],
    queryFn: schoolsApi.list,
  });

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Schools</h1>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + New School
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : schools?.length === 0 ? (
        <EmptyState
          title="No schools yet"
          description="Create your first school to get started with AthleticOS."
          action={{
            label: '+ Create School',
            onClick: () => setIsCreateModalOpen(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schools?.map((school) => (
            <SchoolCard key={school.id} school={school} />
          ))}
        </div>
      )}

      <CreateSchoolModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </Layout>
  );
}
