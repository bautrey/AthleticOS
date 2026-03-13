# PRD-003: Sprint 2 -- Dashboard Redesign & Smart Conflict Resolution

> Status: Draft
> Created: 2026-02-27
> Last Updated: 2026-02-27
> Author: Burke (Product/Engineering)
> Target School: Trinity Christian Academy (TCA)
> Sprint: 2
> Dependencies: PRD-002, TRD-005 (Priority Rules Engine), TRD-006/007 (completed Sprint 1)

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-02-27 | Initial draft covering Issues #1-#5 |
| v1.1 | 2026-02-27 | Renamed "Dashboard" to Dashboard. Theme is app-wide, not dashboard-only. |
| v1.2 | 2026-02-28 | Removed dark theme scope. Keep existing light theme; theme work deferred until UI stabilizes. |

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Business Context](#business-context)
4. [User Personas](#user-personas)
5. [Current State Assessment](#current-state-assessment)
6. [Solution Overview](#solution-overview)
7. [Feature Specifications](#feature-specifications)
   - [F1: Dashboard Redesign](#f1-dashboard-redesign)
   - [F2: Clickable Conflict Rows](#f2-clickable-conflict-rows)
   - [F3: Conflict Detail Panel with Inline Actions](#f3-conflict-detail-panel-with-inline-actions)
   - [F4: Priority-Driven Resolution Suggestions](#f4-priority-driven-resolution-suggestions)
   - [F5: Batch Conflict Resolution](#f5-batch-conflict-resolution)
8. [User Journeys](#user-journeys)
9. [Non-Functional Requirements](#non-functional-requirements)
10. [Success Metrics](#success-metrics)
11. [Risks and Mitigations](#risks-and-mitigations)
12. [Feature Prioritization (RICE)](#feature-prioritization-rice)
13. [Acceptance Criteria](#acceptance-criteria)
14. [Dependencies & Sequencing](#dependencies--sequencing)

---

## Executive Summary

Sprint 1 delivered the foundational AthleticOS platform: constraint-aware scheduling, conflict detection, priority rules engine, blocker management, schedule import/sharing, and a conflicts triage page. The system detects 46 conflicts across Trinity Christian Academy's demo data.

**The problem now is not detection — it's resolution workflow.**

The current interface shows conflicts but doesn't help resolve them. The dashboard is a static list of school cards with no operational value. An athletic director looking at 46 conflicts has no guidance on which to address first, no way to act without navigating away from what they're reading, and no way to resolve similar conflicts in bulk.

Sprint 2 transforms AthleticOS from a conflict *detection* tool into a conflict *resolution* platform by delivering:

1. **Dashboard Redesign** — An operations hub that answers "what's happening right now?" and "what needs my attention?" instead of showing a bland school card.
2. **Streamlined Conflict UX** — Click anywhere in a row to see details. Act directly from the detail panel. No bouncing between views.
3. **Smart Suggestions** — The priority engine (already built in TRD-005) analyzes competing events and recommends which should yield, with confidence levels.
4. **Batch Resolution** — Select, filter, and resolve groups of conflicts in one action.

The end state: an athletic director can open AthleticOS, see 46 conflicts, understand that the system recommends auto-resolving 35 of them, review the suggestions, and clear them with a few clicks — instead of triaging each one individually.

---

## Problem Statement

### What We Learned from Sprint 1

The conflict detection system works — it correctly identifies 46 conflicts across blocker types (EXAM: 33, WEATHER: 6, HOLIDAY: 6, MAINTENANCE: 5). But observation of the demo workflow reveals critical gaps:

1. **The dashboard tells you nothing.** A single white card saying "Trinity Christian Academy — 12 Teams, 8 Seasons, 46 Conflicts" doesn't help an AD start their day. There's no "today's schedule," no urgency hierarchy, no indication of what's happening now vs. what's a future problem.

2. **Conflict resolution is painful.** Each conflict requires: scan the table → find the right button → click it → read the panel → close the panel → find the action button back in the row → act. This is 6 steps for what should be 2 (click → resolve).

3. **The priority engine is underutilized.** TRD-005 calculates priority scores, but they're only shown in a comparison tool. The conflict list doesn't surface priority data, so the AD has to manually reason about "does varsity or JV yield?" when the system already knows the answer.

4. **No batch operations.** Spring Midterm Exams creates 25 conflicts. Resolving them one-by-one is unreasonable. Most share the same resolution pattern (exam period → all practices during exam hours get overridden or rescheduled), but there's no way to apply that pattern at scale.

### The Cost of Not Solving This

Without these improvements, the 46-conflict demo will elicit this response from Dr. Williams and potential adopters: *"This is great that it found the conflicts, but now what? I still have to deal with each one manually?"*

The value proposition of AthleticOS is reducing the 25% of coach time spent on logistics. Detecting conflicts without streamlining resolution only moves the problem from "I didn't know about it" to "I know about it but it's still painful." That's insufficient.

---

## Business Context

| Aspect | Detail |
|--------|--------|
| Sprint | 2 (follows completed Sprint 1: TRD-001 through TRD-007) |
| Target users | Athletic Director (vacant), Head of School (Dr. Jeff Williams), coaches |
| Demo target | Impress TCA stakeholders with operational intelligence, not just data |
| GitHub Issues | #1, #2, #3, #4, #5 on bautrey/AthleticOS |
| Prior art | TRD-005 Priority Rules Engine (score calculation, comparison API already built) |

---

## User Personas

### Primary: Athletic Director (Role Currently Vacant at TCA)

This is the person AthleticOS is designed to replace/augment. The system should be capable enough that a less experienced coordinator can manage what previously required a veteran AD.

**Daily workflow:**
1. Morning: Open AthleticOS → What's happening today? What needs attention?
2. Triage: Review conflicts → Which are urgent? Which can the system handle?
3. Resolve: Apply priority-based suggestions for clear-cut cases, manually review edge cases
4. Communicate: Share updated schedules with affected coaches

**Key requirement:** The system must make the AD *faster*, not just more informed. Showing 46 conflicts with no guidance is actually worse than not knowing — it creates anxiety without enabling action.

### Secondary: Head Coach (Truman)

Coaches primarily care about their own program's conflicts. They need:
- Quick answers: "Is my game tomorrow affected by anything?"
- Clear resolution: "The system suggests rescheduling your JV practice because Varsity has the gym. Here's why."
- Trust: "I can see the priority scores and the reasoning — this isn't arbitrary."

### Tertiary: Head of School (Dr. Jeff Williams)

Dr. Williams needs confidence that the athletic program is running smoothly. The dashboard should convey operational health at a glance — like a hospital status board, not a spreadsheet.

---

## Current State Assessment

### What Exists (Sprint 1 Deliverables)

| Component | Status | Quality |
|-----------|--------|---------|
| Conflict detection engine | Complete | Accurately detects 46 conflicts across all blocker types |
| Priority rules engine | Complete | Calculates scores, comparison API, audit logging |
| Conflicts page | Complete | Paginated table with filters, basic detail panel |
| ConflictDetailPanel | Complete | Slides in from right, shows blocker info |
| ConflictWarningModal | Complete | Override confirmation with reason input |
| ConflictBadge | Complete | Inline badge showing conflict count |
| Dashboard | Complete | Basic school card grid (minimal) |
| SchoolDetail | Complete | Stat cards + tabs (teams, facilities, seasons, settings) |

### What's Missing

| Gap | Impact |
|-----|--------|
| No operational dashboard | AD can't start their day from AthleticOS |
| No today's events view | AD doesn't know what's happening today |
| Row clicks don't work | Standard UX expectation violated |
| Detail panel is read-only | Can't act on what you're reading |
| No priority suggestions in conflicts | System knows the answer but doesn't share it |
| No batch operations | 25+ similar conflicts must be resolved individually |
| No "Next Conflict" flow | Can't triage sequentially |

---

## Solution Overview

Sprint 2 is organized as five features that form a logical progression:

```
F1: Dashboard
    └── "What's happening? What needs attention?"

F2: Clickable Conflict Rows
    └── "Let me see the details" (click anywhere)

F3: Inline Actions in Detail Panel
    └── "Let me fix it right here" (override/reschedule in panel)

F4: Priority-Driven Suggestions
    └── "The system knows the answer" (smart recommendations)

F5: Batch Resolution
    └── "Fix them all at once" (multi-select + bulk actions)
```

F2 and F3 are prerequisite UX fixes. F4 is the intelligence layer. F5 is the efficiency multiplier. F1 is the entry point that ties it all together.

---

## Feature Specifications

### F1: Dashboard Redesign

**GitHub Issue:** #1
**Priority:** High
**Effort:** Large

#### Problem
The current dashboard is a "Your Schools" page with white cards showing 3 numbers. For TCA (single school), this adds zero operational value. An AD opens AthleticOS and sees nothing actionable.

#### Solution
Redesign the dashboard as an operations hub. For single-school users, skip school selection entirely.

#### Design Direction
- **Aesthetic:** Athletic editorial meets operations dashboard -- information density with confident typography
- **Theme:** Keep existing light theme (bg-gray-50 page background, bg-white cards). Theme work deferred until UI stabilizes. Standard Tailwind color utilities throughout.
- **Typography:** System default fonts (Tailwind defaults). Consider DM Sans + JetBrains Mono in a future design pass.
- **Color system:** Standard Tailwind utilities for surfaces (gray-50, white), text (gray-900, gray-500, gray-400), and accents (amber for warnings, red for critical, green for clear, blue for info).

#### Layout Sections

**1. Hero Header**
- School name (DM Sans 700, tracked wide, all caps)
- Subtitle (e.g., school timezone or current date)
- Current date/time (JetBrains Mono)
- Time-of-day personalized greeting ("Good morning, Burke")
- Live indicator pill: pulsing green dot + count of today's events

**2. Urgent Attention Strip** (conditional — only shows when conflicts exist)
- Amber-to-red gradient left border
- Total conflict count + top blocker summaries
- Direct link to conflicts page
- Collapses entirely when zero conflicts (no empty state)

**3. Stat Blocks** (4-column grid)
- Teams (blue accent), Seasons (green), Facilities (purple), Blockers (amber)
- Each: big number (JetBrains Mono 36px) + label + sub-detail
- Clickable, navigate to respective pages
- 3px colored top border, hover: translateY(-2px)

**4. Two-Column Content Area**
- **Left (60%): Today's Schedule** — Timeline of today + next 2 days' events with conflict badges inline. Games = filled circle, Practices = open circle. Clickable rows.
- **Right (40%): Active Blockers + Conflict Breakdown** — Stacked widgets. Active blockers with relative time ("Ends today", "Starts in 4 days"). CSS donut chart of conflicts by type (conic-gradient, no library).

**5. Quick Actions Bar** — Ghost buttons: + Add Game, + Add Practice, + Add Blocker, Import CSV

#### Backend Requirement
New endpoint: `GET /api/v1/schools/:schoolId/events/today`
- Returns games + practices for today + next 2 days
- Pre-checks conflict status for each event
- Sorted by datetime
- Avoids N+1 frontend calls

#### Multi-School Fallback
If user has >1 school, show school selector at top. Default to first school.

#### Animations
- Stat number count-up on mount
- Attention strip left-border pulse
- Card hover lift + shadow
- Live indicator dot pulse
- Staggered section fade-in with animation-delay

---

### F2: Clickable Conflict Rows

**GitHub Issue:** #2
**Priority:** High
**Effort:** Small

#### Problem
Clicking a conflict row in the table requires finding a specific button. Clicking the row itself does nothing. This violates standard data-table UX conventions.

#### Solution
Make the entire `<tr>` clickable. Clicking anywhere (except action buttons) opens the ConflictDetailPanel for that event.

#### Requirements
- Add `onClick` handler to `<tr>` in `ConflictRow.tsx`
- Add `cursor-pointer` and `hover:bg-gray-100` for visual affordance
- `e.stopPropagation()` on Reschedule link and Override button
- Row click triggers same behavior as conflict count badge click

---

### F3: Conflict Detail Panel with Inline Actions

**GitHub Issue:** #3
**Priority:** High
**Effort:** Medium

#### Problem
The ConflictDetailPanel is read-only. After understanding a conflict, the user must close the panel and find action buttons back in the table row. Reading and acting are disconnected.

#### Solution
Make the detail panel a **complete triage unit** — read the problem AND resolve it without leaving.

#### Requirements

**Actions Section** (below conflict info):
- **Reschedule Event** — Opens edit modal or navigates to event edit
- **Override Conflict** — Inline form in panel: text input for reason + confirm button (NOT a modal-within-a-modal)
- **View Full Schedule** — Link to team's season calendar

**Override Flow:**
- Text input for reason + "Override" confirm button, directly in the panel
- On success: panel updates to show override in a History section; conflict visually updates in the list behind (count decreases or row state changes)
- Real-time feedback without page refresh

**History Section:**
- Shows existing overrides: "Overridden by Burke on Feb 27 — Reason: Coach approved"
- Shows audit trail of actions taken on this conflict

**Sequential Triage:**
- "Next Conflict →" button at bottom of panel
- Advances to the next unresolved conflict without closing/reopening the panel
- Enables rapid sequential triage

---

### F4: Priority-Driven Resolution Suggestions

**GitHub Issue:** #4
**Priority:** High
**Effort:** Large

#### Problem
The priority rules engine (TRD-005) calculates scores but only exposes them in a comparison tool. The conflict list presents all 46 conflicts as equally important. The AD must manually reason through each one, even when the system already knows that Varsity Basketball (score: 85) should get the gym over JV Soccer (score: 42).

#### Solution
Integrate priority scoring into the conflict workflow. For each conflict, calculate scores for competing events and suggest a resolution with confidence levels.

#### Phase 1: Suggestions (Sprint 2)

**Backend:**
Extend conflicts endpoint: `GET /api/v1/schools/:schoolId/conflicts?includeSuggestions=true`

For each conflict, add a `suggestion` field:
```typescript
interface ConflictSuggestion {
  action: 'reschedule_lower' | 'override' | 'manual_review';
  targetEventId: string;
  targetEventName: string;
  reason: string;                // Human-readable: "Varsity Basketball (85) has priority over JV Soccer (42)"
  confidence: 'high' | 'medium' | 'low';
  priorityComparison: {
    winner: { eventId: string; name: string; score: number; factors: PriorityFactor[] };
    loser: { eventId: string; name: string; score: number; factors: PriorityFactor[] };
  };
}
```

**Confidence Levels:**
| Level | Score Gap | Example | UX Treatment |
|-------|-----------|---------|--------------|
| High | >15 points | Varsity game (85) vs JV practice (42) | Green badge, one-click "Apply" |
| Medium | 5-15 points | Varsity practice (65) vs JV game (55) | Yellow badge, review recommended |
| Low | <5 points | Both varsity, similar scores (78 vs 74) | Gray badge, "Manual review" |

**Frontend:**
- Suggestion badge on each ConflictRow: "Suggested: Reschedule JV Soccer" with confidence color
- Priority comparison in ConflictDetailPanel: side-by-side scores with factor breakdown
- "Apply Suggestion" button for high/medium confidence (one click to execute)

#### Phase 2: Auto-Rebalance (Future — Not Sprint 2)

`POST /api/v1/schools/:schoolId/conflicts/auto-resolve`

- Accepts scope (all/facility/team), confidence threshold, dry-run flag
- Dry-run shows preview: "Will reschedule 12 events, skip 3 (manual review)"
- User confirms, system applies changes
- **Not in Sprint 2 scope** — requires Phase 1 trust-building first

---

### F5: Batch Conflict Resolution

**GitHub Issue:** #5
**Priority:** Medium
**Effort:** Medium

#### Problem
Spring Midterm Exams creates 25 conflicts. Resolving each individually is unreasonable. Most share the same resolution pattern but there's no way to apply it at scale.

#### Solution
Add multi-select with bulk actions to the conflicts table.

#### Requirements

**Selection UI:**
- Checkbox column in ConflictsList/ConflictRow
- "Select All (filtered)" checkbox in table header — respects active filters
- `selectedIds: Set<string>` state in ConflictsPage

**Batch Actions Bar:**
Sticky bottom bar, appears when 1+ rows selected:
- Count: "X selected"
- **Override All** — Single reason input applied to all selected conflicts
- **Apply Suggestions** — (requires F4) Applies priority suggestions for all selected where confidence is high/medium
- **Clear Selection**

**Power Workflows:**
1. Filter by Facility = "Main Gymnasium" → Select All → Override All → "Gym maintenance approved"
2. Filter by Blocker Type = "EXAM" → Select All → Apply Suggestions → auto-resolves 18/25, flags 7 for manual review

**Backend:**
`POST /api/v1/conflicts/batch-override`
```typescript
interface BatchOverrideInput {
  overrides: Array<{
    eventType: 'GAME' | 'PRACTICE';
    eventId: string;
    blockerId: string;
  }>;
  reason: string;
}
// Returns: { succeeded: number; failed: number; errors: Array<{ eventId: string; error: string }> }
```

---

## User Journeys

### Journey 1: Morning Triage (Athletic Director)

1. **Open AthleticOS** → Dashboard loads
2. **See hero header**: "Good morning, Burke" / THU, FEB 27, 2026 / LIVE ● 3 events today
3. **See attention strip**: "46 CONFLICTS NEED RESOLUTION — Spring Midterm Exams affects 25 events"
4. **Click "Review All Conflicts →"** → Conflicts page loads
5. **See suggestion badges** on each row: most say "Suggested: Reschedule [lower-priority event]" (green/high confidence)
6. **Filter by Blocker Type = EXAM** → 25 conflicts shown
7. **Select All (filtered)** → 25 selected
8. **Click "Apply Suggestions"** → System resolves 18 high-confidence, reports "18 resolved, 7 need manual review"
9. **Click first remaining conflict row** → Detail panel slides in with inline actions
10. **Review priority comparison** → Both varsity, close scores → Manual decision
11. **Click "Override Conflict"** → Type reason inline → Confirm → Panel updates, advances to "Next Conflict →"
12. **Repeat for remaining 6** → All conflicts resolved
13. **Return to Dashboard** → Attention strip gone (0 conflicts). Today's schedule shows clean.

**Time:** ~5 minutes for 46 conflicts vs. ~45 minutes with current one-by-one workflow.

### Journey 2: Quick Check (Head Coach)

1. **Open AthleticOS** → Dashboard
2. **Scan Today's Schedule** → See "4:00 PM Varsity Basketball vs Fort Worth Christian — Main Gymnasium · HOME"
3. **No conflict badge** → Game is clear
4. **Done.** Total time: 10 seconds.

### Journey 3: Weather Emergency

1. **AD creates blocker**: "Ice Storm Warning" — WEATHER, SCHOOL_WIDE, today through tomorrow
2. **System detects 8 new conflicts** → Attention strip updates
3. **Click through to conflicts** → All 8 say "Suggested: Override (weather emergency)"
4. **Select All → Override All** → Reason: "Ice storm — all events postponed per Dr. Williams"
5. **8 conflicts resolved in one action**

---

## Non-Functional Requirements

### Performance
- Dashboard: initial load <2 seconds (single API call for today's events, parallel calls for stats)
- Conflict list with suggestions: <3 seconds for 100 conflicts with priority calculation
- Batch override: <5 seconds for 50 simultaneous overrides

### Accessibility
- WCAG 2.1 AA compliance (contrast ratios for all text/background combos)
- Keyboard navigation for conflict triage (Enter to expand row, Tab to actions, Escape to close panel)
- Screen reader support for stat blocks, attention strip urgency level

### Security
- All new endpoints require authentication (existing `authenticate` middleware)
- Batch override endpoint requires AD or ADMIN role
- Override audit trail includes user ID and timestamp

### Browser Support
- Chrome 90+, Safari 15+, Firefox 90+, Edge 90+
- Responsive: desktop-first, functional on tablet (1024px+)

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Time to resolve all conflicts | ~45 min (manual, one-by-one) | <5 min (with batch + suggestions) | User testing |
| Clicks to resolve single conflict | 6+ (scan → button → panel → close → button → act) | 2 (click row → act in panel) | UX audit |
| Dashboard time-to-insight | N/A (dashboard shows no operational data) | <3 seconds to understand today's status | User testing |
| Suggestion accuracy | N/A | >90% of "high confidence" suggestions accepted | Acceptance rate tracking |
| Demo impression | "Shows conflicts but doesn't help" | "This is like having a digital AD" | Stakeholder feedback |

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Accessibility gaps | Users with vision impairments can't use app | Low | Existing light theme has well-tested contrast ratios. Verify WCAG AA compliance on new dashboard components. |
| Priority suggestions are wrong | Users lose trust in system | Low (math is deterministic) | Always show reasoning (score breakdown). Never auto-apply without user confirmation in Phase 1. |
| Batch override of wrong conflicts | Mass incorrect data | Medium | "Apply Suggestions" defaults to dry-run preview. Override requires explicit reason. All overrides are audited and reversible. |
| Today's events endpoint is slow | Dashboard feels sluggish | Low | Single query with JOINs, not N+1. Cache for 30 seconds. |
| Feature creep into Phase 2 (auto-rebalance) | Sprint 2 takes too long | Medium | Auto-rebalance is explicitly out of scope. Only suggestions + manual/batch apply. |

---

## Feature Prioritization (RICE)

| Feature | Reach | Impact | Confidence | Effort | RICE Score | Priority |
|---------|-------|--------|------------|--------|------------|----------|
| F2: Clickable Rows | All users | Medium (3) | High (1.0) | Small (0.5) | 6.0 | 1 (do first) |
| F3: Inline Actions | All users | High (4) | High (0.9) | Medium (1) | 3.6 | 2 |
| F4: Smart Suggestions | All users | Very High (5) | High (0.8) | Large (2) | 2.0 | 3 |
| F1: Dashboard | All users | High (4) | Medium (0.7) | Large (3) | 0.93 | 4 |
| F5: Batch Resolution | AD only | Very High (5) | Medium (0.7) | Medium (1.5) | 2.33 | 3 (tie) |

**Recommended build order:** F2 → F3 → F4 → F5 → F1

Rationale: F2 and F3 are UX prerequisites that make the conflict workflow usable. F4 adds intelligence. F5 adds scale. F1 is the showpiece but depends on the underlying workflow being solid — build the engine before the dashboard that showcases it.

---

## Acceptance Criteria

### F1: Dashboard
- [ ] Single-school user sees Dashboard on login (no school card intermediate)
- [ ] Hero header shows school name, current date/time, personalized greeting, live event count
- [ ] Attention strip shows total conflicts + top blockers when conflicts > 0
- [ ] Attention strip is completely hidden when conflicts = 0
- [ ] Stat blocks show Teams, Seasons, Facilities, Blockers with sub-details
- [ ] Stat blocks are clickable and navigate to correct pages
- [ ] Today's Schedule shows events for today + next 2 days with conflict badges
- [ ] Active Blockers widget shows current + upcoming blockers with relative time
- [ ] Conflict Breakdown widget shows donut chart by type
- [ ] Quick Actions bar has functional buttons for Add Game, Practice, Blocker, Import
- [ ] Existing light theme used consistently across Dashboard, SchoolDetail, ConflictsPage, all modals
- [ ] Page loads in <2 seconds

### F2: Clickable Conflict Rows
- [ ] Clicking anywhere in a conflict table row opens the detail panel
- [ ] Clicking Reschedule or Override buttons does NOT trigger row click
- [ ] Rows show cursor-pointer and hover state
- [ ] Keyboard: Enter key on focused row opens detail panel

### F3: Inline Actions in Detail Panel
- [ ] Detail panel shows Override form (reason input + confirm) inline
- [ ] Detail panel shows Reschedule button linking to event edit
- [ ] Detail panel shows "View Full Schedule" link
- [ ] After override, panel shows success + override in History section
- [ ] After override, conflict list updates without page refresh
- [ ] "Next Conflict →" button advances to next unresolved conflict
- [ ] Override history shows who, when, and reason

### F4: Priority-Driven Suggestions
- [ ] Conflicts list shows suggestion badge per row when `includeSuggestions=true`
- [ ] Badge shows recommended action + confidence level (high/medium/low)
- [ ] Detail panel shows priority comparison: winner vs loser with scores and factors
- [ ] "Apply Suggestion" button executes the recommended action
- [ ] High confidence (>15 gap): green badge, one-click apply
- [ ] Medium confidence (5-15 gap): yellow badge, review recommended
- [ ] Low confidence (<5 gap): gray badge, manual review
- [ ] Score calculation matches TRD-005 algorithm exactly

### F5: Batch Conflict Resolution
- [ ] Checkbox column appears in conflict table
- [ ] "Select All" checkbox respects current filters
- [ ] Sticky batch action bar appears when 1+ rows selected
- [ ] "Override All" opens single-reason form, applies to all selected
- [ ] Batch override backend processes all items, returns success/failure counts
- [ ] "Apply Suggestions" applies high/medium confidence suggestions for selected items
- [ ] Results summary shows resolved count, skipped count, errors

---

## Dependencies & Sequencing

```
Sprint 2 Build Order:

Week 1:
├── F2: Clickable Rows (0.5 day)         ─── no dependencies
├── F3: Inline Actions (2 days)           ─── depends on F2
└── Backend: events/today endpoint (1 day) ─── no dependencies

Week 2:
├── F4: Smart Suggestions (3 days)        ─── depends on F3, TRD-005
└── F5: Batch Resolution (2 days)         ─── depends on F3, F4 (partial)

Week 3:
├── F1: Dashboard (3 days)           ─── depends on events/today endpoint
└── Integration testing + polish (2 days)
```

**Hard dependencies:**
- F3 depends on F2 (row click opens panel where actions live)
- F4 depends on TRD-005 Priority Rules Engine (already complete)
- F5's "Apply Suggestions" depends on F4 (batch override can ship independently)
- F1 depends on new `events/today` backend endpoint

**Can be parallelized:**
- F2 + events/today backend endpoint (independent)
- F1 frontend + F4 backend (independent tracks)
