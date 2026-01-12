// frontend/src/pages/SeasonDetail.tsx
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { Tabs } from '../components/Tabs';
import { seasonsApi } from '../api/seasons';
import { schoolsApi } from '../api/schools';

const TABS = [
  { id: 'games', label: 'Games' },
  { id: 'practices', label: 'Practices' },
];

export function SeasonDetail() {
  const { schoolId, seasonId } = useParams<{ schoolId: string; seasonId: string }>();
  const [activeTab, setActiveTab] = useState('games');

  const { data: school, isLoading: isLoadingSchool } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => schoolsApi.get(schoolId!),
    enabled: !!schoolId,
  });

  const { data: season, isLoading: isLoadingSeason } = useQuery({
    queryKey: ['season', seasonId],
    queryFn: () => seasonsApi.get(seasonId!),
    enabled: !!seasonId,
  });

  const isLoading = isLoadingSchool || isLoadingSeason;

  if (isLoading) {
    return (
      <Layout>
        <p className="text-gray-500">Loading...</p>
      </Layout>
    );
  }

  if (!school || !season) {
    return (
      <Layout>
        <p className="text-red-500">Season not found</p>
      </Layout>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Layout>
      <div className="mb-6">
        <nav className="text-sm mb-4">
          <Link to="/" className="text-gray-500 hover:text-gray-700">Dashboard</Link>
          <span className="mx-2 text-gray-400">/</span>
          <Link to={`/schools/${schoolId}`} className="text-gray-500 hover:text-gray-700">
            {school.name}
          </Link>
          <span className="mx-2 text-gray-400">/</span>
          <span className="text-gray-900">{season.name}</span>
        </nav>
        <h1 className="text-2xl font-bold">{season.name}</h1>
        <div className="mt-2 text-gray-500 space-y-1">
          <p>{season.teamName} - {season.sport}</p>
          <p>{formatDate(season.startDate)} - {formatDate(season.endDate)}</p>
        </div>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'games' && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium">Games coming soon</p>
            <p className="mt-1">Schedule and track games for this season</p>
          </div>
        )}
        {activeTab === 'practices' && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium">Practices coming soon</p>
            <p className="mt-1">Schedule and manage practice sessions</p>
          </div>
        )}
      </Tabs>
    </Layout>
  );
}
