# PRD-004: Sprint 3 -- Complete Athletic Operations Platform

> Status: Draft
> Created: 2026-03-13
> Last Updated: 2026-03-13
> Author: Burke (Product/Engineering)
> Target School: Trinity Christian Academy (TCA)
> Sprint: 3
> Dependencies: PRD-003 (Sprint 2 complete), TRD-008 (Sprint 2 implementation)

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-03-13 | Initial draft consolidating features from ChatGPT PRD, PRD-002 deferred items, and PRD-003 Phase 2 items |
| v1.1 | 2026-03-13 | Stakeholder refinement: Resend SMS replaces Twilio, school-level permission scoping, drag-drop marked optional, time estimates removed |
| v1.2 | 2026-03-13 | Added SchoolDude replacement features (F9-F11), reorganized into 4 themes |
| v1.3 | 2026-03-13 | Final refinement: added Coordinator persona, lightweight community accounts for F9, F6 deprioritized to P2, added mobile UX section |
| v1.4 | 2026-03-13 | Fixed schema status: all new models need to be created from scratch (not 'already committed') |

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Business Context](#business-context)
4. [User Personas](#user-personas)
5. [Current State Assessment](#current-state-assessment)
6. [Solution Overview](#solution-overview)
7. [Feature Specifications](#feature-specifications)
   - [F1: Role-Based Permission Enforcement](#f1-role-based-permission-enforcement)
   - [F2: Enhanced Conflict Detection](#f2-enhanced-conflict-detection)
   - [F3: Notification System](#f3-notification-system)
   - [F4: Weekly Board Grid](#f4-weekly-board-grid)
   - [F5: Personal Calendar Feeds](#f5-personal-calendar-feeds)
   - [F6: Quick-Add Event Parsing](#f6-quick-add-event-parsing)
   - [F7: Bulk Operations](#f7-bulk-operations)
   - [F8: Print-Friendly Week View](#f8-print-friendly-week-view)
   - [F9: Facility Request & Approval Workflow](#f9-facility-request--approval-workflow)
   - [F10: Event Setup & Teardown Checklists](#f10-event-setup--teardown-checklists)
   - [F11: Recurring Event Patterns](#f11-recurring-event-patterns)
8. [User Journeys](#user-journeys)
9. [Non-Functional Requirements](#non-functional-requirements)
10. [Success Metrics](#success-metrics)
11. [Risks and Mitigations](#risks-and-mitigations)
12. [Feature Prioritization (RICE)](#feature-prioritization-rice)
13. [Acceptance Criteria](#acceptance-criteria)
14. [Dependencies & Sequencing](#dependencies--sequencing)
15. [Deferred Features (Sprint 4+)](#deferred-features-sprint-4)

---

## Executive Summary

Sprints 1 and 2 delivered AthleticOS's core: constraint-aware scheduling, conflict detection with priority-based resolution, a dashboard operations hub, batch triage, invite/join flow, and schedule sharing. TCA's demo data showcases 12 teams, 7 facilities, and 46+ conflicts that can be triaged in minutes instead of hours.

**The problem now is not resolution -- it's the daily scheduling workflow and keeping people informed.**

A coach still has to navigate through list views and modals to schedule a practice. Parents have no way to get notified when things change. The conflict engine catches blocker overlaps but misses facility double-bookings and multi-sport athlete collisions. Roles exist in the database but aren't enforced -- any authenticated user can mutate any data.

Sprint 3 transforms AthleticOS from a conflict resolution platform into a **complete scheduling operations system** by delivering:

1. **Permission enforcement** -- Roles stop being decorative and start controlling access.
2. **Enhanced conflict detection** -- Facility double-bookings, resource collisions, and athlete overlaps join the existing blocker-based engine.
3. **Notifications** -- Parents never check the app again. Changes come to them via SMS and email.
4. **Weekly board grid** -- A visual scheduling surface where click-to-create and inline editing replace forms and modals.
5. **Calendar feeds** -- Subscribe once, stay current forever via iCal.
6. **Quick-add parsing** -- Type "Tue 3:30-5pm Gym A" and the event appears.
7. **Bulk operations** -- Shift a week, trigger a rain plan, or auto-resolve conflicts in one action.
8. **Print view** -- Hand a clean one-page schedule to anyone who needs paper.
9. **Facility request & approval** -- Replace SchoolDude's generic room-booking with a sports-aware request workflow.
10. **Event setup checklists** -- Game-day operations tied to the athletic calendar, not disconnected work orders.
11. **Recurring events** -- "Every Tuesday and Thursday for basketball season" in one action, not 36 individual entries.

Sprint 3 also positions AthleticOS as a **direct replacement for SchoolDude** (Brightly/Siemens), the generic facility management tool TCA currently uses for athletic scheduling. SchoolDude has no concept of sports, seasons, or teams -- it's a room-booking tool. By adding facility request/approval workflows, event setup checklists, and recurring season-aware scheduling, AthleticOS eliminates TCA's need for SchoolDude entirely.

The end state: Coach Truman opens AthleticOS, types "Tue 3:30 Gym A vs Oakridge" into the quick-add bar, sees the event snap into the weekly grid, gets a green check (no conflicts), and knows that every parent on the team will receive an SMS within 60 seconds. That is coach-speed scheduling.

---

## Problem Statement

### What We Learned from Sprints 1-2

1. **Roles are decorative.** The ADMIN, ATHLETIC_DIRECTOR, COACH, PARENT, and ATHLETE roles exist, but almost no endpoint enforces them. A parent could theoretically create a game or override a conflict. This is a security and trust issue that must be resolved before onboarding real users beyond the demo.

2. **Conflict detection has blind spots.** The engine only checks events against blockers. It does not detect:
   - Two teams booking the same facility at the same time (facility double-booking)
   - A multi-sport athlete scheduled for two overlapping events (person collision)
   - A bus or referee assigned to two overlapping events (resource collision)

   These are the most common scheduling mistakes in real athletic departments. Missing them undermines trust in the system.

3. **Nobody gets notified.** When a practice time changes, the coach has to manually text parents. No Notification or NotificationPreference models exist in the schema yet. The entire value proposition of "parents never have to check the app" is unfulfilled.

4. **The calendar is a list, not a visual tool.** The CalendarTab shows events in a sortable table. Coaches think in weeks -- they need to see Monday through Friday at a glance, spot gaps, and quickly create or edit events. A list view requires reading each row and mentally constructing the week. A grid shows it instantly.

5. **Scheduling still requires forms.** Creating a practice means: click button, fill modal (6 fields), save. A coach juggling 3 teams and a phone call needs to type "Tue 3:30 Gym A" and be done. The form is fine for complex events but overkill for the 80% case.

6. **SchoolDude is a square peg in a round hole.** TCA uses SchoolDude (Brightly) for facility reservations because there's nothing better. It has no concept of sports, seasons, teams, or game-day operations. Coaches submit facility requests through a generic room-booking interface. The AD approves them one-by-one (no bulk approval). Recurring schedules are capped at 100 days (a school year is 180). Setup and teardown coordination happens through text messages, not the system. SchoolDude was breached in 2023 (3M accounts exposed). AthleticOS can replace it entirely for athletic operations.

### The Cost of Not Solving This

Without permission enforcement, AthleticOS cannot be deployed to real users. Without notifications, parents still rely on group texts. Without the weekly grid, coaches still schedule slower than necessary. Each gap is tolerable in a demo but unacceptable in production. Sprint 3 closes the gap between "impressive demo" and "daily-use tool."

---

## Business Context

| Aspect | Detail |
|--------|--------|
| Sprint | 3 (follows Sprint 2: TRD-008, PR #6) |
| Target users | Coach Truman (primary), AD (vacant), Dr. Jeff Williams (HOS), parents, athletes |
| Sprint goal | Production-ready scheduling workflow with notifications and real access control |
| Schema readiness | All new models need migration. Existing schema: User, SchoolUser, School, Team, Season, Facility, TimeSlot, Game, Practice, Blocker, ConflictOverride, ScheduleShare, PriorityRule, Invite |
| External services | Resend (email + SMS, already integrated for email) |
| Strategic angle | Replace SchoolDude (Brightly/Siemens) for athletic facility scheduling |

---

## User Personas

### Primary: Coach Truman
The hands-on user. Schedules 3 teams, juggles facilities, fields parent questions. Needs to schedule in seconds, see conflicts immediately, and trust that parents will be notified without manual effort. "Make my week work."

**Daily workflow:**
1. Open AthleticOS, glance at the weekly board
2. Type quick-add for a new practice
3. Click-to-edit an event to resolve a time conflict
4. Trust that the system notified parents of the change

### Secondary: Athletic Director (Vacant at TCA)
Multi-team visibility, facility utilization oversight, override authority. Needs to see all teams' events on the same grid, run rain plans, and shift entire weeks when dismissal times change.

### Coordinator (The "Kathy" Role)
The day-to-day operator. Currently a semi-retired coach at TCA filling in after the coordinator and AD departed. Imports schedules, manages blockers, processes facility requests, tracks event readiness. Needs clear task lists, guided workflows, and nothing that requires technical expertise.

**Daily workflow:**
1. Check pending facility requests — approve or flag for AD
2. Review upcoming events — are checklists complete? Any gaps?
3. Process new blocker (exam week, maintenance) — see impact across all teams
4. Update event operations — mark tasks as done, assign remaining items

> **UX Note:** Same UI as other roles with smart defaults and contextual help text. Do not build a separate coordinator-specific experience. The Coordinator uses the AD dashboard with a task-oriented mindset.

### Tertiary: Head of School (Dr. Jeff Williams)
30-second status check. Green/yellow/red. The dashboard from Sprint 2 already serves this need. Sprint 3 ensures the data behind it is more accurate (enhanced conflicts) and that the school's communication is professional (notifications instead of group texts).

### Quaternary: Parent
Never opens the app. Changes come to them via SMS, email, or iCal subscription. Sprint 3 finally delivers this promise.

### Quinary: Athlete
Sees own schedule, gets notifications for changes. Calendar feed syncs to phone.

---

## Current State Assessment

### What Exists (Sprints 1-2 + Post-Sprint)

| Component | Status | Notes |
|-----------|--------|-------|
| Game & Practice CRUD | Complete | Full lifecycle with CSV import |
| Blocker system | Complete | 7 types, school-wide + team-specific |
| Conflict detection (blocker-based) | Complete | Accurately detects blocker-event overlaps |
| Conflict triage + batch override | Complete | Clickable rows, inline actions, suggestions, batch resolution |
| Priority rules engine | Complete | Configurable weights, score comparison, audit trail |
| Dashboard operations hub | Complete | Hero header, attention strip, stat blocks, today's schedule, conflict donut |
| Schedule sharing | Complete | Public links, iCal export, embed code |
| Auth + Roles | Partial | JWT auth works; roles stored but not enforced on endpoints |
| Invite system | Complete | Resend email integration, accept page, members UI |
| Notification/NotificationPreference | Not started | New schema, service, and routes needed |
| CalendarFeed | Not started | New schema, service, and routes needed |
| EventParticipant | Not started | New schema, service, and routes needed |
| Resource/EventResource | Not started | New schema, service, and routes needed |
| User.phone column | Not started | Needs migration to add column |

### What's Missing

| Gap | Impact |
|-----|--------|
| No role enforcement | Security risk; can't onboard real users |
| No facility/resource/person conflict detection | Most common scheduling mistakes go undetected |
| No notification delivery | Parents rely on manual group texts |
| No visual weekly view | Coaches can't see their week at a glance |
| No calendar feed generation | Parents can't subscribe to stay current |
| No quick-add | Every event requires a 6-field form |
| No bulk week operations | Daylight saving, rain plans require manual event-by-event changes |
| No print view | Coaches can't hand a paper schedule to officials/custodians |
| No facility request/approval workflow | AD approves requests via SchoolDude's dated UI, one-by-one |
| No event operations checklists | Game-day setup coordinated via text messages |
| No recurring event creation | Each practice created individually or CSV-imported |

---

## Solution Overview

Sprint 3 is organized as eleven features across four themes:

```
THEME 1: TRUST & SECURITY
F1: Role-Based Permission Enforcement
    "The right people can do the right things"

THEME 2: INTELLIGENCE & DETECTION
F2: Enhanced Conflict Detection
    "Catch every scheduling mistake, not just blockers"
F3: Notification System
    "Changes reach the right people, automatically"

THEME 3: SCHEDULING UX
F4: Weekly Board Grid
    "See your week, move your events"
F5: Personal Calendar Feeds
    "Subscribe once, stay current forever"
F6: Quick-Add Event Parsing
    "Type it, don't click it"
F7: Bulk Operations
    "Fix a whole week in one action"
F8: Print-Friendly Week View
    "Paper when you need it"
F11: Recurring Event Patterns
    "Set it once for the whole season"

THEME 4: FACILITY OPERATIONS (SCHOOLDUDE REPLACEMENT)
F9: Facility Request & Approval Workflow
    "Replace SchoolDude with something that understands sports"
F10: Event Setup & Teardown Checklists
    "Game-day operations, not work orders"
```

F1 is the security prerequisite. F2 and F3 are intelligence layers. F4 through F8 and F11 are scheduling UX accelerators. F9 and F10 replace SchoolDude for athletic facility operations.

---

## Feature Specifications

### F1: Role-Based Permission Enforcement

**Priority:** P0 (Quick Win)

#### Problem
Roles (ADMIN, ATHLETIC_DIRECTOR, COACH, PARENT, ATHLETE, COMMUNITY) are stored on the User model but only checked on a few endpoints. Most mutation routes accept any authenticated user. This is a blocker for production deployment.

#### Solution
Apply `requireRole()` middleware to all mutation routes. Enforce **school-level scoping** via school membership check. Team-level scoping deferred until coach-to-team relationships are added (future roster feature).

#### Permission Matrix

| Action | Admin | AD | Coach | Parent | Athlete | Community |
|--------|-------|----|-------|--------|---------|-----------|
| Create/edit events | Yes | Yes | Yes (own school) | No | No | No |
| View events | Yes | Yes | Yes (own school) | Own child's teams (conceptual) | Own teams (conceptual) | No |
| Manage facilities | Yes | Yes | No | No | No | No |
| Manage resources | Yes | Yes | No | No | No | No |
| Override conflicts | Yes | Yes | Yes (own school) | No | No | No |
| Configure notifications | Yes | Yes | Yes (own school) | Self only | Self only | No |
| Manage school settings | Yes | Yes | No | No | No | No |
| Invite members | Yes | Yes | No | No | No | No |
| View all teams | Yes | Yes | No | No | No | No |
| Submit facility requests | Yes | Yes | Yes | No | No | Yes (own only) |
| View own facility requests | Yes | Yes | Yes | No | No | Yes |

> **Note:** Parent/Athlete view scoping (own child's teams, own teams) is conceptual for now. The system enforces school membership but does not yet have the roster relationships to restrict within a school. This will be implemented when the roster feature ships.

#### Implementation

1. **Middleware**: Create `requireRole(...roles: Role[])` Fastify hook that checks `request.user.role` against allowed roles. Returns 403 with clear error message.
2. **School scoping**: Verify the authenticated user belongs to the school referenced in the route via school membership check. Coaches, parents, and athletes can only access data within their own school.
3. **Route annotation**: Apply middleware to every route in `modules/*/routes.ts`. Group by permission level.
4. **Audit**: Add `permissionDenied` event logging for security monitoring.

#### Edge Cases
- Coach can access all teams within their school (school-level scoping, not team-level)
- Parent with multiple children can access their school's data
- ADMIN bypasses all scoping checks
- Unauthenticated requests continue to return 401 (existing behavior)

---

### F2: Enhanced Conflict Detection

**Priority:** P0

#### Problem
The conflict engine only detects blocker-event overlaps. It misses the three most common real-world scheduling collisions: facility double-bookings, multi-sport athlete overlaps, and resource (bus/referee) double-assignments.

#### Solution
Extend the conflict detection engine with three new conflict types and add smart slot suggestions.

#### New Conflict Types

**1. Facility Double-Booking** (severity: `error`)
- When: Two events assigned to the same facility have overlapping time ranges
- Detection: Query all events for a facility in the date range, compare time windows
- Tolerance: Events that end exactly when another starts (back-to-back) are NOT conflicts
- Display: "Main Gymnasium is double-booked: Varsity Basketball Practice (3:30-5:00) overlaps with JV Volleyball Practice (4:00-5:30)"

**2. Multi-Sport Athlete Overlap** (severity: `warning`)
- When: An EventParticipant appears in two events with >5 minute overlap
- Detection: Query EventParticipant records, join to events, compare times
- Prerequisite: EventParticipant records must be populated (manual or roster-based)
- Display: "Alex Johnson is scheduled for Varsity Soccer (3:30-5:00) and JV Basketball (4:30-6:00) -- 30 min overlap"

**3. Resource Double-Assignment** (severity: `error`)
- When: An EventResource (bus, referee) is assigned to two events with overlapping times
- Detection: Query EventResource records, join to events, compare times
- Display: "Bus #3 is assigned to both Varsity Football @ Arlington (depart 1:00) and JV Soccer @ Ft Worth (depart 1:30)"

#### Conflict Severity Levels

| Severity | Types | UX Treatment |
|----------|-------|--------------|
| `error` | Facility double-book, Resource double-assign | Red badge, blocks save without override |
| `warning` | Person overlap, Blocker overlap (existing) | Amber badge, allows save with warning |

#### Smart Slot Suggestions

When a conflict is detected, scan the next 10 available 30-minute slots for the same facility and return them scored by:
- **Proximity**: Closer to original time scores higher
- **Conflict count**: Fewer conflicts in the slot scores higher
- **Same day preference**: Same-day alternatives score higher than next-day

#### Weather Impact Analysis

When creating a WEATHER blocker:
1. Query all events in the blocker's date range
2. Filter to outdoor facility types (FIELD, COURT, TRACK)
3. Return affected events grouped by team with batch response options:
   - Override all (acknowledge and keep)
   - Cancel all
   - Move to indoor fallback (requires F7 Rain Plan)

#### New Endpoints

- `POST /api/v1/schools/:schoolId/check-conflicts` -- Run full conflict check across all types for a given date range or event. Body: `{ eventId?: string, dateRange?: { start, end } }`. Returns array of typed conflicts.
- `POST /api/v1/schools/:schoolId/suggest-slots` -- Given an event or time/facility, return next 10 available slots. Body: `{ facilityId, date, duration, preferredTime? }`. Returns scored slot array.

#### Integration with Existing Engine

The existing `GET /conflicts` endpoint gains a `types` query parameter:
- `?types=blocker` (default, backward compatible)
- `?types=blocker,facility,person,resource` (full scan)
- `?types=all` (shorthand for all types)

New conflict types use the same `ConflictSuggestion` interface from Sprint 2.

---

### F3: Notification System

**Priority:** P0

#### Problem
When a practice time changes, the coach manually texts parents. No Notification or NotificationPreference models exist yet -- this is entirely new work. The "parents never have to check the app" promise is unfulfilled.

#### Solution
Build a complete notification service with new schema, service logic, and routes, using Resend for both email and SMS (same provider, same API, simpler integration).

#### Channels

| Channel | Provider | Status |
|---------|----------|--------|
| Email | Resend | Already integrated (invites). Extend to notifications. |
| SMS | Resend | Same provider as email. Resend recently added SMS support -- no new vendor needed. |

#### Notification Triggers

| Trigger | Channel | Recipients | Priority |
|---------|---------|------------|----------|
| Event created | Email | Team members (coaches, athletes, parents) | Normal |
| Event time/place changed | SMS + Email | Team members + parents | High |
| Event cancelled | SMS + Email | Team members + parents | High |
| New blocker affects events | Email | Affected coaches | Normal |
| Weather emergency | SMS + Email | All affected coaches + parents | Urgent |
| Weekly operations digest | Email | AD, Coordinator | Low (Monday 7:00 AM) |

#### Notification Preferences

Users configure per-channel preferences:

```typescript
interface NotificationPreference {
  userId: string;
  emailEnabled: boolean;       // default: true
  smsEnabled: boolean;         // default: false (opt-in)
  quietHoursStart: string;     // e.g., "21:00" (9 PM)
  quietHoursEnd: string;       // e.g., "07:00" (7 AM)
  digestMode: boolean;         // false = immediate, true = daily digest
  digestTime: string;          // e.g., "07:00" for morning digest
}
```

#### Quiet Hours

- Messages generated during quiet hours are queued, not sent
- When the quiet window ends, queued messages are batched into a single digest
- Urgent notifications (weather emergency) bypass quiet hours

#### SMS Details

- **Format**: `[AthleticOS] {team} {eventType} {action} to {day} {time} @ {facility}. View: {link} Opt out: {optOutLink}`
- **Example**: `[AthleticOS] Varsity Soccer practice MOVED to Tue 3:30pm @ Gym A. View: https://athleticos.co/e/abc123 Opt out: https://athleticos.co/sms-stop`
- **Max length**: 160 characters (single segment). Truncate facility name if needed.
- **Opt-out**: Handled via a link in the SMS message (not carrier-level STOP). The link opens a one-tap opt-out page that marks `smsEnabled = false` on the user's preferences. Resend SMS handles opt-out differently from traditional carrier STOP keywords.
- **Phone number**: Requires adding `phone` column to User model (new migration needed).

#### Email Details

- **From**: notifications@athleticos.co (verified Resend domain)
- **Templates**: Plain HTML, mobile-friendly, school branding (name + colors)
- **Digest**: Groups all changes since last send into a single email with sections per team

#### Weekly Digest

- Sent Monday at 7:00 AM local time
- Recipients: users with AD or ADMIN role
- Contents: events created/modified/cancelled in past 7 days, active conflicts, upcoming blockers
- Implemented via scheduled job (cron or Render cron job)

#### Architecture

```
Event Mutation (create/update/delete)
  └── NotificationService.emit(trigger, payload)
        ├── Resolve recipients (team members, role filter)
        ├── Check preferences (channel enabled, quiet hours)
        ├── Queue or send immediately
        │   ├── Email: Resend API
        │   └── SMS: Resend API
        └── Write Notification record (audit trail)
```

#### New Endpoints

- `GET /api/v1/notifications/preferences` -- Get current user's notification preferences
- `PUT /api/v1/notifications/preferences` -- Update preferences. Body: `NotificationPreference` fields.
- `GET /api/v1/schools/:schoolId/notifications` -- Admin view: recent notification log with delivery status. Paginated.
- `POST /api/v1/schools/:schoolId/notifications/test` -- Send a test notification to the current user. Body: `{ channel: 'email' | 'sms' }`.

#### Error Handling

- Failed SMS: retry once after 30 seconds, then mark as failed in Notification record
- Failed email: retry once after 60 seconds, then mark as failed
- Invalid phone number: mark user's SMS as disabled, notify user via email
- Rate limiting: Resend rate limits respected via queue with backoff

---

### F4: Weekly Board Grid

**Priority:** P1 (Headline UX Feature)

#### Problem
The CalendarTab is a list view. Coaches think in weeks -- they need to see Monday through Friday at a glance, spot gaps, and quickly create or edit events. A list requires mentally constructing the week from rows. A grid shows it instantly.

#### Solution
A visual weekly scheduling grid with click-to-create, click-to-edit, keyboard shortcuts, filters, and conflict badges. Drag-and-drop is an optional enhancement that ships if time allows.

#### Layout

```
+-----------------------------------------------------------------------+
| [Quick Add: "Tue 3:30-5pm Gym A"]              [Rain Plan] [Print]    |
+--------+--------+--------+--------+--------+--------+--------+--------+
|  Time  |  Mon   |  Tue   |  Wed   |  Thu   |  Fri   |  Sat   |  Sun   |
+--------+--------+--------+--------+--------+--------+--------+--------+
|  3:30  |        | Prac   |        | JV     |        |        |        |
|  4:00  | Game   | Gym A  | Prac   | Field  | Prac   |        |        |
|  4:30  | vs Oak | [!] 1  | Gym B  |        | Gym A  | Game   |        |
|  5:00  | Field A|        |        |        |        | vs Elm |        |
+--------+--------+--------+--------+--------+--------+--------+--------+
```

#### Grid Specifications

- **Columns**: Mon-Sun (7 days)
- **Rows**: 30-minute increments, 7:00 AM - 10:00 PM (default). Configurable start/end.
- **Week navigation**: Previous/Next week buttons + date picker + "Today" button
- **Event cards**: Positioned by start time, height proportional to duration
  - Blue background: Game
  - Green background: Practice
  - Red outline: Has conflict(s)
  - Amber outline: Has warning(s)
- **Card content**: Event type icon, opponent/notes (first line), facility (second line), conflict badge count

#### Core Interactions

**Click Empty Slot -- Quick Create**
1. Click any empty cell
2. Popover appears with: date (pre-filled from column), time (pre-filled from row), team (dropdown), facility (dropdown), type (game/practice toggle)
3. "Create" saves, "Expand" opens full create modal
4. Conflict check runs on create

**Click Event Card -- Inline Edit**
1. Click event card to select it (blue ring)
2. Click field text (time, facility) to edit inline
3. Tab to next field, Enter to save, Escape to cancel
4. Changes trigger conflict check + notifications

**Keyboard Shortcuts**
| Key | Action |
|-----|--------|
| N | New event (opens quick create for selected slot) |
| E | Edit selected event |
| Delete/Backspace | Delete selected event (with confirmation) |
| Arrow keys | Navigate between cells |
| Escape | Deselect / close popover |

#### Filters

- **Team filter**: Dropdown to show one team or all teams (default: current user's teams)
- **Facility filter**: AD can view all events for a specific facility (cross-team)
- **Type filter**: Games only, Practices only, or both

#### Responsive Behavior

- **Desktop (>=1024px)**: Full grid
- **Tablet (768-1023px)**: Grid with narrower columns, abbreviated text
- **Mobile (<768px)**: Falls back to existing list view (CalendarTab). No grid on mobile.

#### Optional Enhancement: Drag-and-Drop Reschedule

> Ships if time allows, or as a fast-follow enhancement after the core grid is stable.

1. Grab event card
2. Drop on new time slot (snaps to 15-minute increments)
3. Optimistic UI: card moves immediately
4. Background: PATCH event with new time, run conflict check
5. If conflict detected: show warning toast with option to undo (5-second window)
6. If save fails: revert card position, show error toast
7. Triggers notification to team members (F3)
8. Keyboard alternative: select event, press M for move, arrow to new slot, Enter to confirm

#### Backend

No new endpoints required. Uses existing:
- `GET /api/v1/schools/:schoolId/events?startDate=&endDate=` (add if not present)
- `PATCH /api/v1/schools/:schoolId/games/:id` / `practices/:id` for reschedule

Add query parameter support: `?startDate=2026-03-09&endDate=2026-03-15` to filter events by week.

---

### F5: Personal Calendar Feeds

**Priority:** P1

#### Problem
Schedule sharing exists (public links, iCal export) but generates a static snapshot. Parents want a feed that stays current. No CalendarFeed model exists yet -- this is new work.

#### Solution
Create a new CalendarFeed model and service. Generate persistent iCal feed URLs that dynamically return current events.

#### Feed Types

| Type | Scope | Use Case |
|------|-------|----------|
| Team feed | All events for one team across all seasons | Coach shares with parents |
| User feed | All events across all of the user's teams | Multi-sport athlete or parent with multiple children |

#### How It Works

1. User clicks "Generate Feed" in calendar settings
2. System creates a CalendarFeed record with a unique token (UUID v4)
3. User copies the URL: `https://api.athleticos.co/cal/{token}.ics`
4. User adds URL to Google Calendar / Apple Calendar / Outlook
5. Calendar app polls the URL periodically (standard iCal behavior)
6. Each request dynamically generates fresh iCal from current event data

#### iCal Generation

Reuse existing `generateICS()` from schedule sharing routes. Extend to accept:
- A team ID (team feed)
- A user ID (user feed -- resolves all teams via membership)

Each event becomes a VEVENT with:
- `SUMMARY`: "{Type}: {Team} vs {Opponent}" or "{Type}: {Team} Practice"
- `DTSTART` / `DTEND`: Event times in school timezone
- `LOCATION`: Facility name + address if available
- `DESCRIPTION`: Notes, conflict status
- `UID`: Stable event ID (prevents duplicates on re-sync)

#### Feed Management UI

- Located in user profile or calendar settings
- List active feeds with: type, created date, last accessed date
- Actions: Copy URL, Deactivate (soft delete -- token stops working)
- Generate new feed button with type selection

#### Security

- Feed tokens are unguessable (UUID v4)
- No authentication required on `/cal/:token.ics` (standard for iCal feeds)
- Deactivated feeds return 404
- Feeds do not expose other users' personal information (only event data)

#### New Endpoints

- `POST /api/v1/calendar-feeds` -- Create a feed. Body: `{ type: 'team' | 'user', teamId?: string }`. Returns feed with token and URL.
- `GET /api/v1/calendar-feeds` -- List current user's feeds
- `DELETE /api/v1/calendar-feeds/:id` -- Deactivate a feed (soft delete)
- `GET /cal/:token.ics` -- Public iCal endpoint (no auth). Returns `text/calendar` content type.

---

### F6: Quick-Add Event Parsing

**Priority:** P2

#### Problem
Creating an event requires clicking a button and filling a 6-field modal. For the 80% case (a practice at a known facility and time), this is unnecessarily slow. Coaches think in shorthand: "Tuesday 3:30 Gym A."

#### Solution
A text input bar on the weekly board that parses natural language into event data.

#### Syntax

The parser recognizes these components in any order:

| Component | Pattern | Examples |
|-----------|---------|----------|
| Day of week | Mon/Tue/Wed/Thu/Fri/Sat/Sun (or full names) | "Tue", "Tuesday" |
| Time range | H:MM-H:MMpm or H:MM (assumes 1 hour) | "3:30-5pm", "3:30" |
| Facility | Fuzzy match against school facilities | "Gym A", "Field", "Main Gym" |
| Team | Fuzzy match against school teams in parentheses | "(Varsity)", "(JV Soccer)" |
| Opponent | "vs [name]" triggers Game instead of Practice | "vs Oakridge" |

#### Examples

| Input | Parsed As |
|-------|-----------|
| `Tue 3:30-5pm Gym A` | Practice, Tuesday, 3:30-5:00 PM, Gym A |
| `Fri 4pm Field vs Oakridge` | Game, Friday, 4:00-5:00 PM, Field, vs Oakridge |
| `Wed 3:30-5pm Gym A (Varsity)` | Practice, Wednesday, 3:30-5:00 PM, Gym A, Varsity |
| `Thu 4-6pm` | Practice, Thursday, 4:00-6:00 PM, no facility (prompt) |
| `vs Fort Worth Christian Sat 10am Field A` | Game, Saturday, 10:00-11:00 AM, Field A |

#### UX Flow

1. User types in the quick-add bar at the top of the weekly board
2. As they type, a preview card appears below the input showing parsed interpretation
3. Unresolved components are highlighted (e.g., "Gym" matches 2 facilities -- show dropdown)
4. Press Enter to confirm, or Tab to cycle through ambiguous matches
5. On confirm: run conflict check, show result, save event
6. If parsing fails (not enough info): input text pre-fills the standard create modal

#### Fuzzy Matching

- Facility matching: Levenshtein distance <= 3 or substring match. If multiple matches, show ranked dropdown.
- Team matching: Match against team name or sport name. Parentheses hint that content is a team.
- If no team specified: default to the user's primary team (for coaches with one team) or prompt.

#### New Endpoint

- `POST /api/v1/schools/:schoolId/quick-add` -- Parse text and return event preview. Body: `{ text: string, weekStartDate: string }`. Returns: `{ parsed: EventPreview, conflicts: Conflict[], confidence: number }`. Does NOT save -- frontend calls standard create endpoint after user confirms.

---

### F7: Bulk Operations

**Priority:** P2

#### Problem
Common operational needs require touching many events: daylight saving shifts, rain days, and clearing large conflict backlogs. Currently each requires individual event edits.

#### Solution
Three bulk operation tools accessible from the weekly board and conflicts page.

#### Operation 1: Shift Week

Move all events in a date range by a fixed time offset.

**Use cases:**
- Daylight saving time: shift all events by -60 minutes
- School dismissal change: shift all afternoon events by +30 minutes
- Week postponement: shift all events by +7 days

**UX:**
1. Click "Shift Week" from weekly board toolbar
2. Select date range (default: current week)
3. Enter offset: +/- minutes, hours, or days
4. Optional: filter by team or event type
5. Preview: list of affected events with before/after times
6. Confirm: bulk update, trigger notifications (F3)

**Endpoint:** `POST /api/v1/schools/:schoolId/bulk-move`
```typescript
interface BulkMoveInput {
  startDate: string;        // ISO date
  endDate: string;          // ISO date
  offsetMinutes: number;    // positive = later, negative = earlier
  teamId?: string;          // optional filter
  eventType?: 'GAME' | 'PRACTICE';  // optional filter
  dryRun: boolean;          // true = preview only
}
// Returns: { affected: EventPreview[], conflictsCreated: Conflict[] }
```

#### Operation 2: Rain Plan

One-click move of outdoor events to designated indoor fallback facilities.

**Schema addition:** `Facility.rainFallbackId` (optional FK to another Facility). Example: "Field A" falls back to "Main Gymnasium."

**UX:**
1. Click "Rain Plan" from weekly board toolbar
2. Select date range (default: today)
3. System identifies outdoor events (facility type: FIELD, COURT, TRACK)
4. For each, shows proposed move to rain fallback facility
5. Highlights conflicts at indoor facility (if any)
6. Confirm: bulk update facilities, trigger notifications

**Endpoint:** `POST /api/v1/schools/:schoolId/rain-plan`
```typescript
interface RainPlanInput {
  startDate: string;
  endDate: string;
  dryRun: boolean;
}
// Returns: { moves: Array<{ event, fromFacility, toFacility, conflicts: Conflict[] }> }
```

#### Operation 3: Auto-Rebalance

Deferred from PRD-003 Phase 2. Applies priority-based suggestions in bulk.

**UX:**
1. Click "Auto-Resolve" from conflicts page toolbar
2. Configure: confidence threshold (high only, or high+medium), scope (all, by facility, by team)
3. Dry-run preview: "Will reschedule 12 events, skip 3 (manual review needed)"
4. Confirm: apply suggestions, trigger notifications

**Endpoint:** `POST /api/v1/schools/:schoolId/conflicts/auto-resolve`
```typescript
interface AutoResolveInput {
  confidenceThreshold: 'high' | 'medium';  // minimum confidence to apply
  scope?: { facilityId?: string; teamId?: string };
  dryRun: boolean;
}
// Returns: { resolved: ConflictResolution[], skipped: Conflict[], errors: Error[] }
```

---

### F8: Print-Friendly Week View

**Priority:** P2

#### Problem
Coaches hand paper schedules to officials, custodians, and bus drivers. The current UI doesn't print cleanly.

#### Solution
CSS print styles and a print button on the weekly board and season detail pages.

#### Requirements

**Print Button:**
- Located in weekly board toolbar (next to Rain Plan)
- Also available on season detail page
- Triggers `window.print()` with print-optimized styles

**Print Styles (`@media print`):**
- Hide: navigation, sidebar, action buttons, quick-add bar, filters
- Show: clean table with columns: Day, Time, Type, Team, Facility, Opponent/Notes
- Header: School name, team name (if filtered), week dates (Mon Mar 9 - Sun Mar 15, 2026)
- Footer: "Generated {timestamp} | Subscribe: {calendarFeedURL}"
- Page: landscape orientation
- Fit: one page for a typical week (10-20 events)

**Table Format:**
```
TRINITY CHRISTIAN ACADEMY - Varsity Basketball
Week of March 9-15, 2026

Day        Time         Type      Facility        Opponent/Notes
---------- ------------ --------- --------------- -------------------------
Monday     4:00-5:30pm  Practice  Main Gymnasium
Tuesday    3:30-5:00pm  Practice  Gym A           Shooting drills
Wednesday  4:00-5:30pm  Practice  Main Gymnasium
Thursday   --           --        --              No practice (exams)
Friday     7:00-9:00pm  Game      Main Gymnasium  vs Fort Worth Christian
Saturday   10:00am-12pm Game      Field A         @ Arlington Heights

Generated Mar 13, 2026 8:15 AM | Subscribe: athleticos.co/cal/abc123.ics
```

---

### F9: Facility Request & Approval Workflow

**Priority:** P1

#### Problem
TCA uses SchoolDude for facility reservations. Coaches and community members request gym/field time through a generic room-booking tool with no sports intelligence. SchoolDude has a dated UI, no bulk approval, and a 100-day limit per schedule entry.

#### Solution
A facility request system built into AthleticOS that understands seasons, teams, and athletic priorities.

#### Features

- **Internal requests**: Coaches request facility time for practices/events. AD reviews and approves/denies with one click.
- **Community requests**: External users (travel teams, camps, community leagues) create a lightweight account (email + password, COMMUNITY role) and submit facility use requests. They can track request status through a simple portal.
- **Approval workflow**: Request -> Review -> Approve/Deny. AD sees pending requests in dashboard.
- **Conflict-aware**: Requests are checked against existing events and blockers before submission. Requester sees conflicts upfront.
- **Recurring patterns**: "Every Tuesday and Thursday 3:30-5:00 PM for basketball season" -- season-aware recurring reservations (not dumb "repeat every week" with a day limit like SchoolDude).
- **Availability calendar**: Public-facing or staff-facing calendar showing open facility slots, filterable by facility type.

#### User Stories

- **US-9.1**: As a coach, I can request a facility for a recurring practice slot and see conflicts before submitting.
- **US-9.2**: As an AD, I can approve or deny facility requests from a queue with one-click actions.
- **US-9.3**: As a community member, I can create a lightweight account and request to rent a school facility, then track my request status.
- **US-9.4**: As an AD, I can see a facility availability calendar showing all bookings and open slots.

#### Schema

```prisma
model FacilityRequest {
  id              String   @id @default(cuid())
  schoolId        String   @map("school_id")
  facilityId      String   @map("facility_id")
  requestedBy     String   @map("requested_by")  // userId (internal or community account)
  requestType     RequestType  // INTERNAL, COMMUNITY
  title           String
  description     String?
  startDate       DateTime @map("start_date")
  endDate         DateTime @map("end_date")
  recurrence      Json?    // { pattern: "weekly", days: ["TUE", "THU"], seasonId?: string }
  status          RequestStatus @default(PENDING)  // PENDING, APPROVED, DENIED, CANCELLED
  reviewedBy      String?  @map("reviewed_by")
  reviewedAt      DateTime? @map("reviewed_at")
  reviewNotes     String?  @map("review_notes")
  createdAt       DateTime @default(now()) @map("created_at")

  school          School   @relation(fields: [schoolId], references: [id])
  facility        Facility @relation(fields: [facilityId], references: [id])

  @@map("facility_requests")
}

enum RequestType {
  INTERNAL
  COMMUNITY
}

enum RequestStatus {
  PENDING
  APPROVED
  DENIED
  CANCELLED
}
```

#### Endpoints

- `POST /api/v1/schools/:schoolId/facility-requests` -- Submit request
- `GET /api/v1/schools/:schoolId/facility-requests` -- List requests (filterable by status, facility)
- `PATCH /api/v1/schools/:schoolId/facility-requests/:id` -- Approve/deny (AD/ADMIN only)
- `GET /api/v1/schools/:schoolId/facilities/:id/availability` -- Availability calendar for a facility
- `POST /api/v1/auth/community-register` -- Community registration (creates account + first request)
- `POST /api/v1/facility-requests` -- Authenticated community request (for subsequent requests)

> **COMMUNITY role:** Has view access to their own requests only. No access to school schedules, teams, or events.

#### Acceptance Criteria

- [ ] Coaches can submit facility requests with date range and optional recurrence
- [ ] AD sees pending requests queue with approve/deny actions
- [ ] Approved requests automatically create events (practices) on the calendar
- [ ] Requests are conflict-checked against existing events and blockers
- [ ] Community members can create a lightweight account (COMMUNITY role) and submit facility requests
- [ ] Community members can track their own request status through a simple portal
- [ ] COMMUNITY role has view access to own requests only (no school schedules, teams, or events)
- [ ] Recurring patterns support season-aware scheduling
- [ ] Facility availability view shows booked and open time slots
- [ ] Denied requests include review notes explaining the decision

---

### F10: Event Setup & Teardown Checklists

**Priority:** P2

#### Problem
Every home game requires setup (scorer's table, PA system, field lining, bleachers, lights) and teardown. This coordination happens through text messages and institutional memory. When TCA's coordinator left, this knowledge left with her. SchoolDude handles this as disconnected work orders with no tie to the athletic schedule.

#### Solution
Operations checklists attached to events, with templates per event type.

#### Features

- **Operations templates**: Define reusable checklists per event type (home basketball game, home football game, away game, etc.)
- **Auto-apply**: When a home game is created, the matching template is automatically attached.
- **Task tracking**: Each checklist item has status (not started, in progress, done, N/A), assignee, and due date.
- **Readiness dashboard**: AD sees operations completion percentage for upcoming events.

#### User Stories

- **US-10.1**: As an AD, I can create operations templates for different event types.
- **US-10.2**: As a coordinator, I can see which upcoming events have incomplete setup tasks.
- **US-10.3**: As a coach, I can mark setup tasks as complete for my home games.

#### Schema

```prisma
model OperationsTemplate {
  id        String   @id @default(cuid())
  schoolId  String   @map("school_id")
  name      String   // "Home Basketball Game", "Home Football Game"
  sport     String?  // optional sport filter
  eventType String   @map("event_type")  // "HOME_GAME", "AWAY_GAME", "PRACTICE"
  tasks     Json     // [{ name, category, defaultLeadTimeDays }]
  createdAt DateTime @default(now()) @map("created_at")

  school    School   @relation(fields: [schoolId], references: [id])

  @@map("operations_templates")
}

model EventChecklist {
  id         String   @id @default(cuid())
  gameId     String?  @map("game_id")
  practiceId String?  @map("practice_id")
  templateId String?  @map("template_id")
  tasks      Json     // [{ name, category, status, assigneeId, dueDate }]
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  game       Game?    @relation(fields: [gameId], references: [id])
  practice   Practice? @relation(fields: [practiceId], references: [id])

  @@map("event_checklists")
}
```

#### Endpoints

- `POST /api/v1/schools/:schoolId/operations-templates` -- Create template
- `GET /api/v1/schools/:schoolId/operations-templates` -- List templates
- `GET /api/v1/schools/:schoolId/events/:eventId/checklist` -- Get event checklist
- `PATCH /api/v1/schools/:schoolId/events/:eventId/checklist` -- Update task statuses
- `GET /api/v1/schools/:schoolId/operations-readiness` -- Readiness dashboard (completion % per upcoming event)

#### Acceptance Criteria

- [ ] AD can create and edit operations templates with categorized tasks
- [ ] Templates auto-apply when home games are created
- [ ] Checklist tasks have status tracking (not started, in progress, done, N/A)
- [ ] Readiness endpoint returns completion percentage per upcoming event
- [ ] Events with incomplete tasks within lead time are flagged on dashboard

---

### F11: Recurring Event Patterns

**Priority:** P1

#### Problem
Practices repeat weekly for entire seasons. Currently each practice must be created individually or CSV-imported. SchoolDude has "recurring schedules" but with a 100-day limit and no season awareness.

#### Solution
Season-aware recurring event creation.

#### Features

- **Recurrence builder**: "Every [Mon/Tue/Wed] from [season start] to [season end] at [time] in [facility]"
- **Preview before creation**: Show all generated dates with conflict checks
- **Exclude dates**: Automatically skip dates that fall on existing blockers (exams, holidays)
- **Bulk create**: Generate all practice instances at once
- **Modify series**: Change time/facility for "this event only" or "all remaining events in series"

#### User Stories

- **US-11.1**: As a coach, I can create a recurring practice that repeats every Tuesday and Thursday for the entire season.
- **US-11.2**: As a coach, I see a preview of all generated dates with conflicts highlighted before confirming.
- **US-11.3**: As a coach, I can change the time for one instance without affecting the rest of the series.

#### Schema Addition

Add to Practice model:

```prisma
// Add to Practice model:
recurrenceGroupId  String?  @map("recurrence_group_id")  // links instances in a series
```

#### Endpoints

- `POST /api/v1/schools/:schoolId/practices/recurring` -- Create recurring series. Body: `{ teamId, facilityId, seasonId, days: ["TUE", "THU"], startTime, endTime, excludeBlockers: boolean, dryRun: boolean }`
- `PATCH /api/v1/schools/:schoolId/practices/recurring/:groupId` -- Modify all remaining in series
- `DELETE /api/v1/schools/:schoolId/practices/recurring/:groupId` -- Cancel remaining in series

#### Acceptance Criteria

- [ ] Coach can define recurring pattern with days of week and season date range
- [ ] Preview shows all generated dates with conflict badges
- [ ] Dates overlapping with existing blockers are auto-excluded (with option to include)
- [ ] Bulk create generates all instances in one operation
- [ ] Individual instances can be modified without affecting the series
- [ ] "Modify remaining" changes all future instances in the series
- [ ] "Cancel remaining" deletes all future instances

---

## User Journeys

### Journey 1: Coach Schedules a Week (Coach Truman)

1. **Open AthleticOS** -- Dashboard loads. Attention strip shows "2 conflicts."
2. **Click "Calendar"** tab -- Weekly board grid loads showing current week
3. **Type in quick-add bar**: `Tue 3:30-5pm Gym A`
4. **See preview card**: Practice, Tuesday, 3:30-5:00 PM, Gym A, Varsity Basketball
5. **Press Enter** -- Event appears on grid. Green check: no conflicts.
6. **Repeat** for Wed and Thu practices
7. **Drag Friday's practice** from 4:00 to 3:30 (conflict with JV)
8. **See amber toast**: "Facility conflict: JV Volleyball at Gym A 3:00-4:30. Undo?"
9. **Click "Keep"** -- System logs override, notifies JV coach
10. **Click Print** -- Hand the clean schedule to the custodian
11. **Done.** Parents receive SMS for each new/changed event. Total time: 3 minutes.

### Journey 2: Rain Day (Athletic Director)

1. **Morning**: Forecast shows thunderstorms 2-6 PM
2. **Open weekly board** -- Click "Rain Plan"
3. **System shows**: 4 outdoor events today, proposed indoor moves
4. **Review**: Field A practices move to Main Gymnasium. One conflict at 4:00 PM (Gym already booked).
5. **Adjust**: Shift the conflicting practice to 5:00 PM in the preview
6. **Confirm** -- All 4 events updated, 12 parents + 3 coaches get SMS
7. **Total time**: 90 seconds

### Journey 3: Parent Stays Informed

1. **Receive invite email** -- Click accept, create account, add phone number
2. **Go to Calendar settings** -- Click "Generate Feed"
3. **Copy iCal URL** -- Add to Google Calendar
4. **From now on**: All schedule changes appear automatically in their calendar
5. **Tuesday 2:00 PM**: Coach moves practice from 4:00 to 3:30
6. **Parent receives SMS**: "[AthleticOS] Varsity Soccer practice MOVED to Tue 3:30pm @ Gym A."
7. **Google Calendar updates** on next sync (within hours)
8. **Parent never opens AthleticOS again** -- and that's the goal

### Journey 4: Multi-Sport Athlete Conflict

1. **AD opens conflicts page** -- Sees new "Person Overlap" conflict type
2. **Alex Johnson** is in Varsity Soccer (3:30-5:00) and JV Basketball (4:30-6:00) on Thursday
3. **System suggests**: "Move JV Basketball to 5:30-7:00 (next available slot, no conflicts)"
4. **AD clicks "Apply Suggestion"** -- Event moves, Alex and both coaches notified
5. **Conflict resolved** without either coach knowing there was a problem

### Journey 5: Season Start Setup

1. **AD imports CSV** of 40 games across 6 teams
2. **System runs enhanced conflict check** -- Finds 3 facility double-bookings, 1 resource collision, 8 blocker overlaps
3. **AD clicks "Auto-Resolve"** -- Threshold: high confidence only
4. **Preview**: "Will reschedule 6 events (high confidence). 6 need manual review."
5. **Confirm** -- 6 resolved. AD triages remaining 6 manually in the detail panel.
6. **Total time**: 10 minutes for a 40-event import with full conflict resolution

### Journey 6: Facility Request (Replacing SchoolDude)

1. **Coach needs gym time** -- Opens AthleticOS, clicks "Request Facility"
2. **Selects facility**: Main Gymnasium, every Tuesday/Thursday 3:30-5:00 PM
3. **Sets recurrence**: "For basketball season" (Oct 15 - Feb 28)
4. **System previews**: 36 practice slots generated. 2 conflict with exam week blockers (auto-excluded). 1 conflict with a home football game.
5. **Coach submits request** -- AD receives notification
6. **AD opens request queue** -- Sees request with conflict summary. One-click approve.
7. **36 practices created** on the calendar. Parents notified via email.
8. **Total time**: 2 minutes. SchoolDude equivalent: 30 minutes + follow-up emails.

---

## Non-Functional Requirements

### Performance

| Operation | Target |
|-----------|--------|
| Dashboard + weekly board load | <1 second |
| Conflict check (full, 10 teams, 50 events/week) | <200ms |
| Quick-add parse + preview | <100ms |
| Notification delivery: SMS | <60 seconds |
| Notification delivery: Email | <5 minutes |
| Batch operations (50 events) | <5 seconds |
| iCal feed generation | <500ms |

### Accessibility

- WCAG 2.1 AA compliance for all new UI
- Keyboard navigation for weekly board (arrow keys, shortcuts)
- Screen reader support: grid cells announce day + time + event summary
- If drag-and-drop ships (optional): keyboard alternative provided (select event, press M for move, arrow to new slot, Enter to confirm)
- Color is not the only conflict indicator (badges have text + icon, not just color)

### Security

- All mutation endpoints enforce role-based permissions (F1)
- Calendar feed tokens are UUID v4 (unguessable)
- SMS opt-out endpoint validates user token
- Notification content does not include sensitive data (no addresses, no phone numbers of other parents)
- Rate limiting on notification test endpoint (5/hour)

### Browser Support

- Chrome 90+, Safari 15+, Firefox 90+, Edge 90+
- Responsive: desktop-first, grid on tablet, list fallback on mobile
- Print: landscape, one-page

### Mobile UX

Coaches are at the field with their phones. Mobile is not an afterthought.

**Approach:** Responsive web, not a native app. Mobile-optimized views for the most common coach actions.

| Feature | Desktop | Mobile (<768px) |
|---------|---------|-----------------|
| Weekly Board (F4) | Full grid with drag-drop | List view (existing CalendarTab) with swipe between days |
| Quick-Add (F6) | Text bar on grid toolbar | Floating action button → quick-create sheet |
| Notifications (F3) | Preferences page | Same, responsive |
| Calendar Feeds (F5) | Copy URL → add to calendar app | "Add to Calendar" deep link (webcal:// protocol) |
| Facility Requests (F9) | Full form | Simplified form, fewer optional fields |
| Event Checklists (F10) | Table view | Swipeable card stack — swipe right = done, left = skip |
| Print View (F8) | Print button | Hidden (print from desktop) |

**Key mobile interactions:**
- **Tap-to-call**: Phone numbers in event details are tappable
- **Pull-to-refresh**: On schedule views
- **Bottom navigation**: Primary actions (Schedule, Conflicts, Requests) accessible via bottom nav on mobile
- **Offline indicator**: Show "offline" banner when connectivity drops (no offline mode in v1, just awareness)

**Not in scope:** Native app, push notifications (PWA), offline event creation. SMS + iCal feeds serve mobile parents without requiring an app.

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Event creation time (quick-add) | ~30 sec (form) | <15 seconds | Timed user testing |
| Reschedule time (with notifications) | ~5 min (edit + text parents) | <2 minutes end-to-end | Timed user testing |
| Parent iCal adoption | 0% | 70% of active parents | Feed creation analytics |
| SMS opt-out rate | N/A | <3% | Resend delivery tracking + opt-out page analytics |
| Conflicts caught before event start | ~60% (blocker-only) | >90% (all conflict types) | Conflict detection coverage audit |
| Weekly board load time | N/A (list view) | <1 second | Performance monitoring |
| Time to resolve all conflicts | <5 min (Sprint 2) | <5 min (maintained with more conflict types) | User testing |
| Permission violations caught | 0 (no enforcement) | 100% (all mutation routes protected) | Security audit |
| Notification delivery success rate | N/A | >98% for email, >95% for SMS | Delivery status tracking |
| Mobile usability (coach workflow) | N/A | All P0/P1 features usable on 375px screen | Manual testing on iPhone/Android |

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Resend SMS regional limitations | Resend SMS is newer than Twilio -- may have delivery limitations in some regions | Low | TCA is US-based (strong Resend SMS coverage). Monitor delivery rates. Email-only is an acceptable fallback for any SMS failures. |
| Drag-and-drop complexity | Optional enhancement may not ship in initial release | Low | Drag-and-drop is explicitly marked optional. Core grid ships with click-to-create, click-to-edit, and keyboard shortcuts. Drag-and-drop is a fast-follow enhancement. |
| Quick-add parsing ambiguity | Frustrating UX when parser guesses wrong | Medium | Always show preview before saving. Fallback to standard form pre-filled with parsed fields. Track parse success rate to improve. |
| EventParticipant data sparse | Person overlap detection has no data to work with | High | Detection works but only fires when records exist. Document as "progressive enhancement" -- value increases as rosters are populated. Ship detection logic regardless. |
| SMS cost at scale | Unexpected Resend charges | Low | 160-char single-segment messages. Quiet hours + digest reduce volume. TCA is small (~100 parents). Monitor spend weekly. |
| Rain fallback facility not configured | Rain Plan button does nothing useful | Medium | Seed fallback mappings in demo data. Show setup prompt if no fallbacks configured. Allow manual selection in rain plan preview. |
| Permission enforcement breaks existing workflows | Demo stops working | Low | Test all existing user flows with each role. Seed data includes users at every role level. ADMIN bypasses all checks. |
| Notification spam | Parents overwhelmed by messages | Medium | Default to email-only (SMS opt-in). Quiet hours enabled by default (9PM-7AM). Digest mode available. Clear preference controls. |
| Facility request approval bottleneck | AD overwhelmed by requests at season start | Medium | Bulk approve feature. Auto-approve for recurring patterns that match existing templates. |
| Recurring event bloat | Season-long recurrence creates many events | Low | Preview before creation. Easy series cancellation. Events only created, not reservations. |
| Mobile UX gaps | Coaches at the field can't use key features | Medium | List view fallback works. Floating action button for quick create. Test all features at 375px width. |

---

## Feature Prioritization (RICE)

Scoring: Reach (1-10), Impact (1-5), Confidence (0-1), Effort (S/M/L).

| Feature | Reach | Impact | Confidence | Effort | Priority |
|---------|-------|--------|------------|--------|----------|
| F1: Permissions | 10 (all users) | 4 (security) | 1.0 | S | P0 |
| F5: Calendar Feeds | 8 (parents+athletes) | 3 (convenience) | 0.9 | S | P1 |
| F2: Enhanced Conflicts | 10 (all users) | 4 (trust) | 0.8 | M | P0 |
| F3: Notifications | 10 (all users) | 5 (core promise) | 0.7 | L | P0 |
| F4: Weekly Board | 8 (coaches+AD) | 5 (daily UX) | 0.7 | L | P1 |
| F6: Quick-Add | 6 (coaches) | 4 (speed) | 0.6 | M | P2 |
| F8: Print View | 6 (coaches) | 2 (convenience) | 0.9 | S | P2 |
| F7: Bulk Operations | 4 (AD) | 4 (efficiency) | 0.6 | M | P2 |
| F9: Facility Requests | 8 (coaches+AD+community) | 4 (SchoolDude replacement) | 0.8 | M | P1 |
| F10: Event Checklists | 6 (AD+coordinators) | 3 (operations) | 0.7 | M | P2 |
| F11: Recurring Events | 8 (coaches) | 4 (speed) | 0.9 | M | P1 |

**Recommended build order:** F1 -> F5 -> F2 -> F3 -> F11 -> F4 -> F9 -> F7 -> F10 -> F8 -> F6

Rationale: F1 (permissions) is a security prerequisite with minimal effort. F5 (calendar feeds) reuses existing iCal code and delivers immediate parent value. F2 (enhanced conflicts) builds trust. F3 (notifications) fulfills the core "parents never check the app" promise. F11 (recurring events) is high-value with no dependencies beyond F1. F4 (weekly board) is the headline UX feature but depends on solid conflict detection (F2) and notification delivery (F3) to be fully useful. F9 is the SchoolDude replacement accelerator. F7, F10, and F8 round out the sprint with bulk operations, checklists, and print support. F6 (quick-add) moved to P2 -- the weekly board's click-to-create popover covers the primary use case. Quick-add is a speed optimization that ships last.

---

## Acceptance Criteria

### F1: Role-Based Permission Enforcement
- [ ] All mutation endpoints enforce role-based access control
- [ ] ADMIN role bypasses all restrictions
- [ ] ATHLETIC_DIRECTOR can manage all school resources
- [ ] COACH can create/edit events within their own school
- [ ] PARENT and ATHLETE cannot create or modify events
- [ ] PARENT can view events within their school (team-level scoping deferred to roster feature)
- [ ] ATHLETE can view events within their school (team-level scoping deferred to roster feature)
- [ ] Unauthorized requests return 403 with clear error message
- [ ] Permission denied events are logged for security audit
- [ ] All existing demo workflows continue to work with correct roles

### F2: Enhanced Conflict Detection
- [ ] Facility double-bookings are detected when two events overlap at the same facility
- [ ] Back-to-back events at the same facility are NOT flagged as conflicts
- [ ] Multi-sport athlete overlaps are detected when EventParticipant records exist
- [ ] Resource double-assignments are detected for shared buses/referees
- [ ] Facility and resource conflicts have severity `error`
- [ ] Person overlap conflicts have severity `warning`
- [ ] `POST /check-conflicts` returns all conflict types for a date range
- [ ] `POST /suggest-slots` returns 10 scored alternative slots
- [ ] Weather blocker creation shows impact analysis with batch response options
- [ ] Existing blocker-based conflicts continue to work unchanged
- [ ] Conflict check completes in <200ms for 10 teams, 50 events/week

### F3: Notification System
- [ ] Event creation sends email to team members
- [ ] Event time/place change sends SMS + email to team members and parents
- [ ] Event cancellation sends SMS + email
- [ ] New blocker sends email to affected coaches
- [ ] Weather emergency sends SMS + email (bypasses quiet hours)
- [ ] Weekly digest sends Monday 7 AM to AD/ADMIN users
- [ ] Notification preferences UI allows email/SMS toggle, quiet hours, digest mode
- [ ] Quiet hours queue messages and batch-send when window ends
- [ ] SMS includes opt-out link and opt-out page correctly disables SMS for the user
- [ ] SMS messages are single-segment (<=160 characters)
- [ ] Test notification endpoint works for both email and SMS
- [ ] Failed notifications are retried once, then marked as failed
- [ ] Notification log viewable by ADMIN users
- [ ] SMS delivered within 60 seconds, email within 5 minutes

### F4: Weekly Board Grid
**Core:**
- [ ] Grid displays Mon-Sun columns with 30-minute time rows (7am-10pm)
- [ ] Event cards positioned by time, colored by type (blue=game, green=practice)
- [ ] Conflict badges show on event cards with appropriate severity colors
- [ ] Click empty slot opens quick-create popover with pre-filled date/time
- [ ] Click event card allows inline field editing
- [ ] Keyboard shortcuts work: N (new), E (edit), Delete (remove), arrows (navigate)
- [ ] Team and facility filters work correctly
- [ ] Responsive: grid on desktop/tablet, list fallback on mobile (<768px)
- [ ] Week navigation (previous/next/today) works
- [ ] Grid loads in <1 second

**Optional (drag-and-drop):**
- [ ] Drag-and-drop moves events to new time slots (15-minute snap)
- [ ] Drop triggers conflict check and notification
- [ ] Keyboard alternative for drag-and-drop: M to move, arrows to target, Enter to confirm

### F5: Personal Calendar Feeds
- [ ] User can generate team feed and user (all teams) feed
- [ ] Feed URL format: `/cal/{token}.ics`
- [ ] iCal output includes VEVENT for each event with correct fields
- [ ] Feed dynamically reflects current event data (not a snapshot)
- [ ] Feed management UI shows active feeds with copy/deactivate actions
- [ ] Deactivated feeds return 404
- [ ] Feed tokens are UUID v4 (unguessable)
- [ ] No authentication required on public iCal endpoint

### F6: Quick-Add Event Parsing
- [ ] Text input bar appears on weekly board
- [ ] Parser recognizes: day, time range, facility (fuzzy), team (fuzzy), "vs opponent"
- [ ] Preview card appears as user types showing parsed interpretation
- [ ] Ambiguous matches show dropdown for user selection
- [ ] "vs [opponent]" creates Game; otherwise creates Practice
- [ ] Conflict check runs before save
- [ ] Failed parse falls back to standard create modal pre-filled with parsed fields
- [ ] Parse + preview completes in <100ms

### F7: Bulk Operations
- [ ] Shift Week: moves all events in date range by offset minutes
- [ ] Shift Week: supports team and event type filters
- [ ] Shift Week: dry-run preview shows affected events before/after
- [ ] Rain Plan: identifies outdoor events and proposes indoor fallback moves
- [ ] Rain Plan: shows conflicts at indoor facilities
- [ ] Rain Plan: works even when some facilities lack fallback mappings (skip those)
- [ ] Auto-Rebalance: applies priority suggestions above confidence threshold
- [ ] Auto-Rebalance: dry-run preview shows what would change
- [ ] All bulk operations trigger notifications for affected events
- [ ] All bulk operations complete in <5 seconds for 50 events

### F8: Print-Friendly Week View
- [ ] Print button on weekly board and season detail page
- [ ] `@media print` hides nav, sidebar, buttons, quick-add bar
- [ ] Clean table layout: day, time, type, team, facility, opponent/notes
- [ ] Header shows school name, team name, week dates
- [ ] Footer shows generation timestamp and calendar feed URL
- [ ] Fits on one landscape page for a typical week
- [ ] Works in Chrome, Safari, Firefox, Edge

### F9: Facility Request & Approval Workflow
- [ ] Coaches can submit facility requests with date range and optional recurrence
- [ ] AD sees pending requests queue with approve/deny actions
- [ ] Approved requests automatically create events (practices) on the calendar
- [ ] Requests are conflict-checked against existing events and blockers
- [ ] Community members can create a lightweight account (COMMUNITY role) and submit facility requests
- [ ] Community members can track their own request status through a simple portal
- [ ] COMMUNITY role has view access to own requests only (no school schedules, teams, or events)
- [ ] Recurring patterns support season-aware scheduling
- [ ] Facility availability view shows booked and open time slots
- [ ] Denied requests include review notes explaining the decision

### F10: Event Setup & Teardown Checklists
- [ ] AD can create and edit operations templates with categorized tasks
- [ ] Templates auto-apply when home games are created
- [ ] Checklist tasks have status tracking (not started, in progress, done, N/A)
- [ ] Readiness endpoint returns completion percentage per upcoming event
- [ ] Events with incomplete tasks within lead time are flagged on dashboard

### F11: Recurring Event Patterns
- [ ] Coach can define recurring pattern with days of week and season date range
- [ ] Preview shows all generated dates with conflict badges
- [ ] Dates overlapping with existing blockers are auto-excluded (with option to include)
- [ ] Bulk create generates all instances in one operation
- [ ] Individual instances can be modified without affecting the series
- [ ] "Modify remaining" changes all future instances in the series
- [ ] "Cancel remaining" deletes all future instances

---

## Dependencies & Sequencing

```
Build Order:

Phase 1 (start here, no dependencies):
+-- F1: Permissions                         --- security prerequisite, must ship first
+-- F5: Calendar Feeds                      --- new schema needed, reuses generateICS()

Phase 2 (after F1, parallelizable):
+-- F2: Enhanced Conflict Detection         --- extends existing conflict engine
+-- F8: Print View                          --- CSS only, no backend dependency
+-- F11: Recurring Event Patterns           --- no dependencies beyond F1, high value

Phase 3 (after Phase 1, parallelizable tracks):
+-- F3: Notification System                 --- backend track
    +-- Email notifications                 --- extend existing Resend integration
    +-- SMS notifications                   --- Resend SMS (same provider)
    +-- Preferences UI                      --- depends on backend preferences API
    +-- Digest + quiet hours                --- depends on base notification delivery
+-- F4: Weekly Board Grid                   --- frontend track (parallel with F3)
    +-- Static grid view                    --- no dependencies beyond F1
    +-- Inline edit + keyboard shortcuts    --- depends on static grid
    +-- Drag-and-drop (optional)            --- ships if time allows after core grid

Phase 4 (after F4, after F2):
+-- F9: Facility Request & Approval         --- depends on F2 (conflict checking for requests)

Phase 5 (after F2 + F3):
+-- F7: Bulk Operations                     --- depends on F2 (conflict check) + F3 (notifications)
    +-- Shift Week                          --- simpler, do first
    +-- Rain Plan                           --- requires rainFallbackId schema addition
    +-- Auto-Rebalance                      --- reuses existing suggestion logic
+-- F10: Event Checklists                   --- no hard dependencies, low coupling

Phase 6 (P2 -- ships last):
+-- F6: Quick-Add Parsing                   --- P2, weekly board click-to-create covers primary use case
```

**Hard dependencies:**
- F1 must ship first (security prerequisite for all other features)
- F6 (quick-add) depends on F4 (lives in the weekly board toolbar)
- F7 (bulk operations) depends on F2 (enhanced conflict check) and F3 (notifications)
- F9 (facility requests) depends on F2 (conflict checking for request validation)
- F3 uses Resend for both email and SMS (no new vendor integration needed)

**No hard dependencies (can start after F1):**
- F11 (recurring events) -- standalone, can be built anytime after F1
- F10 (event checklists) -- no hard dependencies, low coupling with other features

**Can be parallelized:**
- F1 + F5 (independent, both small)
- F2 + F8 + F11 (backend conflict work + CSS-only print + recurring events)
- F3 backend + F4 frontend (independent tracks)
- F5 + F2 (calendar feeds + conflict detection)
- F9 + F10 (facility requests + checklists, after their respective dependencies)

**Cut list (drop in this order if behind):**
1. F6 quick-add (P2 -- weekly board click-to-create covers primary use case)
2. F7 Auto-Rebalance (defer to Sprint 4, least impactful of the three bulk ops)
3. F4 drag-and-drop (already optional -- ship core grid with click-to-edit)
4. F7 Rain Plan (defer, Shift Week is more broadly useful)

---

## Deferred Features (Sprint 4+)

These features are explicitly OUT OF SCOPE for Sprint 3:

| Feature | Source | Reason for Deferral |
|---------|--------|---------------------|
| Event Operations: Buses, Meals, Refs | PRD-002 F2 | Setup checklists addressed in F10. Transportation and official management deferred. |
| Volunteer/Role Management (sign-up pages, coverage dashboard) | PRD-002 F3 | Requires roster system first |
| Roster & Parent Contacts (team rosters, parent CSV import) | PRD-002 F6 | Important but Sprint 3 focuses on scheduling UX |
| Cross-Team Schedule Visibility (facility heat map) | PRD-002 F8 | Nice-to-have, AD can use facility filter on weekly board as interim |
| Google Calendar 2-Way Sync (OAuth2) | Roadmap | Calendar feeds (F5) covers 80% of the use case without OAuth complexity |
| SportsYou Export | Roadmap | Low priority, iCal feeds are more universal |
| Theme/Design System (typography, DM Sans) | PRD-003 deferred | UI still evolving, premature to lock in design system |
| Push Notifications (PWA/native) | Future | SMS + email + iCal covers all notification needs for now |
