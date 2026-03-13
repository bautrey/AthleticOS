# AthleticOS Sports Scheduling — PRD v1

> **Status:** Draft
> **Date:** 2026-03-13
> **Target:** AthleticOS v1 MVP

---

## 1. Problem Statement

High school coaches spend 30-60 minutes per week juggling spreadsheets, group texts, and email chains to schedule practices and games. When weather hits or a field gets double-booked, the cascade of manual changes and notifications can take hours. Parents miss updates, athletes show up to the wrong place, and ADs have no visibility into facility utilization.

**Core job:** "Make my week work." Coaches need to set practice/game times in seconds, see conflicts immediately, notify everyone, and export to calendars.

---

## 2. UX Principles

- **Thin, boring, blazing fast.** Every action ≤2 clicks. Works great on a phone at the field.
- **Coach-speed.** No teaching required. If a coach can text, they can schedule.
- **Notification-first.** Parents and athletes should never have to check the app — changes come to them.

---

## 3. What Already Exists

Before specifying new work, here's the foundation we're building on. These are **shipped and working:**

### Scheduling Core
- **Game & Practice CRUD** — Full create/read/update/delete with Fastify routes, Zod validation, Prisma persistence. Games track opponent, home/away, status. Practices track duration. Both link to facilities and seasons.
- **Calendar list view** (`CalendarTab.tsx`) — Events grouped by date, sorted chronologically, with conflict badges and click-to-edit modals.
- **CSV import** — Bulk import games/practices from CSV with facility fuzzy-matching and conflict preview.

### Conflict Detection
- **Blocker-based conflicts** (`conflicts/service.ts`, 715 lines) — Checks events against blockers (exam, weather, maintenance, holiday, etc.) scoped to school, team, or facility. Includes time-range overlap logic, paginated conflict list, and batch override capability.
- **Conflict triage page** (`ConflictsPage.tsx`) — Filter, sort, and batch-override conflicts. Suggestion engine scores events by priority rules.
- **Priority rules** — Configurable weights (team level, season status, event type, home/away) for conflict resolution recommendations.

### Blockers & Weather
- **Full blocker system** (`blockers/service.ts`) — CRUD for blockers with types (WEATHER, EXAM, MAINTENANCE, EVENT, TRAVEL, HOLIDAY, CUSTOM), scopes (SCHOOL_WIDE, TEAM, FACILITY), datetime ranges. Shows affected events when a blocker is created.
- **BlockersPage** — Create/edit/delete blockers with type filtering and affected-event display.

### Users & Roles
- **Auth system** — JWT login/register with refresh tokens, password hashing.
- **Role enum** — ADMIN, ATHLETIC_DIRECTOR, COACH, PARENT, ATHLETE.
- **SchoolUser** — Links users to schools with role assignment.
- **Invite system** (`invites/service.ts`) — Email invitations with role, 7-day token expiry, accept/revoke flow.
- **School members UI** (`SchoolMembers.tsx`) — View and manage members.

### Schedule Sharing
- **Share links** (`shares/service.ts`) — Token-based public schedule URLs with configurable display (show/hide notes, facility), expiration, view counting.
- **iCal export** (`shares/public-routes.ts`) — `GET /public/schedules/:token/calendar` returns valid .ics file with games + practices. Rate-limited.
- **Embed code** — Generates iframe HTML for embedding schedules on websites.
- **Public schedule page** — Renders shared schedules without auth.

### Data Model (already in schema)
- School, Team (with level: VARSITY/JV/FRESHMAN), Season, Facility (with type: GYM/FIELD/POOL/COURT/TRACK/OTHER), TimeSlot
- Game, Practice
- Blocker, ConflictOverride
- ScheduleShare, PriorityRule + audit
- User, SchoolUser, Invite

### Schema Additions (committed, not yet implemented)
- Resource, EventResource — CRUD service and routes exist
- EventParticipant — Table exists, no conflict logic wired up
- Notification, NotificationPreference — Tables exist, no service
- CalendarFeed — Table exists, no service

---

## 4. User Personas & Roles

| Persona | Role | Core Need |
|---------|------|-----------|
| Coach (HC/Asst) | `COACH` | Create/edit events, see conflicts, notify team |
| Athletic Director | `ATHLETIC_DIRECTOR` | Multi-team facility view, approve overrides, manage resources |
| Athlete | `ATHLETE` | See own schedule, get change notifications |
| Parent | `PARENT` | See child's schedule, get SMS/email for changes, iCal sync |
| Admin | `ADMIN` | Full system access, manage school settings |

### Permission Matrix (NEW — not currently enforced)

| Action | Admin | AD | Coach | Parent | Athlete |
|--------|-------|----|-------|--------|---------|
| Create/edit events | Yes | Yes | Own team | No | No |
| View events | Yes | Yes | Own team | Own child's teams | Own teams |
| Manage facilities | Yes | Yes | No | No | No |
| Manage resources (buses/refs) | Yes | Yes | No | No | No |
| Override conflicts | Yes | Yes | Own team | No | No |
| Configure notifications | Yes | Yes | Own team | Self | Self |
| View calendar feeds | Yes | Yes | Own team | Own child's teams | Own teams |

---

## 5. New Features (What Needs to Be Built)

### 5.1 Weekly Board — Upgrade from List to Grid

**What exists:** `CalendarTab.tsx` renders events as a date-grouped vertical list with conflict badges and click-to-edit.

**What to build:**
- Grid layout: Mon-Sun columns × 30-minute time rows (7am-10pm)
- Event cards positioned by time, colored by type (blue=game, green=practice)
- Drag-and-drop to reschedule (saves on drop, optimistic UI)
- Click empty slot → quick-create popover
- Inline edit: click event card fields (time, facility) to edit without modal
- Keyboard shortcuts: N=new, E=edit, Delete=remove, arrows=navigate
- Responsive: stacks to existing list view on mobile (<768px)
- AD facility filter: view all teams' events for a specific facility

**User Stories:**
- US-1.1: As a coach, I can view my team's week in a grid so I see time-of-day distribution at a glance.
- US-1.2: As a coach, I can drag an event to a different time slot to reschedule in one gesture.
- US-1.3: As a coach, I can inline-edit time/field on any event without opening a modal.
- US-1.4: As an AD, I can filter the board by facility to check utilization across all teams.

**Acceptance Criteria:**
- [ ] Week grid renders with time rows and day columns
- [ ] Events positioned by datetime, sized by duration
- [ ] Drag-and-drop triggers PATCH to games/practices API + conflict check
- [ ] Conflict badges carried over from existing CalendarTab
- [ ] Falls back to list view on mobile
- [ ] Keyboard shortcuts work when board is focused

---

### 5.2 Enhanced Conflict Detection — Multi-Sport Athletes, Resources, Facilities

**What exists:** Conflict engine checks events against blockers (school-wide, team, facility scopes). ConflictOverride for acknowledged conflicts. Priority-based suggestions.

**What to build (extend `conflicts/service.ts` and new `scheduling-engine.ts`):**

1. **Facility double-booking** — Query games + practices at same `facility_id` with overlapping times. Currently only checks blockers, not other events.
2. **Multi-sport athlete overlap** — When EventParticipant records exist, detect when a person is in two events overlapping by >5 minutes.
3. **Resource uniqueness** — Detect when a bus/ref (EventResource) is assigned to two overlapping events.
4. **Smart slot suggestions** — Scan next 10 open 30-min slots, score by proximity + notification count.

**Conflict Rules (ordered by severity):**
1. `error`: Facility double-booked (same facility_id, overlapping time)
2. `error`: Resource double-booked (same resource, overlapping time)
3. `warning`: Person in overlapping events (>5 min overlap)
4. Existing: Blocker overlap (school-wide, team, facility scope)

**User Stories:**
- US-2.1: As a coach, I'm warned when my event overlaps another team's event at the same facility.
- US-2.2: As a coach, I'm warned when a multi-sport athlete has a time conflict.
- US-2.3: As an AD, I see when a bus or ref is double-booked.
- US-2.4: As a coach, I can click "Suggest Slot" to get alternatives ranked by least disruption.

**Acceptance Criteria:**
- [ ] Creating/moving an event triggers full conflict check (facility + person + resource + blocker)
- [ ] Conflict badges on event cards show type icons (facility, person, resource)
- [ ] "Suggest Open Slot" returns top 10 slots scored by `hoursDiff + warningCount * 2`
- [ ] Conflict check < 200ms for typical school (10 teams, 50 events/week)
- [ ] New conflict types appear in existing ConflictsPage alongside blocker conflicts

**New API Endpoints:**
```
POST /api/v1/schools/:schoolId/check-conflicts   → Full conflict check
POST /api/v1/schools/:schoolId/suggest-slots      → Smart slot suggestions
```

---

### 5.3 Notifications — SMS + Email on Event Changes

**What exists:** Schema for Notification + NotificationPreference. Email sending for invites (Resend). Twilio config vars in env. Empty `notifications/` module.

**What to build:**

1. **Notification service** — On game/practice create/update/cancel, create Notification records and send via Resend (email) or Twilio (SMS).
2. **Notification preferences** — CRUD for per-user, per-school settings (email on/off, SMS on/off, quiet hours, digest).
3. **Quiet hours** — Queue messages during quiet window, send when window ends.
4. **Nightly digest** — Batch all changes from past 24 hours into single email for parents who opt in.
5. **SMS opt-out** — Twilio webhook to honor STOP replies.
6. **Preferences UI** — Settings panel for notification config.

**Notification Triggers:**
| Trigger | Channel | Recipients |
|---------|---------|------------|
| Event created | Email | Team members |
| Event time/place changed | SMS + Email | Team members + parents |
| Event cancelled | SMS + Email | Team members + parents |
| Nightly digest | Email | Parents with digest opt-in |

**SMS Template:**
```
[AthleticOS] Varsity Soccer practice MOVED to Tue 3:30pm @ Gym A.
View: {deep_link}
Reply STOP to opt out.
```

**User Stories:**
- US-3.1: As a parent, I get an SMS when my child's practice is moved with a link to the updated schedule.
- US-3.2: As a parent, I can opt into a nightly digest instead of individual messages.
- US-3.3: As a coach, I can set quiet hours so notifications aren't sent during school hours.
- US-3.4: As an athlete, I get an email when a new game is added to my schedule.

**Acceptance Criteria:**
- [ ] SMS sent via Twilio on event change/cancel
- [ ] Email sent via Resend on event create/change/cancel
- [ ] Preferences UI: email on/off, SMS on/off, quiet hours, digest toggle
- [ ] Quiet hours respected (messages queued)
- [ ] SMS opt-out via STOP reply honored
- [ ] Nightly digest batches changes from past 24 hours

**New API Endpoints:**
```
GET  /api/v1/notifications/preferences             → Get user's preferences
PUT  /api/v1/notifications/preferences             → Update preferences
GET  /api/v1/schools/:schoolId/notifications        → List notifications (admin)
POST /api/v1/schools/:schoolId/notifications/test   → Send test notification
```

---

### 5.4 Personal Calendar Feeds

**What exists:** iCal export works through schedule share tokens (`GET /public/schedules/:token/calendar`). CalendarFeed model in schema. No CalendarFeed service or routes.

**What to build:**
1. **CalendarFeed service** — Create/list/deactivate personal feed tokens.
2. **Team feed** — All events for one team across seasons.
3. **User feed** — All events across all the user's teams (multi-sport athletes see everything).
4. **Public feed endpoint** — `GET /cal/:token.ics` returns dynamically generated iCal.
5. **Feed management UI** — Generate/copy/deactivate feed URLs.

**User Stories:**
- US-4.1: As a parent, I can subscribe to my child's team schedule in my phone calendar.
- US-4.2: As an athlete, I get a personal feed that includes all my teams' events.
- US-4.3: As a coach, I can generate a team calendar link that auto-updates.

**Acceptance Criteria:**
- [ ] `POST /api/v1/calendar-feeds` creates a feed with team or user scope
- [ ] `GET /cal/:token.ics` returns valid iCalendar with VEVENT entries (reuse existing `generateICS()`)
- [ ] User feeds include events from all teams the user belongs to
- [ ] Feeds can be deactivated without deleting
- [ ] UI shows feed URLs with copy-to-clipboard

**New API Endpoints:**
```
POST   /api/v1/calendar-feeds          → Create feed
GET    /api/v1/calendar-feeds          → List user's feeds
DELETE /api/v1/calendar-feeds/:id      → Deactivate feed
GET    /cal/:token.ics                 → Public iCal feed (no auth)
```

---

### 5.5 Quick-Add Event Parsing

**What exists:** Nothing. Empty `quick-add/` module.

**What to build:** A text input bar on the weekly board that parses natural language into an event.

**Syntax:** `"Tue 3:30-5pm Gym A (Varsity)"`

**Parsing Rules:**
- Day of week → next occurrence from today
- Time range → start/end (calculate durationMinutes)
- Facility name → fuzzy match against school's facilities
- Team name in parens → fuzzy match against school's teams
- If no team → default to current season's team
- "vs [opponent]" → creates a Game instead of Practice

**User Stories:**
- US-5.1: As a coach, I can type "Tue 3:30-5pm Gym A" and create a practice in seconds.
- US-5.2: As a coach, I can type "Sat 10am vs Oak Ridge Field A" and create a game.

**Acceptance Criteria:**
- [ ] Quick-add bar at top of weekly board
- [ ] Parses day, time range, facility, team from text
- [ ] Shows preview card before confirming
- [ ] Runs conflict check on parsed event before save
- [ ] Falls back to standard create form if parsing fails

**New API Endpoint:**
```
POST /api/v1/schools/:schoolId/quick-add  → Parse text → event preview
```

---

### 5.6 Bulk Operations — Shift Week + Rain Plan

**What exists:** Blocker system (WEATHER type). Batch conflict override on ConflictsPage. Empty `bulk-ops/` module.

**What to build:**

1. **Shift Week** — Move all events in a date range by N minutes.
   - Use case: daylight saving, adjusted dismissal times.
   - Preview affected events with old → new times before confirming.
   - Trigger notifications for all moved events.

2. **Rain Plan** — One click moves outdoor events to indoor fallback facilities.
   - Facility rain mapping: each FIELD/COURT/TRACK can designate a GYM/OTHER as fallback.
   - Preview affected events + any conflicts at indoor facility.
   - Trigger notifications for all moved events.

**User Stories:**
- US-6.1: As a coach, I can shift all my practices 30 minutes later for daylight saving.
- US-6.2: As a coach, I can trigger a rain plan that moves outdoor events to designated indoor facilities.
- US-6.3: As an AD, I can preview what the rain plan will do before confirming.

**Acceptance Criteria:**
- [ ] "Shift Week" on weekly board: select date range + offset in minutes
- [ ] Preview shows all affected events with old → new times
- [ ] Confirm triggers batch PATCH + notifications
- [ ] "Rain Plan" on weekly board: moves FIELD/COURT/TRACK events to mapped indoor facilities
- [ ] Rain plan shows conflicts if indoor facility already booked
- [ ] Both operations trigger notifications for affected team members

**New API Endpoints:**
```
POST /api/v1/schools/:schoolId/bulk-move   → Shift events by offset
POST /api/v1/schools/:schoolId/rain-plan   → Execute rain plan
```

---

### 5.7 Role-Based Permission Enforcement

**What exists:** Roles assigned via SchoolUser. `requireRole()` middleware exists in `auth.ts` but is not applied to most routes.

**What to build:** Apply `requireRole()` checks to all mutation routes.

| Route Group | Allowed Roles |
|-------------|---------------|
| Create/edit games, practices | ADMIN, ATHLETIC_DIRECTOR, COACH |
| Manage facilities | ADMIN, ATHLETIC_DIRECTOR |
| Manage resources | ADMIN, ATHLETIC_DIRECTOR |
| Override conflicts | ADMIN, ATHLETIC_DIRECTOR, COACH |
| Manage school settings | ADMIN |
| View-only (events, calendar) | All roles |

**Acceptance Criteria:**
- [ ] All mutation routes check user role via `requireRole()` middleware
- [ ] Coach can only modify events for their own team's seasons
- [ ] Parent/Athlete get 403 on mutation endpoints
- [ ] AD can modify any team within their school

---

### 5.8 Print-Friendly Week View

**What exists:** PublicSchedulePage renders schedules. No print styles.

**What to build:**
- "Print" button on weekly board and season detail
- CSS `@media print` that hides nav, sidebar, buttons
- Clean table layout: day, time, type, facility, opponent/notes
- Header with team name, school, week dates
- Footer with generation timestamp and calendar feed URL

**User Stories:**
- US-8.1: As a coach, I can print this week's schedule as a clean one-pager for the locker room.

**Acceptance Criteria:**
- [ ] "Print" button triggers `window.print()`
- [ ] Print styles hide all chrome (nav, sidebar, buttons, modals)
- [ ] Print layout fits on one page (landscape)
- [ ] Shows team name, school, week range in header

---

## 6. Data Model Changes

### Already Committed (schema + migration exist)

| Model | Purpose | Service Status |
|-------|---------|----------------|
| Resource | Buses, refs, equipment | CRUD service + routes done |
| EventResource | Link resources → events | Part of resources service |
| EventParticipant | Track athletes per event | Schema only, needs conflict wiring |
| Notification | Audit trail of sent messages | Schema only, needs full service |
| NotificationPreference | Per-user notification settings | Schema only, needs full service |
| CalendarFeed | Personal iCal subscription tokens | Schema only, needs full service |
| User.phone | SMS phone number | Column added |

### New Schema Needed

**Facility.rainFallbackId** — Optional FK to another facility, used by rain plan.
```prisma
model Facility {
  ...
  rainFallbackId String? @map("rain_fallback_id")
  rainFallback   Facility? @relation("RainFallback", fields: [rainFallbackId], references: [id])
  rainFallbackFor Facility[] @relation("RainFallback")
}
```

---

## 7. Integrations

| Priority | Integration | Status | Mechanism |
|----------|-------------|--------|-----------|
| P0 | Google/Apple/Outlook Calendar | Partial (share-based iCal exists) | Extend with personal CalendarFeed URLs |
| P0 | SMS (Twilio) | Config only | Build notification service |
| P0 | Email (Resend) | Invite emails work | Extend to event notifications |
| P1 | Ref assignor CSV import | CSV import exists for games | Extend to resource import |
| P1 | District bus requests | Not started | Email template generation |

---

## 8. Security & Privacy

- **FERPA compliance:** Roster data scoped to team; parent view limited to their athlete's teams.
- **Permission enforcement:** Apply `requireRole()` to all mutation routes (Section 5.7).
- **Calendar feed tokens:** Unguessable cuid tokens, deactivatable without deletion.
- **SMS opt-out:** STOP reply handling via Twilio webhook.
- **Data minimization:** Phone numbers only stored if user opts into SMS.

---

## 9. UI Wireframes

### 9.1 Weekly Board (upgrade from existing list view)

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Quick Add: "Tue 3:30-5pm Gym A (Varsity)"]     [Rain Plan] [Print]│
├────────┬────────┬────────┬────────┬────────┬────────┬────────┬──────┤
│  Time  │  Mon   │  Tue   │  Wed   │  Thu   │  Fri   │  Sat   │ Sun  │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┼──────┤
│  3:00  │        │        │        │        │        │        │      │
├────────┤        │┌──────┐│        │        │        │        │      │
│  3:30  │        ││▓ Vars││        │┌──────┐│        │        │      │
│        │        ││ Prac ││        ││▓ JV  ││        │        │      │
│        │        ││ Gym A││        ││ Prac ││        │        │      │
│  4:00  │        ││⚠ 1   ││        ││ Field││        │        │      │
│        │        │└──────┘│        │└──────┘│        │        │      │
├────────┤┌──────┐│        │        │        │┌──────┐│        │      │
│  4:30  ││▓ Game││        │┌──────┐│        ││▓ Vars││        │      │
│        ││vs Oak││        ││▓ Vars││        ││ Prac ││        │      │
│        ││Field ││        ││ Prac ││        ││ Gym A││        │      │
│  5:00  │└──────┘│        ││ Gym B││        │└──────┘│        │      │
│        │        │        │└──────┘│        │        │        │      │
└────────┴────────┴────────┴────────┴────────┴────────┴────────┴──────┘

Legend: ▓ = colored card    ⚠ = conflict badge
Cards: Blue = Game, Green = Practice
```

### 9.2 Conflict Detail (extends existing ConflictBadge)

```
┌────────────────────────────┐
│ ▓ Varsity Practice         │
│   Tue 3:30-5:00pm · Gym A  │
│ ⚠ 2 conflicts              │
│ ┌────────────────────────┐ │
│ │ ❌ Facility: JV Prac    │ │
│ │    Gym A 3:00-4:30pm   │ │
│ │ ⚠ Person: J. Smith     │ │
│ │    Baseball 3:00-5pm   │ │
│ │ [Suggest Open Slot]    │ │
│ └────────────────────────┘ │
└────────────────────────────┘
```

### 9.3 SMS Change Notice

```
[AthleticOS] Varsity Soccer practice MOVED:
Was: Tue 3:30pm Field A
Now: Tue 5:00pm Gym A
View: athleticos.app/s/abc
Reply STOP to opt out
```

### 9.4 Notification Preferences

```
┌──────────────────────────────────┐
│ Notification Settings            │
│                                  │
│ Email Notifications    [✓ On]    │
│ SMS Notifications      [  Off]   │
│   Phone: _______________         │
│                                  │
│ Quiet Hours                      │
│   Start: [8:00 AM]               │
│   End:   [3:00 PM]               │
│                                  │
│ Nightly Digest         [  Off]   │
│   (Summary of all changes)       │
│                                  │
│ [Save Preferences]               │
└──────────────────────────────────┘
```

### 9.5 Print Week View

```
┌──────────────────────────────────────────────────┐
│          VARSITY SOCCER - WEEK OF MAR 16         │
│            Lincoln High School                   │
├──────┬──────────┬──────────┬──────────┬──────────┤
│ Day  │ Time     │ Type     │ Location │ Notes    │
├──────┼──────────┼──────────┼──────────┼──────────┤
│ Mon  │ 4:30-6p  │ Game     │ Field A  │ vs Oak   │
│ Tue  │ 3:30-5p  │ Practice │ Gym A    │          │
│ Wed  │ 3:30-5p  │ Practice │ Gym B    │          │
│ Thu  │ 3:30-5p  │ Practice │ Field A  │          │
│ Fri  │ 4:30-6p  │ Practice │ Gym A    │          │
│ Sat  │ 10a-12p  │ Game     │ Field A  │ vs Elm   │
└──────┴──────────┴──────────┴──────────┴──────────┘
│ Generated: Mar 13, 2026    Cal: athleticos.app/… │
└──────────────────────────────────────────────────┘
```

---

## 10. Implementation Priority

| Priority | Feature | Effort | Depends On |
|----------|---------|--------|------------|
| P0 | 5.7 Role-based permissions | S | Nothing |
| P0 | 5.2 Enhanced conflict detection | M | Resources CRUD (done) |
| P0 | 5.3 Notifications | L | Nothing |
| P1 | 5.1 Weekly board grid | L | Nothing |
| P1 | 5.4 Personal calendar feeds | S | Existing iCal generation |
| P1 | 5.5 Quick-add parsing | M | Weekly board |
| P2 | 5.6 Bulk ops (shift + rain plan) | M | Notifications, Facility.rainFallbackId |
| P2 | 5.8 Print-friendly view | S | Weekly board |

**S** = 1-2 days, **M** = 3-5 days, **L** = 1-2 weeks

---

## 11. Rollout Plan

| Phase | Duration | Scope | Goal |
|-------|----------|-------|------|
| 1. Pilot | 4 weeks | 2-3 schools, 5-7 teams each | Import current calendars; measure time-to-schedule |
| 2. Polish | 2 weeks | Same schools | Tighten conflict heuristics, polish SMS flows |
| 3. Expand | 4 weeks | Add AD multi-team board, bus/ref resources | Full resource management |
| 4. Launch | Ongoing | General availability | Pricing, onboarding, support |

### Pricing (Target)
- $99/team/season, or
- $1-2/athlete/month (district discount available)

---

## 12. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Median event creation time | <15 seconds | Client-side timing |
| Median reschedule time (with notifications) | <2 minutes | From edit to all SMS sent |
| Parent iCal adoption | 70% | CalendarFeed creation rate |
| SMS opt-out rate | <3% | Twilio webhook tracking |
| Conflict detection pre-publication | >90% | Conflicts caught before event start |
| Weekly board load time | <1 second | Lighthouse/RUM |

---

## 13. Technical Notes

### Stack (no changes)
- **Backend:** Fastify + TypeScript, Prisma ORM, Zod validation, Vitest
- **Frontend:** React 19 + Vite, Tailwind CSS, TanStack Query
- **Database:** PostgreSQL 16
- **Infrastructure:** Docker Compose (local), Render (prod)

### New Dependencies
- **Twilio SDK** — SMS delivery (config vars already added)
- No other new deps needed (iCal generation already exists in `public-routes.ts`)

### Architecture Notes
- Enhanced conflict engine runs synchronously on create/update — must stay < 200ms
- Notifications: write PENDING to `notifications` table, background worker sends
- iCal feeds: generated on-demand, reuse existing `generateICS()`
- Quick-add parsing: pure regex/string matching, no AI needed

---

## 14. Open Questions

1. **Ref assignor integration format:** Standard CSV format, or school-specific?
2. **District bus requests:** Email template vs. direct API?
3. **Multi-school AD view:** Unified board across schools?
4. **Offline support:** Offline event creation for coaches at remote fields?
5. **Weather API:** Auto-blocking via weather service, or manual-only for v1?

---

## 15. Out of Scope (v1)

- AI-powered schedule optimization
- Live score tracking
- Video/photo sharing
- Direct messaging between users
- Payment/fee collection
- Transportation routing
- Official standings/rankings integration
