// frontend/src/pages/SchoolDetail.tsx
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { Tabs } from '../components/Tabs';
import { TeamsTab } from '../components/TeamsTab';
import { FacilitiesTab } from '../components/FacilitiesTab';
import { SeasonsTab } from '../components/SeasonsTab';
import { SettingsTab } from '../components/SettingsTab';
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
        <nav className="text-sm mb-4">
          <Link to="/" className="text-gray-500 hover:text-gray-700">Dashboard</Link>
          <span className="mx-2 text-gray-400">/</span>
          <span className="text-gray-900">{school.name}</span>
        </nav>
        <h1 className="text-2xl font-bold">{school.name}</h1>
        <p className="text-gray-500">{school.timezone}</p>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'teams' && <TeamsTab schoolId={schoolId!} />}
        {activeTab === 'facilities' && <FacilitiesTab schoolId={schoolId!} />}
        {activeTab === 'seasons' && <SeasonsTab schoolId={schoolId!} />}
        {activeTab === 'settings' && <SettingsTab school={school} />}
      </Tabs>
    </Layout>
  );
}
