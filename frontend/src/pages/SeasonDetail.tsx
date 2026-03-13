// frontend/src/pages/SeasonDetail.tsx
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { Tabs } from '../components/Tabs';
import { GamesTab } from '../components/GamesTab';
import { PracticesTab } from '../components/PracticesTab';
import { CalendarTab } from '../components/CalendarTab';
import { EditGameModal } from '../components/EditGameModal';
import { EditPracticeModal } from '../components/EditPracticeModal';
import { ImportScheduleModal } from '../components/ImportScheduleModal';
import { ShareScheduleModal } from '../components/ShareScheduleModal';
import { PrintWeekView } from '../components/weekly-board/PrintWeekView';
import { seasonsApi } from '../api/seasons';
import { schoolsApi } from '../api/schools';
import { gamesApi } from '../api/games';
import { practicesApi } from '../api/practices';
import type { Game } from '../api/games';
import type { Practice } from '../api/practices';

const TABS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'games', label: 'Games' },
  { id: 'practices', label: 'Practices' },
];

export function SeasonDetail() {
  const { schoolId, seasonId } = useParams<{ schoolId: string; seasonId: string }>();
  const [activeTab, setActiveTab] = useState('calendar');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [editingPractice, setEditingPractice] = useState<Practice | null>(null);

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

  // T-034: Fetch games and practices for print view
  const { data: games } = useQuery({
    queryKey: ['games', seasonId],
    queryFn: () => gamesApi.list(seasonId!),
    enabled: !!seasonId,
  });

  const { data: practices } = useQuery({
    queryKey: ['practices', seasonId],
    queryFn: () => practicesApi.list(seasonId!),
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{season.name}</h1>
            <div className="mt-2 text-gray-500 space-y-1">
              <p>{season.teamName} - {season.sport}</p>
              <p>{formatDate(season.startDate)} - {formatDate(season.endDate)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import
            </button>
            {/* T-035: Print button */}
            <button
              onClick={() => window.print()}
              className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 no-print"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            <button
              onClick={() => setShowShareModal(true)}
              className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
          </div>
        </div>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'calendar' && (
          <CalendarTab
            seasonId={seasonId!}
            schoolId={schoolId!}
            onEditGame={setEditingGame}
            onEditPractice={setEditingPractice}
          />
        )}
        {activeTab === 'games' && (
          <GamesTab seasonId={seasonId!} schoolId={schoolId!} />
        )}
        {activeTab === 'practices' && (
          <PracticesTab seasonId={seasonId!} schoolId={schoolId!} />
        )}
      </Tabs>

      <ImportScheduleModal
        seasonId={seasonId!}
        schoolId={schoolId!}
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />

      <ShareScheduleModal
        seasonId={seasonId!}
        seasonName={season.name}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />

      {editingGame && (
        <EditGameModal
          game={editingGame}
          schoolId={schoolId!}
          isOpen={true}
          onClose={() => setEditingGame(null)}
        />
      )}

      {editingPractice && (
        <EditPracticeModal
          practice={editingPractice}
          schoolId={schoolId!}
          isOpen={true}
          onClose={() => setEditingPractice(null)}
        />
      )}

      {/* T-034/T-038: Print view (hidden on screen, shown on print) */}
      <PrintWeekView
        events={[
          ...(games ?? []).map((g) => ({
            id: g.id,
            type: 'game' as const,
            datetime: g.datetime,
            opponent: g.opponent,
            teamName: season?.teamName ?? '',
            facilityName: null,
            status: g.status,
          })),
          ...(practices ?? []).map((p) => ({
            id: p.id,
            type: 'practice' as const,
            datetime: p.datetime,
            teamName: season?.teamName ?? '',
            facilityName: null,
          })),
        ]}
        schoolName={school?.name ?? ''}
        teamName={season?.teamName}
        seasonName={season?.name}
        weekStart={season ? new Date(season.startDate) : undefined}
        weekEnd={season ? new Date(season.endDate) : undefined}
      />
    </Layout>
  );
}
