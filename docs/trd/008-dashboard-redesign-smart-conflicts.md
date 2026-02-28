# TRD-008: Dashboard Redesign & Smart Conflict Resolution

> Status: Draft
> PRD: [PRD-003](../PRD/003-sprint2-command-center-and-smart-conflicts.md)
> Created: 2026-02-27
> Last Updated: 2026-02-28
> Sprint: 2
> GitHub Issues: #1, #2, #3, #4, #5

## Overview

### Problem

Sprint 1 detects 46 conflicts but offers no guided resolution. The dashboard shows a blank school card. Conflicts require 6+ clicks to resolve one at a time. The priority engine calculates scores but doesn't surface them in the conflict workflow.

### Solution

Four features that transform detection into resolution:
1. **Clickable conflict rows** -- click anywhere to open detail
2. **Inline actions in detail panel** -- override/reschedule without leaving the panel
3. **Priority-driven suggestions** -- system recommends resolutions with confidence levels
4. **Batch conflict resolution** -- multi-select + bulk actions
5. **Dashboard redesign** with today's schedule, attention strip, stat blocks

### Relationship to Existing System

- **Extends** `conflictService.listAllConflicts()` with priority suggestion calculation
- **Extends** `ConflictDetailPanel` with inline override form and sequential triage
- **Extends** `ConflictRow` with click handler, checkbox, suggestion badge
- **Leverages** `priorityRulesService.calculate()` and `.compare()` from TRD-005
- **Leverages** existing `ConflictOverride` model for audit trail
- **Replaces** `Dashboard.tsx` with operational hub

## Execution Environment

- **Branch**: `feature/sprint2-dashboard-smart-conflicts`
- **Working Directory**: `/Users/burkestudio/projects/AthleticOS`
- **Prerequisites**: Sprint 1 complete (TRD-001 through TRD-007), Docker running, DB migrated

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Theme scope | Keep existing light theme (bg-gray-50 main, bg-white cards). Theme work deferred until UI stabilizes. | Avoid premature design system work; current light theme is functional and consistent |
| Suggestion confidence | 3 tiers (high/med/low) based on score gap | Simple, actionable; >15pt = auto-apply, 5-15 = review, <5 = manual |
| Batch endpoint | Single POST with array | Atomic operation; returns success/fail counts per item |
| Override in panel | Inline form, not modal | Modal-in-modal is bad UX; panel is already the focused context |
| Events endpoint | Configurable date range | `?from=&to=` params, defaults to today+2 days |
| Chart library | CSS conic-gradient | Zero dependencies; donut chart is simple enough for CSS-only |

---

## Master Task List

### Phase 0: F2 -- Clickable Conflict Rows

| ID | Task | Effort | Depends On |
|----|------|--------|------------|
| T01 | Add onClick to ConflictRow `<tr>`, cursor-pointer, hover state | 30m | -- |
| T02 | Add stopPropagation on action buttons | 15m | T01 |
| T03 | Add keyboard support (tabIndex, Enter to expand) | 30m | T01 |

### Phase 1: F3 -- Inline Actions in Detail Panel

| ID | Task | Effort | Depends On |
|----|------|--------|------------|
| T04 | Backend: add GET /conflicts/overrides/:eventType/:eventId endpoint | 1h | -- |
| T05 | Frontend API: add getOverridesForEvent() to conflicts.ts | 30m | T04 |
| T06 | Add useEventOverrides() hook | 15m | T05 |
| T07 | Add inline override form to ConflictDetailPanel | 2h | T01, T06 |
| T08 | Add override history section to ConflictDetailPanel | 1h | T07 |
| T09 | Add "Reschedule Event" link to ConflictDetailPanel | 30m | T07 |
| T10 | Add "View Full Schedule" link to ConflictDetailPanel | 15m | T07 |
| T11 | Add "Next Conflict -->" navigation to ConflictDetailPanel | 1h | T07 |
| T12 | Wire override success to invalidate conflict queries (real-time list update) | 30m | T07 |

### Phase 2: F4 -- Priority-Driven Suggestions

| ID | Task | Effort | Depends On |
|----|------|--------|------------|
| T13 | Backend: add generateSuggestion() method to conflictService | 2h | -- |
| T14 | Backend: extend listAllConflicts to accept `includeSuggestions` param | 1h | T13 |
| T15 | Backend: add suggestion to each ConflictListItem response | 1h | T14 |
| T16 | Frontend types: add ConflictSuggestion to conflicts.ts | 30m | T15 |
| T17 | Frontend: add SuggestionBadge component | 1h | T16 |
| T18 | Frontend: add suggestion badge to ConflictRow | 30m | T17 |
| T19 | Frontend: add priority comparison view to ConflictDetailPanel | 2h | T16, T07 |
| T20 | Frontend: add "Apply Suggestion" button to ConflictDetailPanel | 1h | T19 |
| T21 | Frontend: update ConflictsPage to pass includeSuggestions=true | 15m | T16 |

### Phase 3: F5 -- Batch Conflict Resolution

| ID | Task | Effort | Depends On |
|----|------|--------|------------|
| T22 | Backend: add POST /conflicts/batch-override endpoint | 1.5h | -- |
| T23 | Backend: add batchOverrideSchema to schemas.ts | 30m | T22 |
| T24 | Frontend API: add batchOverride() to conflicts.ts | 30m | T22 |
| T25 | Frontend: add useBatchOverride() mutation hook | 15m | T24 |
| T26 | Frontend: add checkbox column to ConflictRow | 1h | T01 |
| T27 | Frontend: add Select All checkbox to ConflictsList header | 30m | T26 |
| T28 | Frontend: add selectedIds state to ConflictsPage | 30m | T26 |
| T29 | Frontend: create BatchActionsBar component (sticky bottom) | 2h | T28 |
| T30 | Frontend: wire Override All flow in BatchActionsBar | 1h | T29, T25 |
| T31 | Frontend: wire Apply Suggestions flow in BatchActionsBar | 1h | T29, T20 |
| T32 | Frontend: add results summary modal after batch operation | 1h | T30 |

### Phase 4: F1 -- Dashboard Redesign

| ID | Task | Effort | Depends On |
|----|------|--------|------------|
| T33 | Backend: add GET /schools/:schoolId/events/upcoming endpoint | 2h | -- |
| T34 | Backend: add upcomingEventsSchema (from/to date params) | 30m | T33 |
| T35 | Frontend API: add getUpcomingEvents() to schools.ts or new events.ts | 30m | T33 |
| T36 | Frontend: add useUpcomingEvents() hook | 15m | T35 |
| T37 | Frontend: create HeroHeader component | 1.5h | -- |
| T38 | Frontend: create AttentionStrip component | 1h | -- |
| T39 | Frontend: create StatBlock component | 1h | -- |
| T40 | Frontend: create TodaySchedule component | 2h | T36 |
| T41 | Frontend: create ActiveBlockers widget component | 1h | -- |
| T42 | Frontend: create ConflictBreakdown donut chart component (CSS conic-gradient) | 1.5h | -- |
| T43 | Frontend: create QuickActions bar component | 30m | -- |
| T44 | Frontend: rewrite Dashboard.tsx with all dashboard components | 2h | T37-T43 |
| T45 | Frontend: single-school auto-select (skip school card if only 1 school) | 30m | T44 |
| T46 | Frontend: add animations (count-up, staggered fade-in, pulse, hover lift) | 1.5h | T44 |

### Phase 5: Verification

| ID | Task | Effort | Depends On |
|----|------|--------|------------|
| T47 | Smoke test: login --> dashboard loads with today's events | 30m | T44 |
| T48 | Smoke test: click conflict row --> panel opens with actions | 15m | T07 |
| T49 | Smoke test: override conflict inline --> list updates | 15m | T12 |
| T50 | Smoke test: batch select + override all | 15m | T32 |
| T51 | Smoke test: suggestion badges show correct confidence levels | 15m | T21 |
| T52 | WCAG AA audit on all pages | 30m | T46 |
| T53 | Deploy to Render + production smoke test | 30m | T47-T52 |

---

## Detailed Implementation

### T01-T03: Clickable Conflict Rows

**File:** `frontend/src/components/conflicts/ConflictRow.tsx`

Current: Row has separate click handlers on the conflict count button.

Change: Add `onClick` to `<tr>` that opens ConflictDetailPanel. Add `e.stopPropagation()` on:
- The "Reschedule" Link
- The "Override" button

```tsx
// ConflictRow.tsx
<tr
  className="cursor-pointer hover:bg-gray-100 transition-colors"
  onClick={() => setShowDetail(true)}
  tabIndex={0}
  onKeyDown={(e) => e.key === 'Enter' && setShowDetail(true)}
>
  {/* ... cells ... */}
  <td>
    <Link onClick={(e) => e.stopPropagation()} to={...}>Reschedule</Link>
    <button onClick={(e) => { e.stopPropagation(); setShowOverride(true); }}>Override</button>
  </td>
</tr>
```

### T04: Backend Override History Endpoint

**File:** `backend/src/modules/conflicts/routes.ts`

Add route:
```typescript
app.get('/conflicts/overrides/:eventType/:eventId', async (request) => {
  const { eventType, eventId } = request.params as { eventType: string; eventId: string };
  const overrides = await conflictService.getOverridesForEvent(eventType as EventType, eventId);
  return { data: overrides };
});
```

The `getOverridesForEvent` method already exists in `conflictService`.

### T07-T12: Enhanced ConflictDetailPanel

**File:** `frontend/src/components/conflicts/ConflictDetailPanel.tsx`

Add below the existing conflict list:

```tsx
{/* Actions Section */}
<div className="border-t border-gray-200 mt-4 pt-4">
  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Actions</h4>

  {/* Inline Override Form */}
  <div className="space-y-2">
    <textarea
      value={overrideReason}
      onChange={(e) => setOverrideReason(e.target.value)}
      placeholder="Override reason (optional)"
      className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm"
    />
    <button
      onClick={handleOverride}
      className="w-full bg-amber-500 text-white font-medium rounded px-3 py-2 text-sm"
    >
      Override All Conflicts
    </button>
  </div>

  {/* Reschedule + View Schedule links */}
  <div className="flex gap-2 mt-3">
    <Link to={rescheduleUrl} className="text-blue-600 text-sm hover:underline">
      Reschedule Event
    </Link>
    <Link to={scheduleUrl} className="text-blue-600 text-sm hover:underline">
      View Full Schedule
    </Link>
  </div>
</div>

{/* Override History */}
{overrides.length > 0 && (
  <div className="border-t border-gray-200 mt-4 pt-4">
    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">History</h4>
    {overrides.map(o => (
      <div key={o.id} className="text-xs text-gray-400 mb-1">
        Overridden {formatRelative(o.overriddenAt)} -- {o.reason || 'No reason given'}
      </div>
    ))}
  </div>
)}

{/* Next Conflict Navigation */}
<div className="border-t border-gray-200 mt-4 pt-4">
  <button onClick={onNextConflict} className="text-blue-600 text-sm hover:underline">
    Next Conflict -->
  </button>
</div>
```

**State management:** The parent `ConflictsPage` passes `onNextConflict` callback that increments the active conflict index.

### T13-T15: Priority Suggestion Generation

**File:** `backend/src/modules/conflicts/service.ts`

Add method:
```typescript
async generateSuggestion(
  schoolId: string,
  event: { type: EventType; id: string; teamName: string; teamLevel: string; seasonId: string; homeAway?: string; facilityId?: string },
  conflicts: Conflict[]
): Promise<ConflictSuggestion | null> {
  // For blocker-based conflicts (not event-vs-event), suggest override
  // For each conflict, check if there's a competing event at same facility/time
  // If competing event found, use priorityRulesService.compare() to determine winner
  // Return suggestion with confidence based on score gap

  // 1. Get season to determine IN_SEASON/OFF_SEASON
  const season = await prisma.season.findUnique({ where: { id: event.seasonId } });
  const seasonStatus = this.getSeasonStatus(season);

  // 2. Calculate this event's priority
  const thisScore = await priorityRulesService.calculate(schoolId, {
    teamLevel: event.teamLevel,
    seasonStatus,
    eventType: event.type,
    homeAway: event.homeAway || 'HOME',
    facilityId: event.facilityId,
  });

  // 3. For blocker conflicts, suggest override with high confidence
  //    (blockers are school policy, not event-vs-event)
  return {
    action: 'override',
    targetEventId: event.id,
    targetEventName: `${event.teamName} ${event.type}`,
    reason: `${conflicts[0].blockerName} (${conflicts[0].blockerType}) -- override if event should proceed`,
    confidence: 'medium',
    priorityComparison: null, // No competing event for blocker conflicts
    eventScore: thisScore.score,
  };
}
```

Extend `listAllConflicts` to accept `includeSuggestions: boolean` in the query schema. When true, call `generateSuggestion()` for each conflicting event and attach to response.

**Schema change** in `schemas.ts`:
```typescript
conflictsListQuerySchema = z.object({
  // ... existing fields ...
  includeSuggestions: z.coerce.boolean().optional().default(false),
});
```

### T17: SuggestionBadge Component

**File:** `frontend/src/components/conflicts/SuggestionBadge.tsx` (new)

```tsx
interface SuggestionBadgeProps {
  suggestion: ConflictSuggestion;
}

const confidenceColors = {
  high: 'bg-green-100 text-green-700 border-green-300',
  medium: 'bg-amber-100 text-amber-700 border-amber-300',
  low: 'bg-gray-100 text-gray-400 border-gray-300',
};

export function SuggestionBadge({ suggestion }: SuggestionBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${confidenceColors[suggestion.confidence]}`}>
      {suggestion.confidence === 'high' && 'Suggested: '}
      {suggestion.reason}
    </span>
  );
}
```

### T22-T23: Batch Override Backend

**File:** `backend/src/modules/conflicts/schemas.ts`

Add:
```typescript
export const batchOverrideSchema = z.object({
  overrides: z.array(z.object({
    eventType: z.nativeEnum(EventType),
    eventId: z.string(),
    blockerId: z.string(),
  })).min(1).max(100),
  reason: z.string().min(1),
});
```

**File:** `backend/src/modules/conflicts/routes.ts`

Add:
```typescript
app.post('/conflicts/batch-override', async (request) => {
  const userId = request.user.userId;
  const { overrides, reason } = batchOverrideSchema.parse(request.body);
  const schoolId = /* extract from first override or require in body */;

  const results = { succeeded: 0, failed: 0, errors: [] as Array<{ eventId: string; error: string }> };

  for (const override of overrides) {
    try {
      await conflictService.createOverride({
        ...override,
        reason,
      }, schoolId, userId);
      results.succeeded++;
    } catch (error) {
      results.failed++;
      results.errors.push({ eventId: override.eventId, error: String(error) });
    }
  }

  return { data: results };
});
```

### T29: BatchActionsBar Component

**File:** `frontend/src/components/conflicts/BatchActionsBar.tsx` (new)

Sticky bottom bar that appears when `selectedIds.size > 0`:

```tsx
interface BatchActionsBarProps {
  selectedCount: number;
  onOverrideAll: () => void;
  onApplySuggestions: () => void;
  onClearSelection: () => void;
}

export function BatchActionsBar({ selectedCount, onOverrideAll, onApplySuggestions, onClearSelection }: BatchActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-200 p-4 flex items-center justify-between z-40">
      <span className="text-sm text-gray-500 font-mono">{selectedCount} selected</span>
      <div className="flex gap-3">
        <button onClick={onClearSelection} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-900">
          Clear
        </button>
        <button onClick={onOverrideAll} className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded font-medium">
          Override All
        </button>
        <button onClick={onApplySuggestions} className="px-3 py-1.5 text-sm bg-green-500 text-white rounded font-medium">
          Apply Suggestions
        </button>
      </div>
    </div>
  );
}
```

### T33-T34: Upcoming Events Backend

**File:** `backend/src/modules/events/service.ts` (new module)

```typescript
export const eventsService = {
  async getUpcoming(schoolId: string, from: Date, to: Date) {
    // Query all games and practices in date range across all seasons for this school
    const seasons = await prisma.season.findMany({
      where: { team: { schoolId } },
      include: { team: true },
    });

    const seasonIds = seasons.map(s => s.id);

    const [games, practices] = await Promise.all([
      prisma.game.findMany({
        where: { seasonId: { in: seasonIds }, datetime: { gte: from, lte: to } },
        include: { season: { include: { team: true } }, facility: true },
        orderBy: { datetime: 'asc' },
      }),
      prisma.practice.findMany({
        where: { seasonId: { in: seasonIds }, datetime: { gte: from, lte: to } },
        include: { season: { include: { team: true } }, facility: true },
        orderBy: { datetime: 'asc' },
      }),
    ]);

    // Merge, sort by datetime, check conflicts for each
    const events = [
      ...games.map(g => ({
        type: 'game' as const,
        id: g.id,
        datetime: g.datetime,
        teamName: g.season.team.name,
        teamLevel: g.season.team.level,
        opponent: g.opponent,
        facilityName: g.facility?.name ?? null,
        homeAway: g.homeAway,
        seasonId: g.seasonId,
      })),
      ...practices.map(p => ({
        type: 'practice' as const,
        id: p.id,
        datetime: p.datetime,
        teamName: p.season.team.name,
        teamLevel: p.season.team.level,
        facilityName: p.facility?.name ?? null,
        seasonId: p.seasonId,
      })),
    ].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

    // Check conflicts for each event
    const eventsWithConflicts = await Promise.all(
      events.map(async (event) => {
        const conflicts = await conflictService.checkEventConflicts(/* ... */);
        return { ...event, hasConflicts: conflicts.length > 0, conflicts };
      })
    );

    return eventsWithConflicts;
  },
};
```

**File:** `backend/src/modules/events/routes.ts` (new)

```typescript
app.get('/schools/:schoolId/events/upcoming', async (request) => {
  const { schoolId } = request.params;
  const { from, to } = upcomingEventsSchema.parse(request.query);

  const fromDate = from ? new Date(from) : new Date(); // default: now
  const toDate = to ? new Date(to) : addDays(new Date(), 2); // default: +2 days

  const events = await eventsService.getUpcoming(schoolId, fromDate, toDate);
  return { data: events };
});
```

### T37-T46: Dashboard Components

**File:** `frontend/src/pages/Dashboard.tsx` -- rewrite

For single-school users, auto-fetch the school and render the dashboard directly:

```tsx
export function Dashboard() {
  const { data: schools } = useQuery({ queryKey: ['schools'], queryFn: schoolsApi.list });

  if (schools?.length === 1) {
    return <SchoolDashboard schoolId={schools[0].id} school={schools[0]} />;
  }

  // Multi-school: show selector + render dashboard for selected
  return <MultiSchoolSelector />;
}
```

**SchoolDashboard** renders: HeroHeader --> AttentionStrip --> StatBlocks --> TodaySchedule + Widgets

Each component is a focused, self-contained unit using standard Tailwind utility classes (bg-gray-50 for page background, bg-white for cards, standard text colors).

---

## API Summary

### New Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/schools/:schoolId/events/upcoming?from=&to=` | Today's events with conflicts | Authenticated |
| GET | `/conflicts/overrides/:eventType/:eventId` | Override history for event | Authenticated |
| POST | `/conflicts/batch-override` | Bulk override conflicts | ADMIN |

### Modified Endpoints

| Method | Path | Change |
|--------|------|--------|
| GET | `/schools/:schoolId/conflicts` | Add `includeSuggestions` query param; response includes `suggestion` per item |

---

## Data Flow

```
Dashboard Load:
  Browser --> GET /schools --> single school? --> GET /events/upcoming + GET /conflict-summary
    --> Render: HeroHeader + AttentionStrip + StatBlocks + TodaySchedule + Widgets

Conflict Triage:
  Browser --> GET /schools/:id/conflicts?includeSuggestions=true
    --> For each event: conflictService.listAllConflicts() + priorityRulesService.calculate()
    --> Response: ConflictListItem[] with suggestion field
    --> Render: ConflictRow with SuggestionBadge + checkbox

Single Override:
  User clicks row --> ConflictDetailPanel slides in --> User fills reason --> POST /conflicts/override
    --> Query invalidation --> List updates --> "Next Conflict -->"

Batch Override:
  User selects rows --> BatchActionsBar appears --> "Override All" --> reason modal
    --> POST /conflicts/batch-override --> Results summary --> Query invalidation
```

---

## Sprint 2 Execution Plan

### Week 1: UX Foundation
- [ ] T01-T03: Clickable conflict rows (F2 complete)
- [ ] T04-T06: Override history backend + frontend API

### Week 2: Inline Actions + Suggestions
- [ ] T07-T12: Inline actions in detail panel (F3 complete)
- [ ] T13-T15: Priority suggestion backend
- [ ] T16-T21: Suggestion badges + detail panel (F4 complete)

### Week 3: Batch + Dashboard
- [ ] T22-T32: Batch override backend + frontend (F5 complete)
- [ ] T33-T46: Dashboard redesign (F1 complete)
- [ ] T47-T53: Verification + deploy

---

## Verification

| Test | Command/Action | Expected |
|------|---------------|----------|
| Click conflict row | Click row body | Detail panel opens |
| Click action button | Click "Override" button | Override modal opens, row click NOT triggered |
| Inline override | Fill reason in panel, click Override | Override saved, history appears, list updates |
| Next conflict | Click "Next Conflict -->" in panel | Panel shows next unresolved conflict |
| Suggestion badge | Load conflicts page | Each row shows colored badge with suggestion |
| Apply suggestion | Click "Apply Suggestion" in panel | Override created matching suggestion |
| Batch select | Check 5 rows | BatchActionsBar shows "5 selected" |
| Batch override | Click "Override All", enter reason | All 5 overridden, results summary shown |
| Dashboard loads | Login with single school | Dashboard shows hero + attention strip + schedule |
| Dashboard events | Check today's schedule | Shows today's games/practices with conflict badges |
| Dashboard no conflicts | Override all conflicts | Attention strip disappears |
