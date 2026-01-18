# TRD-003: Reconciliation UI

> Status: Complete
> PRD: [PRD-001](../prd/001-constraint-aware-scheduling.md)
> Depends on: [TRD-001](./001-blockers-and-constraints.md), [TRD-002](./002-conflict-detection-service.md)
> Created: 2026-01-12
> Last Updated: 2026-01-16

## Overview

The Reconciliation UI surfaces conflicts to coaches before they publish schedules. It provides visual indicators, warning modals, and conflict detail panels so coaches can make informed decisions.

## Design Principles

1. **Warn, don't block** — Conflicts are warnings, not errors. Coach has final say.
2. **Explain why** — Every conflict shows the specific blocker and reason.
3. **Show early** — Surface conflicts on schedule views, not just on save.
4. **Actionable** — Make it easy to fix (change time, change facility, or override).

## Components

### 1. ConflictBadge

Small visual indicator for events with conflicts.

```tsx
// frontend/src/components/ConflictBadge.tsx

interface ConflictBadgeProps {
  conflictCount: number;
  onClick?: () => void;
}

export function ConflictBadge({ conflictCount, onClick }: ConflictBadgeProps) {
  if (conflictCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                 bg-amber-100 text-amber-800 text-xs font-medium
                 hover:bg-amber-200 transition-colors"
    >
      <ExclamationTriangleIcon className="w-3 h-3" />
      {conflictCount} {conflictCount === 1 ? 'conflict' : 'conflicts'}
    </button>
  );
}
```

**Usage:** Appears on GameCard, PracticeCard, and calendar event tiles.

### 2. ConflictWarningModal

Modal shown when saving an event with conflicts.

```tsx
// frontend/src/components/ConflictWarningModal.tsx

interface Conflict {
  blockerId: string;
  blockerName: string;
  blockerType: string;
  reason: string;
  startDatetime: string;
  endDatetime: string;
}

interface ConflictWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: (reason?: string) => void;
  conflicts: Conflict[];
  eventType: 'game' | 'practice';
}

export function ConflictWarningModal({
  isOpen,
  onClose,
  onProceed,
  conflicts,
  eventType
}: ConflictWarningModalProps) {
  const [overrideReason, setOverrideReason] = useState('');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <ExclamationTriangleIcon className="w-5 h-5" />
            Schedule Conflict Detected
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This {eventType} conflicts with {conflicts.length} blocker{conflicts.length !== 1 && 's'}:
          </p>

          <ul className="space-y-2">
            {conflicts.map((conflict) => (
              <li
                key={conflict.blockerId}
                className="p-3 bg-amber-50 rounded-lg border border-amber-200"
              >
                <div className="font-medium text-amber-800">
                  {conflict.blockerName}
                </div>
                <div className="text-sm text-amber-600">
                  {conflict.reason}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatDateRange(conflict.startDatetime, conflict.endDatetime)}
                </div>
              </li>
            ))}
          </ul>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for override (optional)
            </label>
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="e.g., League-mandated game, cannot reschedule"
              className="w-full px-3 py-2 border rounded-md text-sm"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Go Back & Fix
          </Button>
          <Button
            variant="warning"
            onClick={() => onProceed(overrideReason || undefined)}
          >
            Save Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 3. ConflictDetailPanel

Slide-over panel showing all conflicts for an event.

```tsx
// frontend/src/components/ConflictDetailPanel.tsx

interface ConflictDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  event: {
    type: 'game' | 'practice';
    id: string;
    datetime: string;
    opponent?: string;  // for games
  };
  conflicts: Conflict[];
}

export function ConflictDetailPanel({
  isOpen,
  onClose,
  event,
  conflicts
}: ConflictDetailPanelProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Conflict Details</SheetTitle>
          <SheetDescription>
            {event.type === 'game'
              ? `Game vs ${event.opponent}`
              : 'Practice'} on {formatDate(event.datetime)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {conflicts.map((conflict) => (
            <ConflictCard key={conflict.blockerId} conflict={conflict} />
          ))}
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-sm text-gray-700 mb-2">
            How to resolve
          </h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Change the {event.type} date/time to avoid the blocked period</li>
            <li>• Change the facility (if facility-specific blocker)</li>
            <li>• Override and save anyway (reason will be logged)</li>
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

### 4. ScheduleCalendarView (Enhanced)

Calendar view with blocker overlay and conflict indicators.

```tsx
// frontend/src/components/ScheduleCalendar.tsx

interface ScheduleCalendarProps {
  seasonId: string;
  events: (Game | Practice)[];
  blockers: Blocker[];
  conflicts: Map<string, Conflict[]>;  // eventId -> conflicts
}

export function ScheduleCalendar({
  seasonId,
  events,
  blockers,
  conflicts
}: ScheduleCalendarProps) {
  return (
    <div className="relative">
      {/* Blocker overlay - background shading */}
      {blockers.map((blocker) => (
        <BlockerOverlay
          key={blocker.id}
          blocker={blocker}
          className="absolute bg-amber-50/50 border-l-4 border-amber-400"
        />
      ))}

      {/* Calendar grid */}
      <CalendarGrid>
        {events.map((event) => {
          const eventConflicts = conflicts.get(event.id) || [];
          return (
            <EventTile
              key={event.id}
              event={event}
              className={eventConflicts.length > 0 ? 'ring-2 ring-amber-400' : ''}
            >
              {eventConflicts.length > 0 && (
                <ConflictBadge
                  conflictCount={eventConflicts.length}
                  onClick={() => openConflictPanel(event.id)}
                />
              )}
            </EventTile>
          );
        })}
      </CalendarGrid>
    </div>
  );
}
```

### 5. DashboardConflictAlert

Alert banner for dashboard showing new conflicts.

```tsx
// frontend/src/components/DashboardConflictAlert.tsx

interface DashboardConflictAlertProps {
  conflictSummary: {
    totalConflicts: number;
    recentlyCreated: {
      blockerName: string;
      affectedEventsCount: number;
    }[];
  };
}

export function DashboardConflictAlert({ conflictSummary }: DashboardConflictAlertProps) {
  if (conflictSummary.totalConflicts === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-medium text-amber-800">
            {conflictSummary.totalConflicts} schedule conflicts detected
          </h3>
          {conflictSummary.recentlyCreated.length > 0 && (
            <p className="text-sm text-amber-600 mt-1">
              New blocker "{conflictSummary.recentlyCreated[0].blockerName}"
              affects {conflictSummary.recentlyCreated[0].affectedEventsCount} events
            </p>
          )}
          <Button
            variant="link"
            className="text-amber-700 p-0 h-auto mt-2"
            asChild
          >
            <Link to="/schedule/conflicts">Review conflicts →</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### 6. ConflictsPage

Dedicated page listing all conflicts across seasons.

```tsx
// frontend/src/pages/ConflictsPage.tsx

export function ConflictsPage() {
  const { schoolId } = useParams();
  const { data: summary } = useConflictSummary(schoolId);
  const { data: conflictingEvents } = useConflictingEvents(schoolId);

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Schedule Conflicts</h1>
          <p className="text-gray-600">
            {summary?.totalConflicts || 0} events need attention
          </p>
        </div>
        <div className="flex gap-2">
          <FilterDropdown />
          <Button variant="outline">
            Export List
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <SummaryCard
          label="Exam Conflicts"
          count={summary?.byType.EXAM || 0}
          icon={<AcademicCapIcon />}
        />
        <SummaryCard
          label="Facility Conflicts"
          count={summary?.byType.MAINTENANCE || 0}
          icon={<BuildingIcon />}
        />
        <SummaryCard
          label="Other Conflicts"
          count={(summary?.totalConflicts || 0) - (summary?.byType.EXAM || 0) - (summary?.byType.MAINTENANCE || 0)}
          icon={<CalendarIcon />}
        />
      </div>

      {/* Conflict list */}
      <div className="space-y-4">
        {conflictingEvents?.map((event) => (
          <ConflictEventCard
            key={event.id}
            event={event}
            onResolve={() => openEditModal(event)}
          />
        ))}
      </div>
    </div>
  );
}
```

## User Flows

### Flow 1: Create Game with Conflict

```
1. Coach opens "Add Game" form
2. Fills in details (opponent, date, time, facility)
3. Clicks "Save"
4. System checks for conflicts
5. IF conflicts exist:
   a. ConflictWarningModal appears
   b. Shows list of blockers that conflict
   c. Coach can:
      - Click "Go Back & Fix" → returns to form
      - Click "Save Anyway" → saves with override logged
6. Game is saved
7. If saved with conflicts, ConflictBadge appears on the game card
```

### Flow 2: View Schedule with Conflicts

```
1. Coach opens Season schedule view
2. Calendar shows:
   - Blocker periods as shaded backgrounds
   - Events with amber ring if conflicting
   - ConflictBadge on conflicting events
3. Coach clicks ConflictBadge
4. ConflictDetailPanel slides open
5. Shows all blockers this event conflicts with
6. Coach can click "Edit Event" to fix
```

### Flow 3: Dashboard Conflict Notification

```
1. Coach logs in, lands on Dashboard
2. IF school has conflicts:
   a. DashboardConflictAlert appears at top
   b. Shows count and most recent blocker
3. Coach clicks "Review conflicts"
4. Navigates to ConflictsPage
5. Can filter by type, team, season
6. Click event to edit and resolve
```

### Flow 4: Add Blocker with Retroactive Conflicts

```
1. AD opens Blockers page
2. Clicks "Add Blocker"
3. Fills in: "Final Exams", Dec 15-19, School-wide
4. Clicks "Save"
5. System checks for affected events
6. IF events exist in that period:
   a. Shows notification: "5 events will now conflict"
   b. Links to ConflictsPage filtered to this blocker
7. Blocker is saved
8. Dashboard shows new conflict count
```

## State Management

### Hooks

```typescript
// frontend/src/hooks/useConflicts.ts

// Check conflicts for a single event (used in forms)
export function useEventConflicts(event: EventInput | null) {
  return useQuery({
    queryKey: ['conflicts', 'check', event],
    queryFn: () => event ? api.conflicts.check(event) : null,
    enabled: !!event
  });
}

// Get conflict summary for dashboard
export function useConflictSummary(schoolId: string) {
  return useQuery({
    queryKey: ['conflicts', 'summary', schoolId],
    queryFn: () => api.conflicts.getSummary(schoolId)
  });
}

// Get all conflicting events for school
export function useConflictingEvents(schoolId: string, filters?: ConflictFilters) {
  return useQuery({
    queryKey: ['conflicts', 'events', schoolId, filters],
    queryFn: () => api.conflicts.getEvents(schoolId, filters)
  });
}

// Get blockers for calendar overlay
export function useBlockers(schoolId: string, dateRange: DateRange) {
  return useQuery({
    queryKey: ['blockers', schoolId, dateRange],
    queryFn: () => api.blockers.list(schoolId, { from: dateRange.start, to: dateRange.end })
  });
}
```

### Form Integration

```typescript
// In GameForm or PracticeForm

const [showConflictModal, setShowConflictModal] = useState(false);
const [pendingData, setPendingData] = useState<FormData | null>(null);

const handleSubmit = async (data: FormData) => {
  // Check conflicts before saving
  const conflicts = await conflictService.check({
    datetime: data.datetime,
    seasonId: data.seasonId,
    facilityId: data.facilityId
  });

  if (conflicts.hasConflicts) {
    setPendingData(data);
    setShowConflictModal(true);
    return;
  }

  // No conflicts, save directly
  await saveEvent(data);
};

const handleProceedWithConflicts = async (reason?: string) => {
  if (!pendingData) return;

  await saveEvent(pendingData);

  // Log the override
  if (conflicts.length > 0) {
    await api.conflicts.logOverride({
      eventType: 'GAME',
      eventId: newEvent.id,
      conflicts: conflicts.map(c => c.blockerId),
      reason
    });
  }

  setShowConflictModal(false);
  setPendingData(null);
};
```

## Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/schools/:id/blockers` | BlockersPage | List/manage blockers |
| `/schools/:id/conflicts` | ConflictsPage | View all conflicts |
| `/seasons/:id/schedule` | ScheduleCalendar | Calendar with conflict overlay |

## Test Cases

### Component Tests

1. **ConflictBadge**
   - Renders nothing when conflictCount is 0
   - Shows correct count and pluralization
   - Calls onClick when clicked

2. **ConflictWarningModal**
   - Shows all conflicts in list
   - "Go Back" closes modal
   - "Save Anyway" calls onProceed with optional reason

3. **DashboardConflictAlert**
   - Hidden when no conflicts
   - Shows count and recent blocker name
   - Link navigates to conflicts page

### Integration Tests

1. **Create game with conflict flow**
   - Create blocker, then create conflicting game
   - Modal appears, proceed saves game
   - Override is logged

2. **Calendar conflict display**
   - Blocker shows as shaded region
   - Conflicting event has amber ring
   - Clicking badge opens detail panel

## Deliverables

- [ ] ConflictBadge component
- [ ] ConflictWarningModal component
- [ ] ConflictDetailPanel component
- [ ] DashboardConflictAlert component
- [ ] ConflictsPage with filtering
- [ ] ScheduleCalendar blocker overlay
- [ ] useConflicts hooks
- [ ] Form integration for Game/Practice
- [ ] Component and integration tests
