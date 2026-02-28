// frontend/src/pages/Dashboard.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { CreateSchoolModal } from '../components/CreateSchoolModal';
import { EmptyState } from '../components/EmptyState';
import { HeroHeader } from '../components/dashboard/HeroHeader';
import { AttentionStrip } from '../components/dashboard/AttentionStrip';
import { StatBlocks } from '../components/dashboard/StatBlocks';
import { TodaySchedule } from '../components/dashboard/TodaySchedule';
import { ConflictBreakdown } from '../components/dashboard/ConflictBreakdown';
import { QuickActions } from '../components/dashboard/QuickActions';
import { schoolsApi, type School } from '../api/schools';
import { teamsApi } from '../api/teams';
import { seasonsApi } from '../api/seasons';
import { useSchoolConflictSummary } from '../hooks/useConflicts';
import { useUpcomingEvents } from '../hooks/useEvents';

function SchoolDashboard({ school }: { school: School }) {
  const { data: teams } = useQuery({
    queryKey: ['teams', school.id],
    queryFn: () => teamsApi.list(school.id),
  });

  const { data: seasons } = useQuery({
    queryKey: ['seasons', school.id],
    queryFn: () => seasonsApi.list(school.id),
  });

  const { data: conflictSummary } = useSchoolConflictSummary(school.id);
  const { data: upcomingEvents, isLoading: eventsLoading } = useUpcomingEvents(school.id);

  const conflictCount = conflictSummary?.totalConflicts ?? 0;
  const todayEvents = upcomingEvents?.filter(e => {
    const eventDate = new Date(e.datetime);
    const today = new Date();
    return eventDate.toDateString() === today.toDateString();
  }) ?? [];

  return (
    <>
      <HeroHeader
        school={school}
        conflictCount={conflictCount}
        eventsTodayCount={todayEvents.length}
      />

      <AttentionStrip
        schoolId={school.id}
        conflictCount={conflictCount}
        activeBlockerCount={conflictSummary?.recentlyCreated?.length ?? 0}
      />

      <StatBlocks
        schoolId={school.id}
        stats={{
          teams: teams?.length ?? 0,
          seasons: seasons?.length ?? 0,
          conflicts: conflictCount,
          upcomingEvents: upcomingEvents?.length ?? 0,
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content: Today's Schedule */}
        <div className="lg:col-span-2">
          <TodaySchedule
            events={upcomingEvents ?? []}
            schoolId={school.id}
            isLoading={eventsLoading}
          />
        </div>

        {/* Sidebar widgets */}
        <div className="space-y-6">
          <ConflictBreakdown summary={conflictSummary} schoolId={school.id} />
          <QuickActions schoolId={school.id} />
        </div>
      </div>
    </>
  );
}

export function Dashboard() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { data: schools, isLoading } = useQuery({
    queryKey: ['schools'],
    queryFn: schoolsApi.list,
  });

  return (
    <Layout>
      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : schools?.length === 0 ? (
        <>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Your Schools</h1>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              + New School
            </button>
          </div>
          <EmptyState
            title="No schools yet"
            description="Create your first school to get started with AthleticOS."
            action={{
              label: '+ Create School',
              onClick: () => setIsCreateModalOpen(true),
            }}
          />
        </>
      ) : schools?.length === 1 ? (
        // Single school: show dashboard directly
        <SchoolDashboard school={schools[0]} />
      ) : (
        // Multi-school: show school selector with dashboards
        <div>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Your Schools</h1>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              + New School
            </button>
          </div>
          {schools?.map((school) => (
            <div key={school.id} className="mb-8">
              <SchoolDashboard school={school} />
            </div>
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
