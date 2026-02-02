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
import { teamsApi } from '../api/teams';
import { seasonsApi } from '../api/seasons';
import { conflictsApi } from '../api/conflicts';

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

  const { data: teams } = useQuery({
    queryKey: ['teams', schoolId],
    queryFn: () => teamsApi.list(schoolId!),
    enabled: !!schoolId,
  });

  const { data: seasons } = useQuery({
    queryKey: ['seasons', schoolId],
    queryFn: () => seasonsApi.list(schoolId!),
    enabled: !!schoolId,
  });

  const { data: conflictSummary } = useQuery({
    queryKey: ['school-conflict-summary', schoolId],
    queryFn: () => conflictsApi.getSchoolConflictSummary(schoolId!),
    enabled: !!schoolId,
  });

  const teamsCount = teams?.length ?? 0;
  const seasonsCount = seasons?.length ?? 0;
  const conflictsCount = conflictSummary?.totalConflicts ?? 0;

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
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{school.name}</h1>
            <p className="text-gray-500">{school.timezone}</p>
          </div>
          <Link
            to={`/schools/${schoolId}/blockers`}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Manage Blockers
          </Link>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-semibold text-gray-900">{teamsCount}</div>
          <div className="text-sm text-gray-500">Teams</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-semibold text-gray-900">{seasonsCount}</div>
          <div className="text-sm text-gray-500">Active Seasons</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className={`text-2xl font-semibold ${conflictsCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {conflictsCount}
          </div>
          <div className="text-sm text-gray-500">Conflicts</div>
        </div>
        <Link
          to={`/schools/${schoolId}/blockers`}
          className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-2xl font-semibold text-blue-600">
            {conflictSummary?.recentlyCreated?.length ?? 0}
          </div>
          <div className="text-sm text-gray-500">Active Blockers</div>
        </Link>
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
