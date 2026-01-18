# PRD-001: Constraint-Aware Schedule Reconciliation

> Status: Complete
> Created: 2026-01-12
> Last Updated: 2026-01-16

## Problem Statement

High-school head coaches managing multiple teams (Varsity, JV, Freshman) and shared facilities spend significant time coordinating schedule changes through group texts, email threads, and manual calendar edits. Conflicts are often discovered late—sometimes the day of an event—leading to rushed rescheduling and short notice to families.

The core pain is not *creating* schedules. Coaches already have season plans. The pain is **reconciling planned schedules with reality** as constraints emerge: exam weeks, facility maintenance, school-wide events, weather, and competing facility demands.

## Target User

**Primary:** Head coach responsible for multiple teams sharing facilities at a single school.

**Characteristics:**
- Manages 2-4 teams across levels (Varsity, JV, Freshman)
- Shares facilities with other sports programs
- Already has a season schedule (partial or complete)
- Deals with frequent schedule changes from external factors
- Communicates with parents via group text, email, or apps like SportsYou

## Core Capability

**Constraint-aware reconciliation engine** — not a full auto-scheduler.

AthleticOS treats blockers (exams, maintenance, school events, travel blackouts) as first-class constraints. When a coach creates or modifies an event, the system immediately surfaces conflicts and explains *why* ("exam blackout", "facility unavailable", "double-booked with JV practice").

This is **reconciliation**, not optimization:
- Coach defines or imports existing schedule
- System detects violations against known constraints
- Coach resolves conflicts with full visibility
- Schedule is published with confidence

## What This Is NOT

- **Not a league scheduler** — We don't generate optimal round-robin matchups
- **Not an optimizer** — We don't solve NP-hard scheduling problems
- **Not a replacement for SportsYou** — We reconcile, they communicate (for now)

## Success Metrics (from Working-Backwards PR)

| Metric | Target |
|--------|--------|
| Time to finalize/communicate schedule updates | < 15 minutes |
| Reduction in scheduling-related back-and-forth messages | > 70% |
| Events with 48+ hours advance notice to parents | Majority |
| Conflicts resolved before schedule published | Most |

## Scope

### In Scope (Round 1)

1. **Blockers as first-class entities**
   - Types: Exam periods, facility maintenance, school-wide events, travel blackouts, custom
   - Scopes: Team-specific, facility-specific, school-wide
   - Time-bound with start/end datetime

2. **Constraint enforcement**
   - Blockers prevent scheduling during blocked periods
   - Facility availability windows (already have TimeSlot model)
   - Basic rules: "No games during exam week", "Facility X unavailable"

3. **Conflict detection service**
   - On create/update of Game or Practice, check against all applicable blockers
   - Return list of violations with human-readable explanations
   - Non-blocking (warn, don't prevent) — coach has final say

4. **Conflict display in UI**
   - Warnings shown before saving event
   - Schedule view with conflict overlay (visual indicators on problem events)
   - Conflict detail: what rule is violated, suggested resolution (optional in v1)

5. **Schedule import**
   - CSV import for existing season schedules
   - Manual entry (already built)

### Out of Scope (Future Phases)

- Full schedule generation / optimization
- Google Calendar integration (see [ROADMAP.md](../ROADMAP.md))
- SportsYou export/sync
- Weather-based rescheduling suggestions
- Cross-school / league coordination
- Advanced role permissions beyond current admin/coach/viewer

## User Stories

### US-1: Define Exam Week Blocker
> As a head coach, I want to mark exam week as a school-wide blocker so that no practices or games can be scheduled during that period.

**Acceptance Criteria:**
- Can create blocker with type "Exam", scope "School-wide", date range
- Blocker appears in calendar view
- Any event created during blocker period shows warning

### US-2: See Conflicts on Existing Schedule
> As a head coach, I want to see which of my already-scheduled events conflict with blockers so I can fix them before the season starts.

**Acceptance Criteria:**
- Schedule view highlights events with conflicts
- Can click event to see conflict details
- Conflict count shown in season summary

### US-3: Get Warning When Creating Conflicting Event
> As a coach, I want to be warned when I try to schedule a practice during a blocked period so I can choose a different time.

**Acceptance Criteria:**
- On save, if conflicts exist, show warning modal
- Warning explains the conflict (e.g., "Conflicts with: Final Exams (Dec 15-19)")
- Can proceed anyway (override) or cancel to fix

### US-4: Mark Facility Maintenance
> As an athletic director, I want to mark the gym as unavailable for resurfacing so that no events are scheduled there during that time.

**Acceptance Criteria:**
- Can create blocker with type "Maintenance", scope "Facility", select facility
- Events at that facility during blocker show warning
- Other facilities unaffected

### US-5: Import Existing Schedule
> As a coach, I want to import my season schedule from a spreadsheet so I don't have to re-enter every game manually.

**Acceptance Criteria:**
- CSV upload with columns: date, time, opponent, home/away, facility
- Preview before import
- Conflicts detected and shown after import

## Phases

### Phase 1: Blockers & Constraints (TRD-001)
- Blocker entity and CRUD
- Blocker types and scopes
- API endpoints
- Basic UI for managing blockers

### Phase 2: Conflict Detection Service (TRD-002)
- Conflict detection logic
- Integration with Game/Practice create/update
- Conflict response format

### Phase 3: Reconciliation UI (TRD-003)
- Warning modals on conflict
- Schedule view with conflict indicators
- Conflict detail panel

### Phase 4: Schedule Import & Shareable Links (TRD-004)
- CSV parsing and validation
- Import preview
- Bulk conflict detection
- Parent-facing shareable schedule links (completed)

### Phase 5: External Integration — Deferred
- Google Calendar read-only import (see [ROADMAP.md](../ROADMAP.md))

## Dependencies

- Existing CRUD for Schools, Teams, Seasons, Facilities, Games, Practices
- Existing TimeSlot model for facility availability
- Auth and multi-tenancy middleware

## Design Decisions

1. **Override tracking:** Yes — log when a coach overrides a conflict warning. Helps tune constraints and understand which rules are too strict.

2. **Blocker inheritance:** Auto-apply to all. School-wide blockers automatically block all teams and facilities. Simpler mental model.

3. **Soft vs hard blockers:** All soft (warn only). Coach can always override any blocker. Maximum flexibility, trust the coach.

4. **Retroactive conflicts:** Show on dashboard. When a blocker is added and creates new conflicts, surface "X events now conflict" notification. Coach resolves manually.

## Appendix: Working-Backwards Press Release

[See original PR in conversation history — defines the "announce backwards" vision for what we're building toward]
