# PRD-002: AthleticOS v2 -- Unified Athletic Operations Platform

> Status: Draft
> Created: 2026-02-18
> Last Updated: 2026-02-18
> Author: Burke (Product/Engineering), Truman (Domain Expert/Coach)
> Target School: Trinity Christian Academy (TCA)

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-02-18 | Initial draft from Burke/Truman meeting transcript |
| v1.1 | 2026-02-18 | Added F8 (Schedule Visibility), F9 (Notifications). Removed business pitch content. Clarified coordinator UX approach. |

---

## Table of Contents

1. [Version History](#version-history)
2. [Executive Summary](#executive-summary)
3. [Problem Statement](#problem-statement)
4. [Business Context](#business-context)
5. [User Personas](#user-personas)
6. [Current State Assessment](#current-state-assessment)
7. [Solution Overview](#solution-overview)
8. [Phase 1: Enhanced Internal Operations](#phase-1-enhanced-internal-operations)
9. [Phase 2: Cross-School Scheduling](#phase-2-cross-school-scheduling)
10. [Feature Prioritization (RICE)](#feature-prioritization-rice)
11. [Success Metrics](#success-metrics)
12. [Risks and Mitigations](#risks-and-mitigations)
13. [Rollout Strategy](#rollout-strategy)
14. [Appendix](#appendix)

---

## Executive Summary

AthleticOS v1 delivered a constraint-aware scheduling reconciliation engine (PRD-001, completed 2026-01-16). It lets coaches import schedules, define blockers, detect conflicts, and share schedules via public links.

AthleticOS v2 expands the platform from a scheduling tool into a **unified athletic operations hub**. The immediate trigger: Trinity Christian Academy has lost both its Athletic Director (Steve) and Athletic Coordinator (Kathy Denny) and is "recasting the vision" for its athletics program under Dr. Jeff Williams, Head of School. There is no single system managing the operational complexity of running 20+ teams across shared facilities. Coaches are spending roughly 25% of their time on logistics instead of coaching.

v2 addresses this by adding: a priority rules engine for facility allocation, event operations management (buses, meals, referees, setup), volunteer/role management, weather and emergency response, role-based dashboards, and a feedback loop from coaches into the product.

Phase 2 extends the platform to cross-school scheduling within the district, enabling home/away coordination, shared conflict resolution, and all-district workflows.

---

## Problem Statement

### The Immediate Crisis at TCA

TCA has let go its Athletic Director and Athletic Coordinator. A semi-retired coach with limited technology comfort is currently handling the coordinator role manually through SchoolDude. The school uses four disconnected systems (SchoolDude, RankOne, BlackBaud, spreadsheets) with no integration between them. No single person has a unified view of athletic operations.

### The Systemic Problem

High school athletic programs generate significant operational complexity that is invisible to administrators until it fails:

- **Facility allocation conflicts** -- Varsity, JV, and Freshman teams across multiple sports compete for the same gyms, fields, and courts. There are no codified priority rules; decisions depend on institutional knowledge held by individuals who may leave.
- **Event operations are manual** -- Every home game requires coordination of buses, pre-game meals, referees, facility setup (press box, AV, lights, clock operators). This coordination happens through text messages, emails, and verbal agreements.
- **Volunteer coordination is fragmented** -- Schools use SignUpGenius or equivalent tools disconnected from the athletic schedule. Coaches discover unfilled roles days or hours before events, not weeks in advance.
- **Emergency response is reactive** -- A weather event (icy roads, severe storms) affects multiple sports simultaneously. Today, each coach handles their own response independently. There is no system to instantly see the cross-sport impact and coordinate a unified response.
- **Institutional knowledge walks out the door** -- When TCA lost its AD and coordinator, the operational knowledge left with them. The rules, preferences, and procedures were not codified anywhere.

### The Cost

Truman estimates that coaches collectively spend approximately 25% of their time on logistics. With total affected staff compensation around $500,000, this represents a **$100,000-$125,000 annual problem** in misallocated human capital -- coaches doing coordinator work instead of coaching.

---

## Business Context

### Engagement Model

| Aspect | Detail |
|--------|--------|
| Built by | Burke (engineering), Truman (domain expert, coach, parent) |
| Built for | Trinity Christian Academy (TCA) |
| Cost to TCA | $0 -- donated time |
| Additional support | Georgia (Burke's wife) -- potential coordination/project management |

---

## User Personas

### 1. Head Coach / Program Head

**Represented by:** Truman (basketball program)

| Attribute | Detail |
|-----------|--------|
| Primary goal | Manage team schedule, facilities, and game-day operations without administrative overhead |
| Tech comfort | Moderate -- uses smartphone, email, basic apps |
| Current pain | Spends 25% of time on logistics (buses, meals, refs, volunteer wrangling) |
| Key need | See everything relevant to their program in one place; know what is handled and what needs attention |
| Access level | Full control over own team(s), read access to school-wide schedule |

**Jobs to Be Done:**
- Schedule practices and games with confidence that facilities are available
- Know 2 weeks in advance what event roles are unfilled
- Respond quickly to weather or emergency changes across all their teams
- Communicate schedule changes to parents without redundant effort

### 2. Athletic Director

**Represented by:** Position currently vacant at TCA

| Attribute | Detail |
|-----------|--------|
| Primary goal | School-wide visibility into all athletic operations; resolve cross-sport conflicts |
| Tech comfort | Varies |
| Current pain | No unified view; relies on individual coaches reporting issues |
| Key need | Dashboard showing school-wide status: upcoming events, unfilled roles, pending conflicts, facility utilization |
| Access level | Full control over all teams, facilities, blockers, and priority rules |

**Jobs to Be Done:**
- Set and enforce facility priority rules (varsity over JV, in-season over off-season)
- Resolve facility conflicts between programs
- Ensure all home events have required operational support
- Report to Head of School on athletic operations health

### 3. Head of School

**Represented by:** Dr. Jeff Williams

| Attribute | Detail |
|-----------|--------|
| Primary goal | High-level confidence that athletics are running smoothly |
| Tech comfort | Executive-level -- wants summaries, not details |
| Current pain | Uncertainty about operational readiness after losing AD and coordinator |
| Key need | Executive dashboard: events this week, any red flags, volunteer coverage percentage |
| Access level | Read-only school-wide view |

**Jobs to Be Done:**
- Know at a glance whether this week's events are fully staffed
- Understand facility utilization and any chronic conflicts
- Have confidence that the athletic program is operationally sound

### 4. Coordinator / Admin (The "Kathy" Role)

**Represented by:** Currently a semi-retired coach filling in

| Attribute | Detail |
|-----------|--------|
| Primary goal | Execute day-to-day athletic operations: import schedules, manage blockers, coordinate logistics |
| Tech comfort | Low to moderate -- needs simple, guided workflows |
| Current pain | Using SchoolDude for everything; no training on the full picture |
| Key need | Clear task lists, guided workflows, and nothing that requires technical expertise |
| Access level | Full operational control (same as AD for day-to-day tasks) |

**Jobs to Be Done:**
- Import season schedules from coaches
- Create and manage blockers (exam weeks, holidays, maintenance)
- Track event operations readiness (are buses booked? refs confirmed?)
- Escalate unresolved issues to AD or coaches

> **UX Note:** Same UI as other roles with smart defaults and contextual help text. Do not build a separate coordinator-specific experience.

### 5. Parent Volunteer

**Represented by:** TCA parent community

| Attribute | Detail |
|-----------|--------|
| Primary goal | Sign up for event roles that fit their schedule |
| Tech comfort | Smartphone-native; expects consumer-grade UX |
| Current pain | SignUpGenius links sent via email/text; disconnected from actual schedule |
| Key need | See available roles, sign up with minimal friction, get reminders |
| Access level | View team schedule, sign up for volunteer roles, receive notifications |

**Jobs to Be Done:**
- See what volunteer opportunities are available for their child's team
- Sign up for roles (clock operator, announcer, concessions, etc.)
- Receive reminders before their volunteer shift
- Cancel or swap if plans change

---

## Current State Assessment

### What AthleticOS v1 Already Provides (PRD-001: Complete)

| Capability | Status | Notes |
|------------|--------|-------|
| School, Team, Season, Facility CRUD | Complete | Multi-tenant with school_id scoping |
| Game and Practice scheduling | Complete | With facility assignment |
| Blockers (exam, maintenance, weather, etc.) | Complete | School-wide, team, or facility scoped |
| Conflict detection engine | Complete | Warns on create/update against all applicable blockers |
| Reconciliation UI | Complete | Warning modals, conflict indicators, override tracking |
| CSV schedule import | Complete | With preview and bulk conflict detection |
| Shareable schedule links | Complete | Public URLs with configurable display options |
| Calendar view | Complete | Monthly calendar with event display |
| Auth (JWT) | Complete | Admin, Coach, Viewer roles |
| Dashboard | Complete | Basic stats and upcoming events |

### Existing Data Model (Relevant to v2)

The current schema includes: `User`, `SchoolUser` (with Role enum: ADMIN/COACH/VIEWER), `School`, `Team` (with TeamLevel: VARSITY/JV/FRESHMAN), `Season`, `Facility` (with FacilityType), `TimeSlot`, `Game`, `Practice`, `Blocker`, `ConflictOverride`, `ScheduleShare`.

Key observations for v2 planning:
- **TeamLevel enum already exists** (VARSITY, JV, FRESHMAN) -- foundation for priority rules
- **Blocker model already supports WEATHER type** -- foundation for weather response
- **Role enum is limited** (ADMIN, COACH, VIEWER) -- needs expansion for AD, Coordinator, Parent roles
- **No roster/athlete model** -- needed for parent contact integration
- **No event operations model** -- buses, meals, refs, setup are entirely new
- **No volunteer/role model** -- entirely new capability

### Systems Currently in Use at TCA

| System | Purpose | Pain Point |
|--------|---------|------------|
| SchoolDude | Facility scheduling | No athletic-specific features; coordinator-dependent |
| RankOne | Compliance, physicals, eligibility | No scheduling integration |
| BlackBaud | School information system (SIS) | Student/parent data silo |
| Spreadsheets | Everything else | No real-time visibility, version control, or automation |
| Text/email | Communication | No audit trail, high volume, easy to miss |

### Integration Considerations

- **BlackBaud** may be a source for student roster and parent contact data. Integration would be ideal but is not required for MVP -- manual CSV import of rosters is acceptable initially.
- **RankOne** eligibility data could eventually feed into roster status (eligible/ineligible), but this is a future consideration.
- **SchoolDude** will be replaced by AthleticOS for athletic facility scheduling. Coexistence during transition is expected.

---

## Solution Overview

AthleticOS v2 is structured in two major phases:

**Phase 1: Enhanced Internal Operations** -- Everything one school needs to run its athletic program without a dedicated coordinator. This is the pitch to Dr. Williams and the scope for TCA deployment.

**Phase 2: Cross-School Scheduling** -- Coordination between schools in the same district. Home/away management, shared conflict resolution, district-wide visibility.

### Design Principles

1. **Codify institutional knowledge** -- Every rule, priority, and procedure lives in the system, not in someone's head.
2. **Visibility over automation** -- Show the right information to the right person at the right time. Let humans make decisions with full context.
3. **Progressive disclosure** -- A coach sees their world. An AD sees the school. A Head of School sees the summary. Nobody is overwhelmed.
4. **Low floor, high ceiling** -- Simple enough for a semi-retired coach to use daily. Powerful enough to replace a full-time coordinator.
5. **Warn, don't block** -- Consistent with v1 philosophy. The system advises; humans decide.

---

## Phase 1: Enhanced Internal Operations

### F1: Priority Rules Engine

**Problem:** When multiple teams want the same facility at the same time, there are no codified rules for who gets priority. Decisions depend on whoever is loudest or whoever the coordinator favors.

**Solution:** A configurable rules engine that automatically assigns priority scores to facility requests based on codified school policies.

#### Default Priority Rules

| Factor | Rule | Rationale |
|--------|------|-----------|
| Team Level | Varsity > JV > Freshman | Standard athletic hierarchy |
| Season Status | In-season > Off-season | Active competition takes precedence |
| Event Type | Game > Practice | Games have external commitments (opponents, officials) |
| Home/Away | Home game > Away practice | Home games require the facility |

#### User Stories

**US-F1-1: Configure Facility Priority Rules**
> As an Athletic Director, I want to define priority rules for facility allocation so that conflicts are resolved consistently based on school policy rather than personal relationships.

Acceptance Criteria:
- Can set priority weights for team level (varsity/JV/freshman)
- Can set priority weights for season status (in-season/off-season)
- Can set priority weights for event type (game/practice)
- Rules are school-wide with optional per-facility overrides
- Changes to rules are logged with who changed what and when

**US-F1-2: See Priority-Based Conflict Resolution**
> As a coach, when my practice conflicts with another team's event, I want to see who has priority and why so I can plan accordingly.

Acceptance Criteria:
- Conflict warnings include priority comparison ("Varsity Basketball (in-season game) has priority over JV Soccer (off-season practice)")
- Lower-priority event is flagged with suggestion to find alternative
- Coach can still override (consistent with v1 warn-don't-block philosophy)
- Priority explanation is human-readable, not just a number

**US-F1-3: Automatic Priority Suggestions on Conflict**
> As a coordinator, when I see a facility conflict, I want the system to suggest which event should move based on priority rules.

Acceptance Criteria:
- On conflict, system identifies which event has lower priority
- Suggests alternative time slots for the lower-priority event
- Coordinator or coach makes final decision

#### Technical Notes
- Leverages existing `TeamLevel` enum and `Game`/`Practice` models
- Priority score calculation: weighted sum of factors (team level, season status, event type)
- New `PriorityRule` model at school level with configurable weights
- Season status derived from `Season.startDate`/`endDate` relative to event date

---

### F2: Event Operations Management

**Problem:** Every home game or event requires coordination of multiple operational elements -- buses, pre-game meals, referees, facility setup (press box, AV, lights, clock operators). Today this is managed through text messages and institutional memory. When the coordinator left, this knowledge left with her.

**Solution:** An operations checklist system attached to every game and event. Each event has a set of operational requirements that must be fulfilled, with status tracking and accountability.

#### Operations Categories

| Category | Examples | Lead Time |
|----------|----------|-----------|
| Transportation | Bus booking, departure time, driver assignment | 2 weeks |
| Pre-game Meals | Catering order, dietary needs, delivery time | 1 week |
| Officials | Referee scheduling, payment, assignment confirmation | 2 weeks |
| Facility Setup | Press box staffing, AV equipment, lights, scoreboard | 1 week |
| Game Day Staff | Clock operator, announcer, ticket booth, admin | 2 weeks |
| Post-game | Facility teardown, equipment storage, lock-up | Day of |

#### User Stories

**US-F2-1: Define Operations Template per Event Type**
> As an AD, I want to create operations templates for different event types (home basketball game, home football game, away game, etc.) so that each new event automatically gets the right checklist.

Acceptance Criteria:
- Can create named templates with a list of operations tasks
- Each task has: name, category, default lead time, optional assignee role
- Templates can be assigned to sport + event type combinations
- When a new home game is created, the matching template is auto-applied

**US-F2-2: Track Operations Status per Event**
> As a coordinator, I want to see the operations readiness for each upcoming event so I know what still needs attention.

Acceptance Criteria:
- Each event shows a checklist of operations tasks with status (not started, in progress, confirmed, N/A)
- Tasks can be assigned to specific people
- Tasks have due dates derived from lead time and event date
- Overdue tasks are visually highlighted

**US-F2-3: Operations Dashboard**
> As an AD, I want to see a school-wide view of operations readiness for all upcoming events in the next 2 weeks.

Acceptance Criteria:
- List of upcoming events with operations completion percentage
- Filterable by sport, date range, and status
- Events with incomplete operations within lead time are flagged red
- Click through to individual event operations detail

**US-F2-4: Bus Scheduling**
> As a coordinator, I want to schedule buses for away games and track confirmation status.

Acceptance Criteria:
- Can specify: bus company, number of buses, departure time, pickup location, estimated return
- Status tracking: requested, confirmed, cancelled
- Departure time visible on coach and parent views

**US-F2-5: Referee/Official Management**
> As a coordinator, I want to assign referees to home games and track their confirmation.

Acceptance Criteria:
- Can assign officials to events with contact info and fee
- Status tracking: requested, confirmed, no-show
- Officials database (name, contact, sport certifications, fee rate)
- Conflict check: same official not double-booked

#### Technical Notes
- New models: `OperationsTemplate`, `OperationsTask`, `EventOperations`, `EventOperationsTask`
- `EventOperations` links to `Game` (and potentially `Practice` for special events)
- Officials database: `Official` model with sport associations
- Bus scheduling: could be a specialized `EventOperationsTask` or a separate `BusBooking` model

---

### F3: Volunteer / Role Management

**Problem:** TCA uses SignUpGenius or similar tools to recruit parent volunteers for event roles (clock operator, announcer, concessions, press box admin). These tools are disconnected from the athletic schedule. Coaches discover unfilled roles days or hours before events.

**Solution:** Integrated volunteer management where event roles are defined as part of event operations, parents can sign up through a shared link (building on v1's share link pattern), and coaches/coordinators see coverage status weeks in advance.

#### User Stories

**US-F3-1: Define Volunteer Roles per Event**
> As a coach, I want to define the volunteer roles needed for each home event so I can track who has signed up.

Acceptance Criteria:
- Can add volunteer roles to any event (from template or ad hoc)
- Each role: name, description, number needed, time commitment, any special requirements
- Common roles pre-populated in templates: clock operator, scoreboard, announcer, concessions, ticket booth, press box admin

**US-F3-2: Volunteer Sign-Up Page**
> As a parent, I want to see available volunteer roles for my child's team and sign up easily.

Acceptance Criteria:
- Accessible via shared link (no account required) -- extends v1 share link pattern
- Shows upcoming events with open volunteer slots
- Can sign up with name, email, and phone number
- Receives email/text confirmation
- Can cancel or swap by revisiting the link

**US-F3-3: Volunteer Coverage Dashboard**
> As a coach, I want to see which events in the next 2 weeks have unfilled volunteer roles so I can recruit or escalate.

Acceptance Criteria:
- Events listed with volunteer coverage percentage (filled / total slots)
- Events with unfilled roles within 2 weeks highlighted
- Can send reminder or recruitment message to team parent list
- AD view shows school-wide volunteer coverage

**US-F3-4: Volunteer Reminders**
> As a system, I want to send reminders to signed-up volunteers 48 hours before their event.

Acceptance Criteria:
- Automatic reminder via email (SMS as future enhancement)
- Includes event details, role, arrival time, location
- Link to cancel if plans changed

#### Technical Notes
- New models: `VolunteerRole`, `VolunteerSignup`
- `VolunteerRole` attached to `Game` (or `EventOperations`)
- Sign-up page reuses `ScheduleShare` token pattern for authentication-free access
- Reminder system requires a job scheduler (cron or similar)

---

### F4: Weather / Emergency Response

**Problem:** A weather event (icy roads, severe thunderstorm, extreme heat) affects multiple sports simultaneously. Today, each coach handles their own response independently. There is no way to instantly see the cross-sport impact of a weather event and coordinate a unified response.

**Solution:** Extend the existing blocker system (which already supports WEATHER type) with an impact analysis view that shows all affected events across all sports when a weather blocker is created, and provides tools to batch-reschedule or cancel.

#### User Stories

**US-F4-1: Create Weather Emergency with Impact Analysis**
> As a coach or coordinator, when I learn of a weather event, I want to create a weather blocker and immediately see every event affected across all sports.

Acceptance Criteria:
- Create weather blocker with date/time range and description (e.g., "Icy roads - no travel")
- System immediately displays impact analysis: list of all events within the time range, grouped by sport/team
- Impact includes: games, practices, bus departures, volunteer shifts
- Impact count shown prominently ("This affects 8 events across 5 teams")

**US-F4-2: Batch Response to Weather Event**
> As an AD or coordinator, I want to cancel or reschedule multiple affected events at once rather than handling them one by one.

Acceptance Criteria:
- Select multiple affected events from impact analysis
- Batch actions: cancel all, postpone all, or handle individually
- For postponed events, system suggests next available time based on facility availability
- All changes logged with reason "Weather: [blocker name]"

**US-F4-3: Weather Notification to Affected Parties**
> As the system, I want to notify all affected coaches, parents, and volunteers when a weather event impacts their events.

Acceptance Criteria:
- When weather blocker is created and events are affected, generate notification list
- Notification includes: what happened, which events are affected, what action was taken (cancelled/postponed/TBD)
- Delivered via existing communication channels (email, share link update)

#### Technical Notes
- Extends existing `Blocker` model (WEATHER type already exists)
- Impact analysis: query all `Game` and `Practice` records within blocker time range for the school
- Batch operations: new API endpoint for bulk event status updates
- Notifications: new `Notification` model and delivery system (Phase 1 = email only)

---

### F5: Role-Based Dashboards

**Problem:** Different users need different views. A coach cares about their teams. An AD cares about the whole school. The Head of School wants a 30-second status check. Currently there is one basic dashboard that does not adapt to the user's role.

**Solution:** Role-specific dashboards that surface the right information for each persona with progressive disclosure.

#### Dashboard Views

**Coach Dashboard**
- My teams' events this week and next
- Operations readiness for upcoming home events (checklist completion %)
- Unfilled volunteer roles with days remaining
- Active blockers affecting my teams
- Unresolved conflicts for my events

**AD Dashboard**
- School-wide event calendar (all sports)
- Operations readiness across all teams (sorted by urgency)
- Facility utilization heat map (which facilities are overbooked, which are underused)
- Volunteer coverage school-wide
- Active weather/emergency blockers with impact
- Conflict resolution queue (events with unresolved conflicts, sorted by priority)

**Head of School Dashboard**
- This week at a glance: total events, completion status
- Red flags: any events within 48 hours missing critical operations (no refs, no bus, no volunteers)
- Volunteer engagement: percentage of roles filled
- Trend: are things getting better or worse over time?

**Coordinator Dashboard**
- Task-oriented: what needs my attention today?
- Overdue operations tasks
- Upcoming events needing operations setup
- Recently created blockers and their impact
- Import queue (any pending schedule imports)

#### User Stories

**US-F5-1: Coach Sees Their World**
> As a head coach, I want my dashboard to show only my teams' information so I can quickly see what needs my attention.

Acceptance Criteria:
- Dashboard filtered to teams the coach is assigned to
- Sections: upcoming events, operations gaps, volunteer needs, active blockers
- Action items highlighted with urgency indicators
- Click-through to event detail for any item

**US-F5-2: AD Sees School-Wide Operations**
> As an AD, I want a school-wide view of athletic operations so I can identify and resolve issues across all programs.

Acceptance Criteria:
- All teams visible with ability to filter by sport, level, or date range
- Operations readiness sorted by urgency (soonest events with most gaps first)
- Conflict resolution queue with priority-based recommendations
- Facility utilization summary

**US-F5-3: Head of School Executive View**
> As the Head of School, I want a simple status page that tells me in 30 seconds whether athletics are running smoothly this week.

Acceptance Criteria:
- Green/yellow/red status indicator for the week
- Green: all events have complete operations and volunteer coverage
- Yellow: some gaps exist but more than 48 hours out
- Red: events within 48 hours have critical gaps
- Drill-down available but not required

#### Technical Notes
- Extends existing `Role` enum: add `ATHLETIC_DIRECTOR`, `COORDINATOR`, `HEAD_OF_SCHOOL`, `PARENT`
- Dashboard API endpoints return role-filtered data
- Frontend: role-based routing to appropriate dashboard component
- Reuses existing React + TanStack Query architecture

---

### F6: Roster and Parent Contact Integration

**Problem:** Coaches need to communicate with parents of student athletes. Currently there is no roster management in AthleticOS and no parent contact information.

**Solution:** Basic roster management with parent contact information. Initial implementation supports manual entry and CSV import. Future integration with BlackBaud SIS for automatic sync.

#### User Stories

**US-F6-1: Manage Team Roster**
> As a coach, I want to manage my team roster with student names and parent contact information.

Acceptance Criteria:
- Add student athletes to a team with: name, grade, jersey number
- Add parent/guardian contacts per student: name, email, phone, relationship
- Import roster via CSV
- Students can be on multiple team rosters (e.g., varsity basketball and JV baseball)

**US-F6-2: Team Contact List**
> As a coach, I want to quickly access parent contact information for my team for communication purposes.

Acceptance Criteria:
- View all parents for a team with contact details
- Export contact list (CSV or copy to clipboard)
- Filter by student (see one student's parents) or view all

**US-F6-3: Roster Status**
> As a coordinator, I want to see which teams have complete rosters so I know where to follow up.

Acceptance Criteria:
- Dashboard indicator: teams with/without completed rosters
- "Roster complete" flag set manually by coach
- Coordinator can see roster gaps across all teams

#### Technical Notes
- New models: `Athlete`, `AthleteTeam` (many-to-many), `Guardian` (linked to Athlete)
- Athlete belongs to school, can be on multiple teams via join table
- Guardian model: name, email, phone, relationship to athlete
- Future: BlackBaud integration endpoint for automated roster sync

---

### F7: In-App Feature Request and Bug Report System

**Problem:** Coaches are the primary users and will have ideas for improvements and encounter bugs. Without a structured feedback channel, these go to text messages or get forgotten.

**Solution:** A simple in-app feedback system -- a "suggest a feature" and "report a bug" form accessible from every page.

#### User Stories

**US-F7-1: Submit Feature Request**
> As a coach, I want to suggest a feature or improvement from within the app so the development team can prioritize it.

Acceptance Criteria:
- "Feedback" button accessible from navigation bar on every page
- Form with: type (feature request / bug report / other), title, description, optional screenshot upload
- Submission confirmation with "we'll review this" message
- Submitter's user info and current page URL auto-attached

**US-F7-2: View Feedback Queue**
> As an admin, I want to see all submitted feedback so I can triage and prioritize.

Acceptance Criteria:
- Admin-only view of all feedback submissions
- Sortable by date, type, status
- Status workflow: new, reviewed, planned, completed, declined
- Can add internal notes

#### Technical Notes
- New model: `Feedback` (type, title, description, status, submittedBy, page URL, created/updated timestamps)
- Simple CRUD -- no complex workflow needed initially
- Optional: forward submissions to a GitHub issue via API (future enhancement)

---

### F8: Cross-Team Schedule Visibility

**Problem:** When a coach loses access to their usual facility (e.g., a field is under maintenance, or a higher-priority team claims the gym), they have no way to see what other teams are doing and whether alternative facilities might be open. A soccer coach whose field is unavailable cannot easily check whether the gym is free because basketball has an away game. Facility availability is locked inside each team's individual schedule.

**Solution:** A cross-team schedule browser that lets any coach view other teams' schedules and facility usage, making it easy to spot open facility time and coordinate informally.

#### User Stories

**US-F8-1: Browse Other Teams' Schedules**
> As a coach, I want to browse other teams' schedules so I can see when facilities I need might be available.

Acceptance Criteria:
- Can view any team's schedule at my school (read-only)
- Filterable by facility, sport, and date range
- Shows both games and practices with facility assignments
- Away games clearly marked (indicating the facility is NOT in use)

**US-F8-2: Facility Availability View**
> As a coach, I want to see a facility-centric view showing when a specific facility is booked and when it is open so I can find alternative practice times.

Acceptance Criteria:
- Select a facility and see all events scheduled there across all teams
- Open time slots clearly visible
- Can filter by date range (this week, next week, custom)
- Away games for teams that normally use that facility are highlighted as open windows

**US-F8-3: AD Facility Utilization Overview**
> As an AD, I want to see facility utilization across all teams so I can identify underused facilities and overbooked ones.

Acceptance Criteria:
- Heat map or summary view of facility usage by day/time across all teams
- Identifies chronically overbooked facilities
- Identifies underused facilities with open capacity
- Supports data-driven conversations about facility allocation

#### Technical Notes
- Primarily a read-only view layer on top of existing `Game`, `Practice`, and `Facility` data
- No new data models required -- this is a query and presentation feature
- Facility availability = time slots where no event is scheduled + time slots where all assigned teams have away games
- Integrates naturally with F5 dashboards (AD facility utilization heat map)

---

### F9: Notification and Communication System

**Problem:** Schedule changes, cancellations, volunteer reminders, and emergency alerts all happen through disconnected channels (text messages, emails, verbal communication). There is no centralized way to notify affected parties when something changes. Coaches find out about cancellations too late, parents miss volunteer shifts, and weather responses are uncoordinated.

**Solution:** An email-based notification system (Phase 1) that sends targeted alerts when events change, volunteer shifts approach, emergencies arise, or operational gaps need attention.

#### Notification Types

| Type | Recipients | Trigger | Timing |
|------|-----------|---------|--------|
| Schedule change | Affected coaches, parents | Game moved, practice cancelled, time/location changed | Immediate |
| Volunteer reminder | Signed-up volunteers | Approaching volunteer shift | 48 hours before event |
| Weather/emergency alert | All affected coaches and parents | Weather blocker created with event impact | Immediate |
| Blocker impact | Affected coaches | New blocker affects their scheduled events | Immediate |
| Weekly operations digest | AD, Coordinator | Automated weekly summary | Monday morning |

#### User Stories

**US-F9-1: Schedule Change Notifications**
> As a parent, I want to be notified by email when my child's game is moved, cancelled, or rescheduled so I can adjust my plans.

Acceptance Criteria:
- When a game or practice is updated (time, date, location, or status changed to cancelled/postponed), an email is sent to all parents on the team roster
- Email includes: what changed, old value vs new value, updated event details
- Coaches on the affected team also receive the notification
- Changes made in bulk (e.g., weather batch cancellation) send a single consolidated email per recipient, not one per event

**US-F9-2: Volunteer Shift Reminders**
> As a signed-up volunteer, I want to receive a reminder email 48 hours before my shift so I do not forget.

Acceptance Criteria:
- Automated email sent 48 hours before event start time
- Includes: event name, date/time, location, role, arrival time
- Includes link to cancel sign-up if plans changed
- Only sent to volunteers with confirmed sign-ups (not cancelled)

**US-F9-3: Weather and Emergency Alerts**
> As a coach or parent, I want to be notified immediately when a weather or emergency event affects games or practices I care about.

Acceptance Criteria:
- When a weather/emergency blocker is created and events are impacted, affected coaches and parents receive email
- Email includes: nature of emergency, list of affected events, actions taken (cancelled, postponed, TBD)
- Sent within minutes of blocker creation (not batched for later delivery)

**US-F9-4: Blocker Impact Notifications**
> As a coach, I want to be notified when a new blocker is created that affects my team's scheduled events.

Acceptance Criteria:
- When a blocker is created that overlaps with a coach's team events, that coach receives an email
- Email includes: blocker description, date range, list of affected events
- Includes link to view affected events in AthleticOS

**US-F9-5: Weekly Operations Digest**
> As an AD or coordinator, I want a weekly email summary showing upcoming operational gaps so I can plan my week.

Acceptance Criteria:
- Sent automatically every Monday morning
- Includes: events in the coming week with incomplete operations, unfilled volunteer roles, unresolved conflicts, expiring blockers
- Highlights items requiring immediate attention (events within 48 hours with gaps)
- Includes link to dashboard for details

#### Technical Notes
- Phase 1 is email-only. No SMS, no in-app notification center. Keep it simple.
- New models: `Notification` (type, recipientEmail, subject, body, status, sentAt, relatedEventId)
- Email delivery via SendGrid or AWS SES (low volume, minimal cost)
- Job scheduler (cron) for timed notifications (volunteer reminders, weekly digest)
- Event-driven triggers: schedule change notifications fire on Game/Practice update hooks
- Bulk weather notifications: aggregate all affected events per recipient into a single email

---

## Phase 2: Cross-School Scheduling

> Phase 2 is scoped at a high level. Detailed requirements will be developed in a separate PRD after Phase 1 is deployed and validated at TCA.

### Problem

Schools in the same district play each other regularly. Scheduling these matchups involves phone calls, emails, and spreadsheets between athletic directors. Home/away assignments, facility availability at the host school, and travel logistics must all be coordinated manually. District-wide activities like all-district team voting are managed with spreadsheets and turned monitors.

### Capabilities (High-Level)

**C1: School-to-School Game Scheduling**
- Invite opposing school to confirm game (date, time, home/away)
- Opposing school confirms or proposes alternative
- Both schools see the confirmed event on their calendars

**C2: Home/Away Coordination**
- When scheduling against a district opponent, system tracks home/away balance across the season
- Suggests home/away assignment based on fairness and facility availability

**C3: District-Wide Conflict Resolution**
- District-level blockers (district tournament, district-wide events)
- Visibility into other schools' schedules for coordination

**C4: All-District Voting and Recognition**
- Digital voting for all-district teams
- Coaches vote within the app
- Results tabulated automatically (replaces spreadsheet + turned monitor process)

### Prerequisites
- Phase 1 deployed at 2+ schools in the same district
- Multi-school data model (already supported via school_id multi-tenancy)
- School-to-school trust/connection model (new)
- Shared blocker visibility between connected schools

---

## Feature Prioritization (RICE)

Scoring scale: Reach (users affected), Impact (1-3), Confidence (%), Effort (person-weeks).
RICE Score = (Reach x Impact x Confidence) / Effort

| Feature | Reach | Impact | Confidence | Effort | RICE Score | Priority |
|---------|-------|--------|------------|--------|------------|----------|
| F5: Role-Based Dashboards | 20 | 3 | 90% | 3 | 18.0 | 1 |
| F1: Priority Rules Engine | 15 | 3 | 95% | 2 | 21.4 | 2 |
| F2: Event Operations Mgmt | 20 | 3 | 85% | 5 | 10.2 | 3 |
| F4: Weather/Emergency Response | 20 | 3 | 90% | 3 | 18.0 | 4 |
| F8: Cross-Team Schedule Visibility | 20 | 2 | 90% | 2 | 18.0 | 5 |
| F9: Notification & Communication | 20 | 3 | 80% | 4 | 12.0 | 6 |
| F3: Volunteer/Role Mgmt | 15 | 2 | 80% | 4 | 6.0 | 7 |
| F6: Roster/Parent Contacts | 15 | 2 | 90% | 3 | 9.0 | 8 |
| F7: Feedback System | 20 | 1 | 95% | 1 | 19.0 | 9 |

### Recommended Build Order

Based on RICE scores, dependencies, and the Monday pitch to Dr. Williams:

**Sprint 1 (Weeks 1-2): Foundation + Quick Wins**
- F1: Priority Rules Engine -- high value, builds on existing TeamLevel/conflict system
- F7: Feedback System -- low effort, high value for iteration velocity
- F5: Role-Based Dashboards (scaffolding) -- extend Role enum, basic routing

**Sprint 2 (Weeks 3-5): Core Operations + Visibility**
- F2: Event Operations Management -- the largest feature, highest operational impact
- F5: Role-Based Dashboards (full implementation)
- F8: Cross-Team Schedule Visibility -- a dashboard/view feature, low effort, high coach value

**Sprint 3 (Weeks 6-8): Emergency + Communication**
- F4: Weather/Emergency Response -- extends existing blocker system
- F6: Roster and Parent Contact Integration
- F9: Notification and Communication System -- depends on F2 (event operations) and F4 (weather response) for trigger sources

**Sprint 4 (Weeks 9-10): Volunteer Ecosystem**
- F3: Volunteer/Role Management -- depends on F2 (event operations) and F6 (parent contacts)

**Sprint 5 (Weeks 10+): Polish and Phase 2 Planning**
- Integration testing, UX refinement, feedback-driven iteration
- Phase 2 PRD development based on TCA learnings

---

## Success Metrics

### Primary Metrics (Measured 90 Days After TCA Deployment)

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Coach time on logistics | 50% reduction (from 25% to 12.5%) | Coach self-report survey, before/after |
| Events with complete operations 48+ hours out | > 80% | System data: EventOperations completion rate |
| Volunteer roles filled 2+ weeks in advance | > 70% | System data: VolunteerSignup timestamps |
| Schedule conflicts resolved before event day | > 95% | System data: ConflictOverride resolution timing |
| Facility double-booking incidents | Zero | System data + incident reports |
| Dr. Williams confidence in athletic operations | High (qualitative) | Direct feedback |

### Secondary Metrics

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Active users (weekly) | All coaches + coordinator + AD | System data: login frequency |
| Feature requests submitted | 10+ in first 90 days | System data: Feedback model |
| Time to respond to weather event | < 30 minutes from blocker creation to all notifications sent | System data: timestamp analysis |
| System uptime | 99.5% | Infrastructure monitoring |

### Leading Indicators (Weekly Tracking)

- Number of events with operations templates applied
- Volunteer sign-up rate (sign-ups per available slot)
- Blocker creation frequency (are people using the system proactively?)
- Dashboard login frequency by role

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Low tech adoption by semi-retired coordinator | High | High | Guided onboarding, in-person training, simplified UI for coordinator role. Truman available for ongoing support. |
| Dr. Williams does not approve | Medium | High | Present ROI narrative ($100K problem), zero cost to TCA, demonstrate v1 capabilities in Monday meeting. |
| Scope creep from coach feature requests | High | Medium | F7 feedback system captures requests; RICE prioritization disciplines the backlog. |
| BlackBaud integration complexity | Medium | Medium | Defer to manual CSV import for roster data. Do not block on integration. |
| Single-school bias in design | Medium | Medium | Design for multi-tenancy from day one (already in place). Phase 2 planning validates cross-school assumptions early. |
| Burke/Truman availability (volunteer effort) | Medium | High | Scope aggressively for MVP. Prioritize features that deliver value independently. Georgia as potential third contributor. |
| Coaches resist changing from current (broken) process | Low | Medium | Truman as champion and internal advocate. Demonstrate value through quick wins (weather response, volunteer visibility). |

---

## Rollout Strategy

### Pre-Deployment (Current Phase)

1. **Monday meeting with Dr. Williams** -- Truman and Burke present the vision, demonstrate v1, and secure buy-in
2. **Coach survey** -- Brief survey to 5+ TCA coaches validating pain points and feature priorities
3. **Identify pilot users** -- 2-3 coaches + the current coordinator for initial rollout

### Phase 1 MVP Deployment (Target: 4-6 weeks after approval)

1. **Soft launch** -- Priority rules engine + event operations + dashboards with pilot coaches
2. **Training** -- In-person walkthrough with coordinator and pilot coaches
3. **2-week feedback period** -- Collect usage data and feedback via F7 system
4. **Iterate** -- Address top feedback items before wider rollout

### Phase 1 Full Deployment (Target: 8-10 weeks after approval)

1. **All coaches onboarded** -- Full school rollout
2. **Volunteer system live** -- Parent-facing sign-up links distributed
3. **Head of School access** -- Executive dashboard for Dr. Williams
4. **90-day review** -- Measure success metrics, plan Phase 2

### Phase 2 (Target: Next School Year)

1. **Identify second school** -- Another school in TCA's district
2. **Cross-school PRD** -- Detailed requirements based on TCA learnings
3. **Pilot cross-school scheduling** -- Two schools coordinating via AthleticOS

---

## Appendix

### A: Glossary

| Term | Definition |
|------|------------|
| AD | Athletic Director -- school-level administrator of athletic programs |
| Blocker | A time-bound constraint that prevents or warns against scheduling (exam week, maintenance, weather) |
| Coordinator | Administrative role managing day-to-day athletic operations (the "Kathy" role) |
| In-season | A team whose season dates encompass the current date |
| Off-season | A team outside its active season dates |
| Operations | Logistical requirements for an event: transportation, meals, officials, setup, staffing |
| Reconciliation | The process of resolving conflicts between a planned schedule and constraints |
| TCA | Trinity Christian Academy -- the first target school |

### B: Competitive Landscape

| Product | Strengths | Weaknesses vs AthleticOS |
|---------|-----------|--------------------------|
| SchoolDude | Established, facility-focused | No athletic-specific features, no conflict detection, no operations management |
| RankOne | Compliance, eligibility | Not a scheduling or operations tool |
| ArbiterSports | Official assignment | Single-purpose, no facility or operations management |
| SignUpGenius | Volunteer sign-ups | Disconnected from schedules, no operations context |
| Google Sheets | Flexible, free | No automation, no conflict detection, no role-based access, version chaos |
| SportsYou | Team communication | Not an operations tool, no scheduling or facility management |

AthleticOS differentiator: **the only platform that unifies facility scheduling, event operations, and volunteer management with constraint-aware conflict detection -- specifically designed for high school athletics.**

### C: Data Model Summary (New Entities for v2)

```
PriorityRule        -- School-level facility allocation rules
OperationsTemplate  -- Reusable checklist templates for event types
OperationsTask      -- Individual tasks within a template
EventOperations     -- Instance of template applied to a specific game
EventOperationsTask -- Instance of task with status/assignee for a specific game
Official            -- Referee/official contact database
VolunteerRole       -- Volunteer slot definition for an event
VolunteerSignup     -- Parent sign-up for a volunteer role
Athlete             -- Student athlete profile
AthleteTeam         -- Many-to-many: athlete <-> team assignment
Guardian            -- Parent/guardian contact linked to athlete
Feedback            -- Feature requests and bug reports
Notification        -- Email notification queue (type, recipient, subject, body, status, sentAt, relatedEventId)
```

Note: F8 (Cross-Team Schedule Visibility) requires no new data models -- it is a read-only view layer on existing Game, Practice, and Facility data.

### D: Open Questions

1. **BlackBaud API access** -- Does TCA have API access to BlackBaud for roster sync, or is it export-only?
2. **Communication preferences** -- Do TCA parents prefer email, SMS, or app notifications? This affects notification system design.
3. **SchoolDude transition** -- What is the timeline for moving off SchoolDude? Is coexistence needed long-term?
4. **Budget for external services** -- If AthleticOS needs email/SMS delivery (SendGrid, Twilio), who covers the cost?
5. **District buy-in for Phase 2** -- Has anyone talked to other schools in the district about cross-school scheduling?
6. **All-district voting rules** -- What are the specific rules and process for all-district team voting? (Needed for Phase 2 detailed PRD.)

---

*This document is a living artifact. It will be updated as discovery continues, user research validates assumptions, and development progresses. All changes will be versioned with dates.*
