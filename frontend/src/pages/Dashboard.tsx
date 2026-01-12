// frontend/src/pages/Dashboard.tsx
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { SchoolCard } from '../components/SchoolCard';
import { schoolsApi } from '../api/schools';

export function Dashboard() {
  const { data: schools, isLoading } = useQuery({
    queryKey: ['schools'],
    queryFn: schoolsApi.list,
  });

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Schools</h1>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schools?.map((school) => (
            <SchoolCard key={school.id} school={school} />
          ))}
        </div>
      )}
    </Layout>
  );
}
