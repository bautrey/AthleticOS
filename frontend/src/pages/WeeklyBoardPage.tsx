// frontend/src/pages/WeeklyBoardPage.tsx
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { WeekNavigation } from '../components/weekly-board/WeekNavigation';
import { GridFilters } from '../components/weekly-board/GridFilters';
import { WeeklyGrid } from '../components/weekly-board/WeeklyGrid';
import { SlotPopover } from '../components/weekly-board/SlotPopover';
import { InlineEventEditor } from '../components/weekly-board/InlineEventEditor';
import { eventsApi, type UpcomingEvent } from '../api/events';
import { teamsApi } from '../api/teams';
import { facilitiesApi } from '../api/facilities';
import { QuickAddBar } from '../components/quick-add/QuickAddBar';
import { BulkMoveDialog } from '../components/bulk-ops/BulkMoveDialog';
import { RainPlanDialog } from '../components/bulk-ops/RainPlanDialog';
import { AutoResolveDialog } from '../components/bulk-ops/AutoResolveDialog';

/** Get the Monday of the week containing the given date */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // getDay: 0=Sun, 1=Mon...6=Sat. Shift so Mon=0.
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function WeeklyBoardPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

  // Bulk ops dialog state
  const [showBulkMove, setShowBulkMove] = useState(false);
  const [showRainPlan, setShowRainPlan] = useState(false);
  const [showAutoResolve, setShowAutoResolve] = useState(false);

  // Filters
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedFacility, setSelectedFacility] = useState('');
  const [selectedType, setSelectedType] = useState('');

  // Popover state
  const [slotPopover, setSlotPopover] = useState<{
    date: Date;
    hour: number;
    minute: number;
    position: { top: number; left: number };
  } | null>(null);

  const [selectedEvent, setSelectedEvent] = useState<{
    event: UpcomingEvent;
    position: { top: number; left: number };
  } | null>(null);

  // Keyboard navigation
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const weekEnd = getWeekEnd(weekStart);
  const fromStr = weekStart.toISOString();
  const toStr = weekEnd.toISOString();

  // Fetch events for the week
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events', 'upcoming', schoolId, fromStr, toStr],
    queryFn: () => eventsApi.getUpcoming(schoolId!, { from: fromStr, to: toStr }),
    enabled: !!schoolId,
  });

  // Fetch teams and facilities for filters
  const { data: _teams = [] } = useQuery({
    queryKey: ['teams', schoolId],
    queryFn: () => teamsApi.list(schoolId!),
    enabled: !!schoolId,
  });

  const { data: _facilities = [] } = useQuery({
    queryKey: ['facilities', schoolId],
    queryFn: () => facilitiesApi.list(schoolId!),
    enabled: !!schoolId,
  });

  // Apply filters
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (selectedTeam && e.teamName !== selectedTeam) return false;
      if (selectedFacility && e.facilityName !== selectedFacility) return false;
      if (selectedType && e.type !== selectedType) return false;
      return true;
    });
  }, [events, selectedTeam, selectedFacility, selectedType]);

  const handlePrevWeek = useCallback(() => {
    setWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
    setSlotPopover(null);
    setSelectedEvent(null);
  }, []);

  const handleNextWeek = useCallback(() => {
    setWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
    setSlotPopover(null);
    setSelectedEvent(null);
  }, []);

  const handleToday = useCallback(() => {
    setWeekStart(getWeekStart(new Date()));
    setSlotPopover(null);
    setSelectedEvent(null);
  }, []);

  const handleSlotClick = useCallback((date: Date, hour: number, minute: number, rect: DOMRect) => {
    setSelectedEvent(null);
    setSlotPopover({
      date,
      hour,
      minute,
      position: {
        top: Math.min(rect.top + 40, window.innerHeight - 200),
        left: Math.min(rect.left, window.innerWidth - 280),
      },
    });
  }, []);

  const handleEventClick = useCallback((event: UpcomingEvent) => {
    setSlotPopover(null);
    setSelectedEventId(event.id);
    // Position the editor near the center of the viewport
    setSelectedEvent({
      event,
      position: {
        top: Math.min(200, window.innerHeight - 350),
        left: Math.min(window.innerWidth / 2 - 150, window.innerWidth - 300),
      },
    });
  }, []);

  const handleCreateGame = useCallback((_datetime: string) => {
    // Navigate to school detail page where games can be created via season
    if (schoolId) navigate(`/schools/${schoolId}`);
  }, [schoolId, navigate]);

  const handleCreatePractice = useCallback((_datetime: string) => {
    if (schoolId) navigate(`/schools/${schoolId}`);
  }, [schoolId, navigate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      switch (e.key) {
        case 'Escape':
          setSlotPopover(null);
          setSelectedEvent(null);
          setSelectedEventId(null);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevWeek();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNextWeek();
          break;
        case 'Delete':
        case 'Backspace':
          // Delete handled in InlineEventEditor
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevWeek, handleNextWeek]);

  // Responsive: check if mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const teamOptions = useMemo(() => {
    const unique = new Set(events.map(e => e.teamName));
    return Array.from(unique).sort().map(name => ({ value: name, label: name }));
  }, [events]);

  const facilityOptions = useMemo(() => {
    const unique = new Set(events.filter(e => e.facilityName).map(e => e.facilityName!));
    return Array.from(unique).sort().map(name => ({ value: name, label: name }));
  }, [events]);

  if (!schoolId) return null;

  return (
    <Layout>
      <div className="p-6 space-y-4">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <WeekNavigation
            weekStart={weekStart}
            onPrevWeek={handlePrevWeek}
            onNextWeek={handleNextWeek}
            onToday={handleToday}
          />
          <GridFilters
            teams={teamOptions}
            facilities={facilityOptions}
            selectedTeam={selectedTeam}
            selectedFacility={selectedFacility}
            selectedType={selectedType}
            onTeamChange={setSelectedTeam}
            onFacilityChange={setSelectedFacility}
            onTypeChange={setSelectedType}
          />
        </div>

        {/* Bulk Operations Toolbar */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowBulkMove(true)}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-200 border border-gray-300"
          >
            Bulk Move
          </button>
          <button
            onClick={() => setShowRainPlan(true)}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-200 border border-gray-300"
          >
            Rain Plan
          </button>
          <button
            onClick={() => setShowAutoResolve(true)}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-200 border border-gray-300"
          >
            Auto-Resolve
          </button>
        </div>

        {/* Bulk Ops Dialogs */}
        {showBulkMove && <BulkMoveDialog schoolId={schoolId} onClose={() => setShowBulkMove(false)} />}
        {showRainPlan && <RainPlanDialog schoolId={schoolId} onClose={() => setShowRainPlan(false)} />}
        {showAutoResolve && <AutoResolveDialog schoolId={schoolId} onClose={() => setShowAutoResolve(false)} />}

        {/* Quick-Add Bar */}
        <QuickAddBar
          schoolId={schoolId}
          weekStartDate={weekStart.toISOString().split('T')[0]}
          onConfirmGame={(data) => {
            // Navigate to school detail to create via season
            navigate(`/schools/${schoolId}`);
            console.log('Quick-add game:', data);
          }}
          onConfirmPractice={(data) => {
            navigate(`/schools/${schoolId}`);
            console.log('Quick-add practice:', data);
          }}
          onOpenFullForm={() => navigate(`/schools/${schoolId}`)}
        />

        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-12 text-gray-500">Loading events...</div>
        )}

        {/* Grid or mobile list */}
        {!isLoading && (
          isMobile ? (
            <MobileListView events={filteredEvents} onEventClick={handleEventClick} />
          ) : (
            <WeeklyGrid
              weekStart={weekStart}
              events={filteredEvents}
              selectedEventId={selectedEventId}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
            />
          )
        )}

        {/* Slot popover */}
        {slotPopover && (
          <SlotPopover
            date={slotPopover.date}
            hour={slotPopover.hour}
            minute={slotPopover.minute}
            position={slotPopover.position}
            onClose={() => setSlotPopover(null)}
            onCreateGame={handleCreateGame}
            onCreatePractice={handleCreatePractice}
          />
        )}

        {/* Inline event editor */}
        {selectedEvent && (
          <InlineEventEditor
            event={selectedEvent.event}
            position={selectedEvent.position}
            onClose={() => { setSelectedEvent(null); setSelectedEventId(null); }}
          />
        )}

        {/* Keyboard shortcuts help */}
        <div className="text-xs text-gray-400 flex gap-4">
          <span>Arrow keys: navigate weeks</span>
          <span>Esc: close popovers</span>
          <span>Click slot: quick-create</span>
          <span>Click event: edit</span>
        </div>
      </div>
    </Layout>
  );
}

/** Mobile fallback: simple list view */
function MobileListView({ events, onEventClick }: { events: UpcomingEvent[]; onEventClick: (e: UpcomingEvent) => void }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No events this week.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <button
          key={`${event.type}-${event.id}`}
          onClick={() => onEventClick(event)}
          className="w-full text-left p-3 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 flex items-center gap-3"
        >
          <span className={`w-3 h-3 rounded-full flex-shrink-0 ${event.type === 'game' ? 'bg-blue-500' : 'bg-green-500'}`} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-800 truncate">
              {event.teamName}
              {event.type === 'game' && event.opponent ? ` vs ${event.opponent}` : ''}
            </div>
            <div className="text-xs text-gray-500">
              {new Date(event.datetime).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
              {event.facilityName ? ` @ ${event.facilityName}` : ''}
            </div>
          </div>
          {event.hasConflicts && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex-shrink-0">
              {event.conflictCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
