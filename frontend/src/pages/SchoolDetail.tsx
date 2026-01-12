// frontend/src/pages/SchoolDetail.tsx
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { Tabs } from '../components/Tabs';
import { TeamsTab } from '../components/TeamsTab';
import { schoolsApi } from '../api/schools';

const TABS = [
  { id: 'teams', label: 'Teams' },
  { id: 'facilities', label: 'Facilities' },
  { id: 'seasons', label: 'Seasons' },
  { id: 'settings', label: 'Settings' },
];

export function SchoolDetail() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const [activeTab, setActiveTab] = useState('teams');

  const { data: school, isLoading } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => schoolsApi.get(schoolId!),
    enabled: !!schoolId,
  });

  if (isLoading) {
    return (
      <Layout>
        <p className="text-gray-500">Loading...</p>
      </Layout>
    );
  }

  if (!school) {
    return (
      <Layout>
        <p className="text-red-500">School not found</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <Link to="/" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold mt-2">{school.name}</h1>
        <p className="text-gray-500">{school.timezone}</p>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'teams' && <TeamsTab schoolId={schoolId!} />}
        {activeTab === 'facilities' && <div>Facilities content coming soon...</div>}
        {activeTab === 'seasons' && <div>Seasons content coming soon...</div>}
        {activeTab === 'settings' && <div>Settings content coming soon...</div>}
      </Tabs>
    </Layout>
  );
}
