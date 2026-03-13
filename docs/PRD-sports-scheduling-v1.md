# AthleticOS Sports Scheduling — PRD v1

> **Status:** Draft
> **Author:** Engineering
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

## 3. User Personas & Roles

| Persona | Role | Core Need |
|---------|------|-----------|
| Coach (HC/Asst) | `COACH` | Create/edit events, see conflicts, notify team |
| Athletic Director | `ATHLETIC_DIRECTOR` | Multi-team facility view, approve overrides, manage resources |
| Athlete | `ATHLETE` | See own schedule, get change notifications |
| Parent | `PARENT` | See child's schedule, get SMS/email for changes, iCal sync |
| Admin | `ADMIN` | Full system access, manage school settings |

### Permission Matrix

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

## 4. Must-Have Features (v1)

### 4.1 Weekly Board

**Description:** A drag-and-drop weekly calendar view showing all events for a season, team, or facility.

**User Stories:**
- US-1.1: As a coach, I can view my team's week at a glance so I know what's scheduled.
- US-1.2: As a coach, I can drag an event to a different time slot so I can reschedule in one gesture.
- US-1.3: As a coach, I can inline-edit time, field, and team on any event without opening a modal.
- US-1.4: As a coach, I can use keyboard shortcuts (N = new event, E = edit, Delete = remove, arrow keys = navigate) so I can schedule without a mouse.
- US-1.5: As an AD, I can view all teams' events on a single board filtered by facility to check utilization.

**Acceptance Criteria:**
- [ ] Week view renders Mon-Sun columns with 30-minute time rows (7am-10pm)
- [ ] Events display as colored cards (blue=game, green=practice) with team name, time, facility
- [ ] Drag-and-drop moves an event and saves on drop (optimistic UI)
- [ ] Click on empty slot opens quick-create popover
- [ ] Conflict badges appear inline on cards with overlap issues
- [ ] Board is responsive — stacks to list view on mobile (<768px)
- [ ] Keyboard navigation: arrow keys move focus, Enter opens edit, N creates new

### 4.2 Auto-Conflict Detection

**Description:** Real-time conflict engine that flags double-booked fields, buses, refs, and multi-sport athletes. Suggests nearest open slot.

**User Stories:**
- US-2.1: As a coach, I see a red badge on any event that has a facility conflict so I can fix it before publishing.
- US-2.2: As a coach, I'm warned when a multi-sport athlete is double-booked so I can coordinate with the other coach.
- US-2.3: As an AD, I see when a bus or referee is assigned to overlapping events.
- US-2.4: As a coach, when I see a conflict, I can click "Suggest Slot" and get the next 10 open slots scored by least disruption.

**Conflict Rules:**
1. No overlapping events on the same `facility_id`
2. No person in two events overlapping by >5 minutes (multi-sport athlete check)
3. Resource uniqueness per time block (bus/ref can only be in one place)
4. Blocker overlap (existing: exam, weather, maintenance, etc.)

**Acceptance Criteria:**
- [ ] Creating/moving an event triggers conflict check before save
- [ ] Conflicts appear as badges on the event card with count + type icons
- [ ] Clicking a conflict badge shows detail panel: what's conflicting, who, when
- [ ] "Suggest Open Slot" scans next 10 available slots, sorted by (proximity to original time × notification count)
- [ ] Conflict check runs in <200ms for typical school (10 teams, 50 events/week)

### 4.3 Roster & Participants

**Description:** Track which athletes/coaches are on each team and assigned to each event, enabling multi-sport conflict detection.

**User Stories:**
- US-3.1: As a coach, I can see my team roster with contact info.
- US-3.2: As an AD, I can see which athletes play multiple sports and flag scheduling conflicts.
- US-3.3: As a coach, I can assign specific athletes to an event (optional — defaults to full team).

**Acceptance Criteria:**
- [ ] Team roster shows members with role, email, phone
- [ ] Event detail shows participant list
- [ ] Multi-sport athletes are highlighted in conflict reports
- [ ] Participant assignment is optional (events without explicit participants are treated as whole-team)

### 4.4 Notifications

**Description:** SMS + email notifications for event creation, changes, and cancellations. Parents get opt-in digest mode.

**User Stories:**
- US-4.1: As a parent, I receive a single concise SMS when my child's practice is moved, with a link to the updated schedule.
- US-4.2: As a parent, I can opt into a nightly digest that summarizes only changes, instead of individual messages.
- US-4.3: As a coach, I can set quiet hours so notifications aren't sent during school hours.
- US-4.4: As an athlete, I receive an email when a new game is added to my schedule.

**Notification Triggers:**
| Trigger | Channel | Recipients |
|---------|---------|------------|
| Event created | Email | Team members |
| Event time/place changed | SMS + Email | Team members + parents |
| Event cancelled | SMS + Email | Team members + parents |
| Nightly digest | Email | Parents with digest opt-in |

**SMS Template Example:**
```
[AthleticOS] Varsity Soccer practice MOVED to Tue 3:30pm @ Gym A.
View: {deep_link}
Reply STOP to opt out.
```

**Acceptance Criteria:**
- [ ] SMS sent via Twilio/MessageBird on event change/cancel
- [ ] Email sent via Resend on event create/change/cancel
- [ ] Users can set notification preferences per school (email on/off, SMS on/off, quiet hours, digest)
- [ ] Quiet hours respected (messages queued until quiet window ends)
- [ ] SMS opt-out via STOP reply honored
- [ ] Nightly digest email batches all changes from past 24 hours

### 4.5 Calendar Sync (iCal Feeds)

**Description:** One-way iCal (.ics) links for Google/Apple/Outlook per team, per athlete, or per parent.

**User Stories:**
- US-5.1: As a parent, I can subscribe to my child's team schedule in my phone calendar.
- US-5.2: As a coach, I can share a team calendar link that auto-updates when I make changes.
- US-5.3: As an athlete, I can get a personal feed that includes all my teams' events.

**Acceptance Criteria:**
- [ ] Each calendar feed has a unique, unguessable token URL
- [ ] Feed returns valid iCalendar (.ics) format with VEVENT entries
- [ ] Events include: summary, start/end time, location (facility name), description (notes), status
- [ ] Cancelled events show as CANCELLED status in iCal
- [ ] Feed scoped to team (all events) or user (events for all their teams)
- [ ] Feeds can be deactivated without deleting

### 4.6 Weather & Blackout Windows

**Description:** When lightning, field closure, or other weather events occur, propose reschedule for all affected outdoor events.

**User Stories:**
- US-6.1: As a coach, I can mark "Rain Plan" which moves all outdoor events to a designated indoor facility template.
- US-6.2: As an AD, I can create a weather blocker that auto-flags all outdoor events in the window.

**Note:** The existing Blocker model (type=WEATHER, scope=FACILITY/SCHOOL_WIDE) already supports this. This feature extends it with:
- One-click "Rain Plan" bulk action
- Template for indoor fallback facility per outdoor facility

**Acceptance Criteria:**
- [ ] "Rain Plan" button on weekly board triggers bulk move of outdoor events to rain facilities
- [ ] Rain facility mapping: each outdoor facility can have a designated indoor fallback
- [ ] Coach can preview affected events before confirming the bulk move
- [ ] Notifications sent for all moved events

### 4.7 Export & Print

**Description:** One-page printable week view for the locker room bulletin board.

**User Stories:**
- US-7.1: As a coach, I can print this week's schedule as a clean one-pager.
- US-7.2: As an AD, I can export a facility utilization report for the week.

**Acceptance Criteria:**
- [ ] "Print" button generates a clean, ink-friendly week view
- [ ] Print view shows: day, time, team, event type, facility, opponent (for games)
- [ ] CSS @media print styles hide nav, buttons, and non-essential UI
- [ ] Export as PDF option (using browser print-to-PDF)

---

## 5. Coach-Speed Workflows

### 5.1 Quick Add

**Syntax:** `"Tue 3:30-5pm Gym A (Varsity)"` typed into a quick-add bar

**Parsing Rules:**
- Day of week → maps to next occurrence
- Time range → start/end time
- Facility name → fuzzy match against school's facilities
- Team name in parens → fuzzy match against school's teams
- If no team specified → defaults to current season's team

**Acceptance Criteria:**
- [ ] Quick-add bar at top of weekly board
- [ ] Parses day, time, facility, and team from natural text
- [ ] Shows preview card before confirming
- [ ] Falls back to standard create form if parsing fails

### 5.2 Bulk Move

**Description:** Shift an entire week's events by N minutes (e.g., daylight saving time adjustment).

**Acceptance Criteria:**
- [ ] "Shift Week" action on weekly board: select week + offset in minutes
- [ ] Preview shows all affected events with old → new times
- [ ] Confirm triggers batch update + notifications
- [ ] Undo available for 5 minutes after bulk move

### 5.3 Rain Plan

**Description:** One click moves all outdoor events to indoor fallback facilities.

**Acceptance Criteria:**
- [ ] "Rain Plan" button on weekly board
- [ ] Uses facility rain mapping (outdoor → indoor fallback)
- [ ] Shows conflicts if indoor facility is already booked
- [ ] Sends notifications for all moved events

---

## 6. Data Model

### Existing Models (already in schema)
- `School`, `Team`, `Season`, `Facility`, `TimeSlot`
- `Game`, `Practice`
- `Blocker`, `ConflictOverride`
- `ScheduleShare`, `PriorityRule`
- `User`, `SchoolUser`, `Invite`

### New Models (v1)

#### Resource
Tracks shared resources like buses, referees, and equipment.
```
Resource {
  id, schoolId, name, type(BUS|REFEREE|EQUIPMENT|OTHER), metadata(JSON)
}
```

#### EventResource
Links resources to specific games/practices.
```
EventResource {
  id, resourceId, eventType(GAME|PRACTICE), gameId?, practiceId?
}
```

#### EventParticipant
Tracks which users are assigned to specific events (enables multi-sport conflict detection).
```
EventParticipant {
  id, userId, eventType(GAME|PRACTICE), gameId?, practiceId?
  unique(userId, gameId), unique(userId, practiceId)
}
```

#### Notification
Tracks all sent notifications.
```
Notification {
  id, schoolId, userId, channel(EMAIL|SMS), subject?, body,
  eventType?, eventId?, status(PENDING|SENT|FAILED), sentAt?, failReason?
}
```

#### NotificationPreference
Per-user, per-school notification settings.
```
NotificationPreference {
  id, userId, schoolId, emailEnabled, smsEnabled,
  quietStart(HH:MM)?, quietEnd(HH:MM)?, digestEnabled
}
```

#### CalendarFeed
iCal subscription tokens.
```
CalendarFeed {
  id, token(unique), userId, scope(TEAM|USER), teamId?, isActive
}
```

### User Table Addition
- `phone` field added for SMS notifications

---

## 7. Conflict Engine (Technical Spec)

### Algorithm
```
checkAllConflicts(event) → SchedulingConflict[]
  1. Facility overlap: query games + practices at same facility in time range
  2. Person overlap: query EventParticipant for any participant in another event
     overlapping by >5 minutes
  3. Resource overlap: query EventResource for same resource in overlapping time
  4. Blocker overlap: existing blocker check (school-wide, team, facility scope)
```

### Smart Suggest Algorithm
```
suggestOpenSlots(event) → SlotSuggestion[]
  1. Starting from preferred time, scan 30-min increments (7am-10pm, up to 7 days)
  2. For each slot × each available facility:
     a. Run checkAllConflicts
     b. If no errors: score = hoursDiff + warningCount * 2
  3. Return top 10 sorted by score (lower = better)
```

### Performance Target
- Conflict check < 200ms for a school with 10 teams and 50 events/week
- Smart suggest < 2s for 10 suggestions

---

## 8. Integrations

| Priority | Integration | Mechanism |
|----------|-------------|-----------|
| P0 | Google/Apple/Outlook Calendar | iCal (.ics) feed URLs |
| P0 | SMS (Twilio) | REST API, webhook for opt-out |
| P0 | Email (Resend) | REST API (already integrated) |
| P1 | Ref assignor CSV import | CSV upload, map columns to resources |
| P1 | District bus requests | Email template generation |

---

## 9. Security & Privacy

- **FERPA compliance:** Roster data scoped to team; parent view limited to their athlete's teams.
- **Permission enforcement:** All API routes check `SchoolUser.role` against permission matrix.
- **Calendar feed tokens:** Unguessable cuid tokens, deactivatable without deletion.
- **SMS opt-out:** STOP reply handling via Twilio webhook, stored in NotificationPreference.
- **Data minimization:** Phone numbers only stored if user opts into SMS.

---

## 10. API Endpoints (New)

### Resources
```
GET    /api/v1/schools/:schoolId/resources          → List resources
POST   /api/v1/schools/:schoolId/resources          → Create resource
PATCH  /api/v1/resources/:id                        → Update resource
DELETE /api/v1/resources/:id                        → Delete resource
POST   /api/v1/resources/assign                     → Assign resource to event
DELETE /api/v1/resources/:id/events/:type/:eventId  → Remove resource from event
```

### Conflict Engine
```
POST   /api/v1/schools/:schoolId/check-conflicts    → Full conflict check
POST   /api/v1/schools/:schoolId/suggest-slots       → Smart slot suggestions
```

### Notifications
```
GET    /api/v1/schools/:schoolId/notifications       → List notifications (admin)
GET    /api/v1/notifications/preferences              → Get user's preferences
PUT    /api/v1/notifications/preferences              → Update preferences
POST   /api/v1/schools/:schoolId/notifications/test  → Send test notification
```

### Calendar Feeds
```
POST   /api/v1/calendar-feeds                        → Create feed
GET    /api/v1/calendar-feeds                         → List user's feeds
DELETE /api/v1/calendar-feeds/:id                     → Deactivate feed
GET    /cal/:token.ics                               → Public iCal feed (no auth)
```

### Quick Add & Bulk Ops
```
POST   /api/v1/schools/:schoolId/quick-add            → Parse natural language → event
POST   /api/v1/schools/:schoolId/bulk-move             → Shift events by offset
POST   /api/v1/schools/:schoolId/rain-plan             → Execute rain plan
```

---

## 11. UI Wireframes

### 11.1 Weekly Board

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

### 11.2 Conflict Banner (on event card)

```
┌────────────────────────────┐
│ ▓ Varsity Practice         │
│   Tue 3:30-5:00pm          │
│   Gym A                    │
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

### 11.3 Slot Suggestions Panel

```
┌──────────────────────────────────┐
│ Suggested Open Slots             │
│                                  │
│  1. Tue 5:00-6:30pm  Gym A  ✓   │
│     0 conflicts                  │
│                                  │
│  2. Wed 3:30-5:00pm  Gym A      │
│     0 conflicts                  │
│                                  │
│  3. Tue 3:30-5:00pm  Gym B      │
│     1 warning (J. Smith)         │
│                                  │
│  [Move to Slot 1]  [Cancel]      │
└──────────────────────────────────┘
```

### 11.4 SMS Change Notice

```
┌──────────────────────────────┐
│ [AthleticOS] Varsity Soccer  │
│ practice MOVED:              │
│                              │
│ ❌ Was: Tue 3:30pm Field A    │
│ ✅ Now: Tue 5:00pm Gym A      │
│                              │
│ View: athleticos.app/s/abc   │
│ Reply STOP to opt out        │
└──────────────────────────────┘
```

### 11.5 Notification Preferences

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

### 11.6 Print Week View

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

## 12. Rollout Plan

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

## 13. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Median event creation time | <15 seconds | Client-side timing |
| Median reschedule time (with notifications) | <2 minutes | From edit to all SMS sent |
| Parent iCal adoption | 70% | CalendarFeed creation rate |
| SMS opt-out rate | <3% | Twilio webhook tracking |
| Conflict detection pre-publication | >90% | Conflicts caught before event start |
| Weekly board load time | <1 second | Lighthouse/RUM |

---

## 14. Technical Architecture

### Existing Stack (no changes)
- **Backend:** Fastify + TypeScript, Prisma ORM, Zod validation, Vitest
- **Frontend:** React 18 + Vite, Tailwind CSS, TanStack Query
- **Database:** PostgreSQL 16
- **Infrastructure:** Docker Compose (local), Render (prod)

### New Dependencies
- **Twilio SDK** — SMS delivery
- **ical-generator** — iCal feed generation (or hand-roll, it's simple)

### Architecture Notes
- Conflict engine runs synchronously on create/update — must be fast (<200ms)
- Notifications are fire-and-forget (write to `notifications` table with PENDING status, background worker picks up)
- iCal feeds are generated on-demand (no caching needed for v1 scale)
- Quick-add parsing is pure string matching (no AI/ML needed for v1)

---

## 15. Open Questions

1. **Ref assignor integration format:** Is there a standard CSV format, or school-specific?
2. **District bus requests:** Email template vs. direct API integration?
3. **Multi-school AD view:** Should ADs with multiple schools see a unified board?
4. **Offline support:** How important is offline event creation for coaches at remote fields?
5. **Weather API:** Integrate with a weather service for auto-blocking, or manual-only for v1?

---

## 16. Out of Scope (v1)

- AI-powered schedule optimization
- Live score tracking
- Video/photo sharing
- Direct messaging between users
- Payment/fee collection
- Transportation routing
- Official standings/rankings integration
