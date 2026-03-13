# TRD-009: Complete Athletic Operations Platform

> Status: Draft
> PRD: [PRD-004](../prd/004-sprint3-scheduling-ux-and-notifications.md)
> Created: 2026-03-13
> Last Updated: 2026-03-13 (v1.1 refinement)
> Sprint: 3
> Dependencies: TRD-001 through TRD-008 (Sprints 1-2 complete)

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-03-13 | Initial draft from PRD-004 |
| v1.1 | 2026-03-13 | Refinement: fixed schema status (ALL models are new migrations), verified auth middleware against actual code, matched frontend structure to real codebase, added beads workflow, added migration ordering safety notes, corrected User model (no phone field exists), documented requireRole schoolId bypass edge case |

---

## 1. Overview

### Problem

AthleticOS detects conflicts but doesn't help coaches schedule efficiently. Roles are stored but not enforced. Parents get no notifications. The calendar is a list, not a visual tool. Facility operations still live in SchoolDude. Sprint 3 closes every gap between "impressive demo" and "daily-use tool."

### Solution

Eleven features across four themes:

| Theme | Features | Goal |
|-------|----------|------|
| Trust & Security | F1: Permission Enforcement | Right people can do the right things |
| Intelligence & Detection | F2: Enhanced Conflicts, F3: Notifications | Catch every mistake, inform everyone |
| Scheduling UX | F4: Weekly Board, F5: Calendar Feeds, F6: Quick-Add, F7: Bulk Ops, F8: Print View, F11: Recurring Events | Coach-speed scheduling |
| Facility Operations | F9: Facility Requests, F10: Event Checklists | Replace SchoolDude |

### Relationship to Existing System

- **Extends** `authenticate` and `requireRole()` middleware with enforcement on all mutation routes
- **Extends** `conflictService` with facility double-booking, person overlap, and resource collision detection
- **Extends** Resend email integration (invites) to support notifications and SMS
- **Extends** `eventsService.getUpcoming()` with date range filtering for the weekly board
- **Extends** `ScheduleShare` iCal generation for personal calendar feeds
- **Adds** 7 new backend modules: `notifications`, `calendar-feeds`, `facility-requests`, `operations`, `recurring`, `quick-add`, `bulk-ops`
- **Adds** new Prisma models: `Notification`, `NotificationPreference`, `CalendarFeed`, `FacilityRequest`, `OperationsTemplate`, `EventChecklist`
- **Adds** `phone` field to User model (does NOT exist yet), `COMMUNITY` to the Role enum, `recurrenceGroupId` to Practice, `rainFallbackId` to Facility

---

## 2. Architecture & Design

### System Architecture

```
                                 +------------------+
                                 |   React Frontend |
                                 |  (Vite + Tailwind)|
                                 +--------+---------+
                                          |
                                   TanStack Query
                                          |
                              +-----------+-----------+
                              |    Fastify API Server  |
                              |     (Port 8000)        |
                              +--+--+--+--+--+--+--+--+
                              |  |  |  |  |  |  |  |  |
        +---------------------+  |  |  |  |  |  |  +----------------------+
        |                        |  |  |  |  |  |                         |
   +----v----+   +------v------+ |  |  |  |  |  | +--------v--------+    |
   |  Auth   |   | Permissions | |  |  |  |  |  | | Calendar Feeds  |    |
   | (JWT)   |   | Middleware  | |  |  |  |  |  | | (iCal gen)      |    |
   +---------+   +-------------+ |  |  |  |  |  | +-----------------+    |
                                 |  |  |  |  |  |                        |
   Existing Modules:             |  |  |  |  |  |  New Modules:          |
   - games                       |  |  |  |  |  |  - notifications       |
   - practices                   |  |  |  |  |  |  - calendar-feeds      |
   - conflicts                   |  |  |  |  |  |  - facility-requests   |
   - blockers                    |  |  |  |  |  |  - operations          |
   - events                      |  |  |  |  |  |  - recurring           |
   - facilities                  |  |  |  |  |  |  - quick-add           |
   - seasons                     |  |  |  |  |  |  - bulk-ops            |
   - teams                       |  |  |  |  |  |                        |
   - priority-rules              |  |  |  |  |  |                        |
   - shares                      |  |  |  |  |  |                        |
                                 |  |  |  |  |  |                        |
                              +--v--v--v--v--v--v--+                      |
                              |   Prisma ORM       |                      |
                              |   PostgreSQL 16    |                      |
                              +--------------------+                      |
                                                                          |
                              +--------------------+                      |
                              |   Resend API       |<---------------------+
                              |  (Email + SMS)     |
                              +--------------------+
```

### Data Flow: Notification Delivery

```
Event Mutation (create/update/delete game or practice)
  |
  v
Route Handler (games/routes.ts or practices/routes.ts)
  |
  +---> Save to DB via Prisma
  |
  +---> notificationService.emit({
  |       trigger: 'EVENT_CHANGED',
  |       schoolId, eventType, eventId, changes
  |     })
         |
         v
    Resolve Recipients
    (query SchoolUser + Season + Team membership)
         |
         v
    For each recipient:
      +---> Check NotificationPreference
      |       - channel enabled?
      |       - quiet hours active?
      |       - digest mode?
      |
      +---> If quiet hours: queue in Notification table (status: QUEUED)
      +---> If digest mode: queue in Notification table (status: QUEUED_DIGEST)
      +---> If immediate:
              +---> Email: Resend API -> mark SENT or FAILED
              +---> SMS: Resend API -> mark SENT or FAILED
              +---> Write Notification record (audit trail)
```

### Data Flow: Conflict Check (Enhanced)

```
POST /schools/:schoolId/check-conflicts
  |
  v
Parse request: { eventId?, dateRange?, types[] }
  |
  v
Run checks in parallel:
  +---> Blocker conflicts (existing engine)
  |       Query blockers overlapping date range
  |       Filter by scope (school/team/facility)
  |
  +---> Facility double-bookings (NEW)
  |       Query all events at same facility in date range
  |       Compare time windows (exclude back-to-back)
  |
  +---> Person overlaps (NEW -- DEFERRED to Sprint 4)
  |       Requires EventParticipant model (roster feature)
  |       Sprint 3 fallback: detect via coach multi-team membership
  |       Find coaches with >1 team event overlapping by >5 min
  |
  +---> Resource collisions (NEW -- DEFERRED to Sprint 4)
          Requires Resource + EventResource models (not yet in schema)
          Sprint 3: skip this check type
  |
  v
Merge, deduplicate, sort by severity (error > warning)
  |
  v
Return typed conflict array with suggestions
```

### Data Flow: Facility Request Approval

```
Coach/Community User:
  POST /schools/:schoolId/facility-requests
    |
    v
  Validate input (Zod)
    |
    v
  Run conflict check against existing events + blockers
    |
    v
  Save FacilityRequest (status: PENDING)
    |
    v
  notificationService.emit('FACILITY_REQUEST_SUBMITTED', ...)
    --> Email to AD/ADMIN users

AD Approves:
  PATCH /schools/:schoolId/facility-requests/:id { status: 'APPROVED' }
    |
    v
  If recurrence pattern exists:
    Generate practice instances via recurringService
    |
    v
  notificationService.emit('FACILITY_REQUEST_APPROVED', ...)
    --> Email to requester
```

### Component Inventory

**New Backend Modules** (each follows `modules/<name>/` pattern with `schemas.ts`, `service.ts`, `routes.ts`):

| Module | Purpose |
|--------|---------|
| `notifications` | Notification preferences, delivery, queue, log |
| `calendar-feeds` | CalendarFeed CRUD + iCal generation endpoint |
| `facility-requests` | FacilityRequest CRUD + approval workflow |
| `operations` | OperationsTemplate CRUD + EventChecklist management |
| `recurring` | Recurring practice generation + series management |
| `quick-add` | Natural language event parsing |
| `bulk-ops` | Bulk move, rain plan, auto-resolve |

**Modified Backend Modules:**

| Module | Changes |
|--------|---------|
| `conflicts` | Add facility/person/resource conflict types, suggest-slots endpoint |
| `games` | Add permission middleware, trigger notifications on mutations |
| `practices` | Add permission middleware, trigger notifications, recurrenceGroupId support |
| `blockers` | Trigger notifications on create (weather impact) |
| `facilities` | Add rainFallbackId support, availability endpoint |
| `auth` | Add community registration endpoint |

**New Frontend Pages:**

| Page | Route | Purpose |
|------|-------|---------|
| `WeeklyBoardPage` | `/schools/:schoolId/weekly` | F4: Visual scheduling grid |
| `NotificationPrefsPage` | `/settings/notifications` | F3: Notification preferences |
| `CalendarFeedsPage` | `/settings/calendar-feeds` | F5: Feed management |
| `FacilityRequestsPage` | `/schools/:schoolId/facility-requests` | F9: Request queue |
| `FacilityAvailabilityPage` | `/schools/:schoolId/facilities/:id/availability` | F9: Availability calendar |
| `OperationsReadinessPage` | `/schools/:schoolId/operations` | F10: Readiness dashboard |
| `CommunityPortalPage` | `/community` | F9: Community request tracking |
| `SmsOptOutPage` | `/sms-stop` | F3: SMS opt-out (public) |

**New Frontend Components:**

| Component | Feature | Purpose |
|-----------|---------|---------|
| `WeeklyGrid` | F4 | 7-column time grid with event cards |
| `EventCard` | F4 | Positioned card with type coloring and conflict badge |
| `SlotPopover` | F4 | Quick-create popover on empty slot click |
| `InlineEventEditor` | F4 | Click-to-edit event fields |
| `WeekNavigation` | F4 | Prev/Next/Today week controls |
| `GridFilters` | F4 | Team, facility, type filter bar |
| `QuickAddBar` | F6 | Text input with preview card |
| `BulkMoveDialog` | F7 | Shift week configuration |
| `RainPlanDialog` | F7 | Rain plan preview and confirm |
| `AutoResolveDialog` | F7 | Conflict auto-resolve settings |
| `PrintWeekView` | F8 | Print-optimized layout |
| `NotificationPrefsForm` | F3 | Email/SMS/quiet hours/digest settings |
| `NotificationLog` | F3 | Admin notification history table |
| `FeedList` | F5 | Active feeds with copy/deactivate |
| `FeedGenerator` | F5 | Create new feed (team or user type) |
| `FacilityRequestForm` | F9 | Submit facility request |
| `RequestQueue` | F9 | Pending requests with approve/deny |
| `AvailabilityCalendar` | F9 | Visual facility availability |
| `TemplateEditor` | F10 | Create/edit operations template |
| `EventChecklistPanel` | F10 | Checklist task tracking |
| `ReadinessGrid` | F10 | Completion % per upcoming event |
| `RecurrenceBuilder` | F11 | Day/time/season recurrence config |
| `RecurrencePreview` | F11 | Generated dates with conflict badges |

---

## 3. Data Model Changes

### New Enums

```prisma
// Migration 1: Add new enum values (SEPARATE migration - PostgreSQL requirement)
// Cannot use new enum values in the same transaction as ALTER TYPE ADD VALUE

enum Role {
  ADMIN
  ATHLETIC_DIRECTOR
  COACH
  PARENT
  ATHLETE
  COMMUNITY           // NEW: lightweight external accounts
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

enum NotificationChannel {
  EMAIL
  SMS
}

enum NotificationStatus {
  QUEUED
  QUEUED_DIGEST
  SENT
  FAILED
  SKIPPED
}

enum NotificationTrigger {
  EVENT_CREATED
  EVENT_CHANGED
  EVENT_CANCELLED
  BLOCKER_CREATED
  WEATHER_EMERGENCY
  WEEKLY_DIGEST
  FACILITY_REQUEST_SUBMITTED
  FACILITY_REQUEST_APPROVED
  FACILITY_REQUEST_DENIED
}

enum ConflictType {
  BLOCKER           // existing
  FACILITY          // new: double-booking
  PERSON            // new: athlete overlap
  RESOURCE          // new: bus/referee collision
}

enum ConflictSeverity {
  ERROR
  WARNING
}

enum CalendarFeedType {
  TEAM
  USER
}

enum ChecklistItemStatus {
  NOT_STARTED
  IN_PROGRESS
  DONE
  NOT_APPLICABLE
}
```

### New Models

```prisma
// ============ Notifications ============

model Notification {
  id          String              @id @default(cuid())
  schoolId    String              @map("school_id")
  userId      String              @map("user_id")         // recipient
  channel     NotificationChannel
  trigger     NotificationTrigger
  status      NotificationStatus  @default(QUEUED)
  subject     String
  body        String
  metadata    Json?                                        // { eventId, eventType, changes }
  sentAt      DateTime?           @map("sent_at")
  failedAt    DateTime?           @map("failed_at")
  failReason  String?             @map("fail_reason")
  retryCount  Int                 @default(0) @map("retry_count")
  createdAt   DateTime            @default(now()) @map("created_at")

  school      School              @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  user        User                @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([schoolId])
  @@index([userId])
  @@index([status])
  @@index([createdAt])
  @@map("notifications")
}

model NotificationPreference {
  id              String   @id @default(cuid())
  userId          String   @unique @map("user_id")
  emailEnabled    Boolean  @default(true) @map("email_enabled")
  smsEnabled      Boolean  @default(false) @map("sms_enabled")     // opt-in
  quietHoursStart String?  @map("quiet_hours_start")                // "21:00"
  quietHoursEnd   String?  @map("quiet_hours_end")                  // "07:00"
  digestMode      Boolean  @default(false) @map("digest_mode")
  digestTime      String   @default("07:00") @map("digest_time")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("notification_preferences")
}

// ============ Calendar Feeds ============

model CalendarFeed {
  id          String           @id @default(cuid())
  userId      String           @map("user_id")
  type        CalendarFeedType
  teamId      String?          @map("team_id")           // for TEAM type
  token       String           @unique @default(uuid())   // UUID v4
  isActive    Boolean          @default(true) @map("is_active")
  lastAccessed DateTime?       @map("last_accessed")
  createdAt   DateTime         @default(now()) @map("created_at")

  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  team        Team?            @relation(fields: [teamId], references: [id], onDelete: SetNull)

  @@index([token])
  @@index([userId])
  @@map("calendar_feeds")
}

// ============ Facility Requests ============

model FacilityRequest {
  id           String        @id @default(cuid())
  schoolId     String        @map("school_id")
  facilityId   String        @map("facility_id")
  requestedBy  String        @map("requested_by")
  requestType  RequestType   @map("request_type")
  title        String
  description  String?
  startDate    DateTime      @map("start_date")
  endDate      DateTime      @map("end_date")
  recurrence   Json?                                      // { pattern, days[], seasonId? }
  status       RequestStatus @default(PENDING)
  reviewedBy   String?       @map("reviewed_by")
  reviewedAt   DateTime?     @map("reviewed_at")
  reviewNotes  String?       @map("review_notes")
  createdAt    DateTime      @default(now()) @map("created_at")

  school       School        @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  facility     Facility      @relation(fields: [facilityId], references: [id], onDelete: Cascade)
  requester    User          @relation("requester", fields: [requestedBy], references: [id])
  reviewer     User?         @relation("reviewer", fields: [reviewedBy], references: [id])

  @@index([schoolId])
  @@index([facilityId])
  @@index([status])
  @@map("facility_requests")
}

// ============ Operations & Checklists ============

model OperationsTemplate {
  id        String   @id @default(cuid())
  schoolId  String   @map("school_id")
  name      String                            // "Home Basketball Game"
  sport     String?                           // optional sport filter
  eventType String   @map("event_type")       // "HOME_GAME", "AWAY_GAME", "PRACTICE"
  tasks     Json                              // [{ name, category, defaultLeadTimeDays }]
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  school    School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)

  @@index([schoolId])
  @@map("operations_templates")
}

model EventChecklist {
  id         String    @id @default(cuid())
  gameId     String?   @map("game_id")
  practiceId String?   @map("practice_id")
  templateId String?   @map("template_id")
  tasks      Json                              // [{ name, category, status, assigneeId?, dueDate? }]
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")

  game       Game?     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  practice   Practice? @relation(fields: [practiceId], references: [id], onDelete: Cascade)

  @@index([gameId])
  @@index([practiceId])
  @@map("event_checklists")
}
```

### Modifications to Existing Models

```prisma
// User model additions:
model User {
  // ... existing fields ...
  phone                String?                      // NEW: does NOT exist in current schema, must be added
  notifications        Notification[]               // NEW relation
  notificationPref     NotificationPreference?      // NEW relation
  calendarFeeds        CalendarFeed[]               // NEW relation
  facilityRequestsMade FacilityRequest[] @relation("requester")   // NEW
  facilityRequestsReviewed FacilityRequest[] @relation("reviewer") // NEW
}

// Facility model additions:
model Facility {
  // ... existing fields ...
  rainFallbackId  String?    @map("rain_fallback_id")  // NEW: FK to another Facility
  rainFallback    Facility?  @relation("RainFallback", fields: [rainFallbackId], references: [id])
  fallbackFor     Facility[] @relation("RainFallback")
  requests        FacilityRequest[]                     // NEW relation
}

// Practice model additions:
model Practice {
  // ... existing fields ...
  recurrenceGroupId  String?        @map("recurrence_group_id")  // NEW: links series instances
  checklists         EventChecklist[]                              // NEW relation

  @@index([recurrenceGroupId])  // NEW index
}

// Game model additions:
model Game {
  // ... existing fields ...
  checklists  EventChecklist[]    // NEW relation
}

// School model additions:
model School {
  // ... existing fields ...
  notifications       Notification[]         // NEW relation
  facilityRequests    FacilityRequest[]      // NEW relation
  operationsTemplates OperationsTemplate[]   // NEW relation
}

// Team model additions:
model Team {
  // ... existing fields ...
  calendarFeeds  CalendarFeed[]    // NEW relation
}
```

### Migration Strategy

**IMPORTANT: Current Schema Baseline (main branch)**

The following models ALREADY exist and do NOT need creation:
- User (id, email, name, passwordHash, createdAt, updatedAt -- NOTE: no `phone` field)
- SchoolUser, School, Team, Season, Facility, TimeSlot, Game, Practice
- Blocker, ConflictOverride, ScheduleShare, PriorityRule, PriorityRuleAudit, Invite
- Enums: Role (ADMIN, ATHLETIC_DIRECTOR, COACH, PARENT, ATHLETE), TeamLevel, FacilityType,
  BlockerType, BlockerScope, HomeAway, GameStatus, EventType

The following are ALL NEW and require migrations:
- **New enums**: RequestType, RequestStatus, NotificationChannel, NotificationStatus,
  NotificationTrigger, ConflictType, ConflictSeverity, CalendarFeedType, ChecklistItemStatus
- **New enum value**: COMMUNITY added to existing Role enum
- **New tables**: notifications, notification_preferences, calendar_feeds, facility_requests,
  operations_templates, event_checklists
- **New columns on existing tables**: users.phone, facilities.rain_fallback_id,
  practices.recurrence_group_id

**PostgreSQL Enum Safety Rule**: `ALTER TYPE ADD VALUE` cannot be used in the same transaction
as DDL/DML that references the new value. This was learned in Sprint 2 (see MEMORY.md).
Migrations MUST be split accordingly.

```
Migration 1: 20260314000000_add_sprint3_enums
  - ALTER TYPE "Role" ADD VALUE 'COMMUNITY'
  - CREATE TYPE "RequestType" ('INTERNAL', 'COMMUNITY')
  - CREATE TYPE "RequestStatus" ('PENDING', 'APPROVED', 'DENIED', 'CANCELLED')
  - CREATE TYPE "NotificationChannel" ('EMAIL', 'SMS')
  - CREATE TYPE "NotificationStatus" ('QUEUED', 'QUEUED_DIGEST', 'SENT', 'FAILED', 'SKIPPED')
  - CREATE TYPE "NotificationTrigger" (all 9 trigger values)
  - CREATE TYPE "ConflictType" ('BLOCKER', 'FACILITY', 'PERSON', 'RESOURCE')
  - CREATE TYPE "ConflictSeverity" ('ERROR', 'WARNING')
  - CREATE TYPE "CalendarFeedType" ('TEAM', 'USER')
  - CREATE TYPE "ChecklistItemStatus" ('NOT_STARTED', 'IN_PROGRESS', 'DONE', 'NOT_APPLICABLE')
  *** This migration ONLY does enum work. No tables, no columns. ***

Migration 2: 20260314000001_add_user_phone_column
  - ALTER TABLE "users" ADD COLUMN "phone" VARCHAR NULL
  *** Separated because it modifies an existing high-traffic table ***

Migration 3: 20260314000002_add_sprint3_tables
  - CREATE TABLE "notifications" (references NotificationChannel, NotificationStatus, NotificationTrigger)
  - CREATE TABLE "notification_preferences" (user_id UNIQUE)
  - CREATE TABLE "calendar_feeds" (references CalendarFeedType)
  - CREATE TABLE "facility_requests" (references RequestType, RequestStatus)
  - CREATE TABLE "operations_templates"
  - CREATE TABLE "event_checklists"
  - ALTER TABLE "facilities" ADD COLUMN "rain_fallback_id" (self-referencing FK)
  - ALTER TABLE "practices" ADD COLUMN "recurrence_group_id"
  - CREATE INDEX on all new tables and new columns
```

This three-migration approach ensures:
1. Enum additions are isolated (PostgreSQL transaction safety)
2. Existing table alterations are separated from new table creation
3. New tables can safely reference the enum values created in Migration 1

---

## 4. API Design

### F1: Permission Enforcement (Middleware Changes)

No new endpoints. All existing mutation routes gain `requireRole()` middleware.

**CRITICAL: `requireRole()` Edge Case**

The current `requireRole()` implementation has a silent bypass:

```typescript
export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const schoolId = (request.params as { schoolId?: string }).schoolId;
    if (!schoolId) return;  // <-- SILENTLY RETURNS if no schoolId in params!
    // ... role check logic ...
  };
}
```

This means any route that does NOT have `:schoolId` in its URL params will silently bypass
the role check even when `requireRole()` is applied. Routes affected:
- `GET /cal/:token.ics` -- public, no schoolId, OK (no auth needed)
- `GET /notifications/preferences` -- user-scoped, no schoolId, role check would be skipped
- `PUT /notifications/preferences` -- user-scoped, no schoolId, role check would be skipped

**Fix required in T-001**: Either (a) make `requireRole()` throw an error when schoolId is
missing (breaking change -- requires audit), or (b) create a separate `requireAuth()` middleware
for user-scoped routes that only verifies the user is authenticated with any internal role,
and reserve `requireRole()` for school-scoped routes only. Option (b) is recommended.

**Current Auth Enforcement Status (verified against main branch):**

Routes that ALREADY have `requireRole()`:
- blockers: GET list/detail = ALL roles, POST/PATCH/DELETE = ADMIN + COACH
- schools: PATCH/DELETE = ADMIN only
- facilities: POST (create) = ADMIN only
- teams: POST (create) = ADMIN + COACH
- priority-rules: GET = ALL roles, POST/PATCH = ADMIN or ADMIN + COACH, DELETE = ADMIN
- invites: POST/GET list/DELETE (revoke) = ADMIN only

Routes that have `authenticate` ONLY (no `requireRole`):
- games: all CRUD routes -- **NEEDS requireRole**
- practices: all CRUD routes -- **NEEDS requireRole**
- conflicts: all routes -- **NEEDS requireRole**
- events: all routes -- **NEEDS requireRole**
- seasons: all CRUD routes -- **NEEDS requireRole**
- shares: all routes -- **NEEDS requireRole**
- import: POST route -- **NEEDS requireRole**
- ideas: proxy route -- OK (pass-through to Fortium Ideas, not sensitive)

**Permission Matrix Implementation:**

```typescript
// Roles grouped by access level for DRY middleware application
const STAFF = ['ADMIN', 'ATHLETIC_DIRECTOR', 'COACH'] as const;
const MANAGEMENT = ['ADMIN', 'ATHLETIC_DIRECTOR'] as const;
const ALL_INTERNAL = ['ADMIN', 'ATHLETIC_DIRECTOR', 'COACH', 'PARENT', 'ATHLETE'] as const;

// Example: games/routes.ts
app.post('/seasons/:seasonId/games',
  { preHandler: [requireRole(...STAFF)] },
  async (request, reply) => { ... }
);

app.get('/seasons/:seasonId/games',
  { preHandler: [requireRole(...ALL_INTERNAL)] },
  async (request) => { ... }
);
```

**Routes that NEED `requireRole()` added (Sprint 3 work):**

| Module | Route | Current State | Target Roles |
|--------|-------|---------------|--------------|
| games | POST/PATCH/DELETE | auth only | ADMIN, AD, COACH |
| games | GET | auth only | ADMIN, AD, COACH, PARENT, ATHLETE |
| practices | POST/PATCH/DELETE | auth only | ADMIN, AD, COACH |
| practices | GET | auth only | ADMIN, AD, COACH, PARENT, ATHLETE |
| conflicts | POST override | auth only | ADMIN, AD, COACH |
| conflicts | GET | auth only | ALL_INTERNAL |
| events | GET | auth only | ALL_INTERNAL |
| seasons | POST/PATCH/DELETE | auth only | ADMIN, AD, COACH |
| seasons | GET | auth only | ALL_INTERNAL |
| shares | POST/DELETE | auth only | ADMIN, AD, COACH |
| import | POST | auth only | ADMIN, AD |

**Routes that ALREADY have `requireRole()` but need review:**

| Module | Route | Current Roles | Target Roles | Change Needed |
|--------|-------|--------------|--------------|---------------|
| facilities | POST only | ADMIN | ADMIN, AD | Add AD to create; add requireRole to PATCH/DELETE |
| facilities | GET | none | ALL_INTERNAL | Add requireRole to read routes |
| teams | POST only | ADMIN, COACH | ADMIN, AD | Change COACH to AD; add requireRole to PATCH/DELETE/GET |
| blockers | POST/PATCH/DELETE | ADMIN, COACH | ADMIN, AD, COACH | Add AD to mutations |
| schools | PATCH/DELETE | ADMIN | ADMIN, AD | Add AD |
| invites | POST/GET/DELETE | ADMIN | ADMIN, AD | Add AD |

**Audit Logging:**

```typescript
// Add to auth.ts - called when requireRole rejects
function logPermissionDenied(userId: string, role: string, route: string, method: string) {
  console.warn(`[PERMISSION_DENIED] user=${userId} role=${role} ${method} ${route}`);
  // Future: write to audit table
}
```

---

### F2: Enhanced Conflict Detection

#### POST /api/v1/schools/:schoolId/check-conflicts

Full conflict check across all types.

**Auth:** Authenticated + `requireRole(ADMIN, AD, COACH)`

**Request:**
```typescript
const checkConflictsSchema = z.object({
  eventId: z.string().optional(),             // check conflicts for a specific event
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }).optional(),
  types: z.array(z.enum(['blocker', 'facility', 'person', 'resource']))
    .optional()
    .default(['blocker', 'facility']),
    // NOTE: 'person' and 'resource' deferred to Sprint 4 (requires roster/resource models)
    // Sprint 3 implements 'blocker' + 'facility' only
});
```

**Response:**
```typescript
interface CheckConflictsResponse {
  data: {
    conflicts: TypedConflict[];
    summary: {
      total: number;
      byType: Record<ConflictType, number>;
      bySeverity: Record<ConflictSeverity, number>;
    };
  };
}

interface TypedConflict {
  type: 'BLOCKER' | 'FACILITY' | 'PERSON' | 'RESOURCE';
  severity: 'ERROR' | 'WARNING';
  eventA: { id: string; type: EventType; name: string; datetime: string; facilityName?: string };
  eventB?: { id: string; type: EventType; name: string; datetime: string; facilityName?: string }; // null for blocker conflicts
  blocker?: { id: string; name: string; type: BlockerType };  // only for blocker conflicts
  person?: { id: string; name: string };                       // only for person conflicts
  resource?: { id: string; name: string; type: string };       // only for resource conflicts
  overlapMinutes: number;
  suggestion?: ConflictSuggestion;
}
```

**Error Responses:**
- 400: Invalid date range or event ID
- 403: Insufficient permissions
- 404: School not found

#### POST /api/v1/schools/:schoolId/suggest-slots

Return available alternative slots for a conflicting event.

**Auth:** Authenticated + `requireRole(ADMIN, AD, COACH)`

**Request:**
```typescript
const suggestSlotsSchema = z.object({
  facilityId: z.string(),
  date: z.string(),                           // ISO date
  durationMinutes: z.number().min(15).max(480),
  preferredTime: z.string().optional(),       // "HH:MM"
});
```

**Response:**
```typescript
interface SuggestSlotsResponse {
  data: {
    slots: ScoredSlot[];
  };
}

interface ScoredSlot {
  startTime: string;      // "HH:MM"
  endTime: string;        // "HH:MM"
  date: string;           // ISO date
  score: number;          // 0-100 (higher = better fit)
  conflictCount: number;  // existing conflicts in this slot
  reasons: string[];      // ["Closest to preferred time", "Same day"]
}
```

#### Modified: GET /api/v1/schools/:schoolId/conflicts

Add `types` query parameter to existing endpoint.

```typescript
// Extend existing conflictsListQueryWithSuggestionsSchema
const conflictsListQuerySchema = z.object({
  // ... existing fields (page, limit, includeSuggestions) ...
  types: z.string().optional().default('blocker'),
  // Sprint 3 accepts: 'blocker', 'facility', 'all'
  // Sprint 4 will add: 'person', 'resource'
  // Comma-separated for multiple: 'blocker,facility'
});
```

---

### F3: Notification System

#### GET /api/v1/notifications/preferences

Get current user's notification preferences.

**Auth:** Authenticated (any role). NOTE: This route has no `:schoolId` param, so `requireRole()` would silently pass (see T-001 fix). Use `authenticate` middleware only -- user-scoped, not school-scoped.

**Response:**
```typescript
interface NotificationPreferencesResponse {
  data: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    digestMode: boolean;
    digestTime: string;
  };
}
```

#### PUT /api/v1/notifications/preferences

Update notification preferences.

**Auth:** Authenticated (any role)

**Request:**
```typescript
const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  digestMode: z.boolean().optional(),
  digestTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  phone: z.string().min(10).max(15).optional(),   // update phone number alongside prefs
});
```

**Response:**
```typescript
{ data: NotificationPreference }
```

#### GET /api/v1/schools/:schoolId/notifications

Admin notification log.

**Auth:** `requireRole(ADMIN, AD)`

**Request (query):**
```typescript
const notificationLogSchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(50),
  channel: z.enum(['EMAIL', 'SMS']).optional(),
  status: z.enum(['QUEUED', 'SENT', 'FAILED']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
```

**Response:**
```typescript
interface NotificationLogResponse {
  data: Array<{
    id: string;
    userId: string;
    userName: string | null;
    userEmail: string;
    channel: NotificationChannel;
    trigger: NotificationTrigger;
    status: NotificationStatus;
    subject: string;
    sentAt: string | null;
    failReason: string | null;
    createdAt: string;
  }>;
  meta: { total: number; page: number; limit: number };
}
```

#### POST /api/v1/schools/:schoolId/notifications/test

Send a test notification to the current user.

**Auth:** Authenticated (any role)

**Request:**
```typescript
const testNotificationSchema = z.object({
  channel: z.enum(['email', 'sms']),
});
```

**Response:**
```typescript
{ data: { sent: boolean; channel: string; message: string } }
```

**Rate Limit:** 5 requests per hour per user.

**Error Responses:**
- 400: Invalid channel
- 429: Rate limit exceeded (5/hour)
- 422: SMS requested but no phone number on file

#### Notification Service (Internal)

```typescript
// backend/src/modules/notifications/service.ts

interface EmitPayload {
  trigger: NotificationTrigger;
  schoolId: string;
  eventType?: EventType;
  eventId?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  metadata?: Record<string, unknown>;
}

export const notificationService = {
  async emit(payload: EmitPayload): Promise<void> {
    // 1. Resolve recipients based on trigger type
    const recipients = await this.resolveRecipients(payload);

    // 2. For each recipient, check preferences and dispatch
    for (const recipient of recipients) {
      const prefs = await this.getPreferences(recipient.userId);

      if (prefs.emailEnabled) {
        await this.dispatch(recipient, 'EMAIL', payload, prefs);
      }
      if (prefs.smsEnabled && recipient.phone) {
        await this.dispatch(recipient, 'SMS', payload, prefs);
      }
    }
  },

  async dispatch(
    recipient: Recipient,
    channel: NotificationChannel,
    payload: EmitPayload,
    prefs: NotificationPreference
  ): Promise<void> {
    const isUrgent = payload.trigger === 'WEATHER_EMERGENCY';
    const inQuietHours = this.isQuietHours(prefs);

    if (inQuietHours && !isUrgent) {
      await this.queue(recipient, channel, payload, 'QUEUED');
      return;
    }

    if (prefs.digestMode && !isUrgent) {
      await this.queue(recipient, channel, payload, 'QUEUED_DIGEST');
      return;
    }

    // Send immediately
    await this.send(recipient, channel, payload);
  },

  async send(recipient: Recipient, channel: NotificationChannel, payload: EmitPayload): Promise<void> {
    const { subject, body } = this.buildMessage(channel, payload);

    try {
      if (channel === 'EMAIL') {
        await resend.emails.send({
          from: 'notifications@athleticos.co',
          to: recipient.email,
          subject,
          html: body,
        });
      } else {
        // Resend SMS API
        await resend.sms.send({
          to: recipient.phone!,
          body: this.truncateSms(body),  // 160 char limit
        });
      }
      await this.recordNotification(recipient, channel, payload, 'SENT');
    } catch (error) {
      // Retry once
      if (/* first attempt */) {
        setTimeout(() => this.send(recipient, channel, payload), channel === 'SMS' ? 30000 : 60000);
      } else {
        await this.recordNotification(recipient, channel, payload, 'FAILED', String(error));
      }
    }
  },

  // SMS format: [AthleticOS] {team} {type} {action} to {day} {time} @ {facility}. View: {link} Opt out: {link}
  buildSmsBody(payload: EmitPayload): string {
    // Max 160 chars single segment
    // Truncate facility name if needed
  },
};
```

---

### F4: Weekly Board Grid

No new backend endpoints required. The frontend consumes the existing:

- `GET /api/v1/schools/:schoolId/events/upcoming?from=&to=` -- extend to support full week ranges

**Modification to events module:**

```typescript
// events/schemas.ts - extend date range to accept full week
const upcomingEventsSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});
// No change needed - already supports arbitrary date ranges
```

The weekly board fetches events for the displayed week: `?from=2026-03-09&to=2026-03-15`.

---

### F5: Personal Calendar Feeds

#### POST /api/v1/calendar-feeds

Create a calendar feed.

**Auth:** Authenticated (any internal role)

**Request:**
```typescript
const createFeedSchema = z.object({
  type: z.enum(['TEAM', 'USER']),
  teamId: z.string().optional(),  // required when type=TEAM
});
```

**Response:**
```typescript
interface CreateFeedResponse {
  data: {
    id: string;
    type: CalendarFeedType;
    teamId: string | null;
    token: string;
    url: string;                    // https://api.athleticos.co/cal/{token}.ics
    isActive: boolean;
    createdAt: string;
  };
}
```

**Error Responses:**
- 400: TEAM type without teamId
- 403: User not a member of the team's school

#### GET /api/v1/calendar-feeds

List current user's feeds.

**Auth:** Authenticated (any internal role)

**Response:**
```typescript
{
  data: Array<{
    id: string;
    type: CalendarFeedType;
    teamId: string | null;
    teamName: string | null;
    token: string;
    url: string;
    isActive: boolean;
    lastAccessed: string | null;
    createdAt: string;
  }>;
}
```

#### DELETE /api/v1/calendar-feeds/:id

Deactivate a feed (soft delete -- sets `isActive = false`).

**Auth:** Authenticated (owner only)

**Response:** 204 No Content

#### GET /cal/:token.ics

Public iCal feed endpoint. No authentication required.

**Response:** `Content-Type: text/calendar; charset=utf-8`

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//AthleticOS//Calendar Feed//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:{Feed Name}
BEGIN:VEVENT
UID:{event.id}@athleticos.co
DTSTART:{datetime in school timezone}
DTEND:{end datetime}
SUMMARY:{Type}: {Team} vs {Opponent} | {Team} Practice
LOCATION:{Facility name}
DESCRIPTION:{Notes, conflict status}
END:VEVENT
...
END:VCALENDAR
```

**Error Responses:**
- 404: Token not found or feed deactivated

**Implementation:** Reuse `generateICS()` logic from the existing shares module. Extend it to accept a team ID or user ID to resolve events.

---

### F6: Quick-Add Event Parsing

#### POST /api/v1/schools/:schoolId/quick-add

Parse natural language text into event data. Does NOT save -- returns a preview.

**Auth:** `requireRole(ADMIN, AD, COACH)`

**Request:**
```typescript
const quickAddSchema = z.object({
  text: z.string().min(3).max(200),
  weekStartDate: z.string(),                 // ISO date of current week start
  seasonId: z.string().optional(),           // context: which season
});
```

**Response:**
```typescript
interface QuickAddResponse {
  data: {
    parsed: {
      eventType: 'GAME' | 'PRACTICE';
      dayOfWeek: number | null;              // 0-6
      date: string | null;                   // resolved ISO date
      startTime: string | null;              // "HH:MM"
      endTime: string | null;
      durationMinutes: number | null;
      facilityId: string | null;
      facilityName: string | null;
      facilityMatches: Array<{ id: string; name: string; score: number }>;  // for ambiguous
      teamId: string | null;
      teamName: string | null;
      teamMatches: Array<{ id: string; name: string; score: number }>;
      opponent: string | null;
    };
    confidence: number;                      // 0-1
    conflicts: TypedConflict[];
    missingFields: string[];                 // ["facility", "team"] if unresolved
  };
}
```

**Parsing Logic (server-side):**

```typescript
// backend/src/modules/quick-add/parser.ts

export function parseQuickAdd(text: string, context: ParseContext): ParseResult {
  const tokens = tokenize(text);

  return {
    dayOfWeek: extractDayOfWeek(tokens),       // Mon/Tue/Wed/etc
    timeRange: extractTimeRange(tokens),         // "3:30-5pm"
    facility: fuzzyMatchFacility(tokens, context.facilities),
    team: fuzzyMatchTeam(tokens, context.teams),
    opponent: extractOpponent(tokens),           // "vs Oakridge"
    eventType: tokens.some(t => t.match(/^vs$/i)) ? 'GAME' : 'PRACTICE',
  };
}

function fuzzyMatchFacility(tokens: string[], facilities: Facility[]): FuzzyMatch {
  // Substring match first, then Levenshtein distance <= 3
  // Return ranked matches
}
```

---

### F7: Bulk Operations

#### POST /api/v1/schools/:schoolId/bulk-move

Shift events in a date range by a time offset.

**Auth:** `requireRole(ADMIN, AD)`

**Request:**
```typescript
const bulkMoveSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  offsetMinutes: z.number().min(-10080).max(10080),  // +/- 1 week
  teamId: z.string().optional(),
  eventType: z.enum(['GAME', 'PRACTICE']).optional(),
  dryRun: z.boolean().default(true),
});
```

**Response:**
```typescript
interface BulkMoveResponse {
  data: {
    affected: Array<{
      id: string;
      type: EventType;
      name: string;
      before: { datetime: string };
      after: { datetime: string };
    }>;
    conflictsCreated: TypedConflict[];
    totalAffected: number;
    applied: boolean;                          // false if dryRun
  };
}
```

#### POST /api/v1/schools/:schoolId/rain-plan

Move outdoor events to indoor fallback facilities.

**Auth:** `requireRole(ADMIN, AD)`

**Request:**
```typescript
const rainPlanSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  dryRun: z.boolean().default(true),
});
```

**Response:**
```typescript
interface RainPlanResponse {
  data: {
    moves: Array<{
      eventId: string;
      eventType: EventType;
      eventName: string;
      fromFacility: { id: string; name: string; type: FacilityType };
      toFacility: { id: string; name: string; type: FacilityType } | null;  // null if no fallback
      conflicts: TypedConflict[];
    }>;
    skipped: Array<{
      eventId: string;
      reason: string;   // "No rain fallback configured for Field B"
    }>;
    totalMoved: number;
    totalSkipped: number;
    applied: boolean;
  };
}
```

#### POST /api/v1/schools/:schoolId/conflicts/auto-resolve

Apply priority-based suggestions in bulk.

**Auth:** `requireRole(ADMIN, AD)`

**Request:**
```typescript
const autoResolveSchema = z.object({
  confidenceThreshold: z.enum(['high', 'medium']),
  scope: z.object({
    facilityId: z.string().optional(),
    teamId: z.string().optional(),
  }).optional(),
  dryRun: z.boolean().default(true),
});
```

**Response:**
```typescript
interface AutoResolveResponse {
  data: {
    resolved: Array<{
      conflictId: string;
      action: string;
      suggestion: ConflictSuggestion;
    }>;
    skipped: Array<{
      conflictId: string;
      reason: string;   // "Confidence below threshold", "Manual review needed"
    }>;
    errors: Array<{
      conflictId: string;
      error: string;
    }>;
    totalResolved: number;
    totalSkipped: number;
    applied: boolean;
  };
}
```

---

### F8: Print-Friendly Week View

No backend changes. Pure CSS `@media print` implementation in the frontend.

---

### F9: Facility Request & Approval Workflow

#### POST /api/v1/schools/:schoolId/facility-requests

Submit a facility request.

**Auth:** `requireRole(ADMIN, AD, COACH, COMMUNITY)` -- COMMUNITY can only create requests of type COMMUNITY. NOTE: COMMUNITY role value requires T-013 enum migration to exist first.

**Request:**
```typescript
const createFacilityRequestSchema = z.object({
  facilityId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  recurrence: z.object({
    pattern: z.enum(['weekly']),
    days: z.array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])),
    seasonId: z.string().optional(),
  }).optional(),
});
```

**Response:**
```typescript
interface CreateFacilityRequestResponse {
  data: FacilityRequest & {
    conflicts: TypedConflict[];       // pre-checked conflicts
    generatedDates: string[];          // for recurring requests
  };
}
```

#### GET /api/v1/schools/:schoolId/facility-requests

List facility requests. COMMUNITY users see only their own requests.

**Auth:** `requireRole(ADMIN, AD, COACH, COMMUNITY)`

**Request (query):**
```typescript
const listRequestsSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'DENIED', 'CANCELLED']).optional(),
  facilityId: z.string().optional(),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(20),
});
```

**Response:**
```typescript
{
  data: Array<FacilityRequest & {
    facility: { id: string; name: string; type: FacilityType };
    requesterName: string | null;
    requesterEmail: string;
  }>;
  meta: { total: number; page: number; limit: number };
}
```

#### PATCH /api/v1/schools/:schoolId/facility-requests/:id

Approve or deny a request. On approval of recurring requests, generate practice instances.

**Auth:** `requireRole(ADMIN, AD)`

**Request:**
```typescript
const updateRequestSchema = z.object({
  status: z.enum(['APPROVED', 'DENIED', 'CANCELLED']),
  reviewNotes: z.string().max(2000).optional(),
});
```

**Response:**
```typescript
{
  data: FacilityRequest;
  meta: {
    eventsCreated: number;           // for approved recurring requests
  };
}
```

#### GET /api/v1/schools/:schoolId/facilities/:id/availability

Facility availability calendar showing booked and open slots.

**Auth:** `requireRole(ADMIN, AD, COACH)`

**Request (query):**
```typescript
const availabilitySchema = z.object({
  from: z.string(),                   // ISO date
  to: z.string(),                     // ISO date
});
```

**Response:**
```typescript
{
  data: {
    facility: { id: string; name: string; type: FacilityType };
    slots: Array<{
      date: string;
      startTime: string;
      endTime: string;
      status: 'booked' | 'pending' | 'open';
      event?: { id: string; type: EventType; teamName: string };
      request?: { id: string; title: string; requesterName: string };
    }>;
  };
}
```

#### POST /api/v1/auth/community-register

Create a lightweight community account.

**Auth:** None (public endpoint)

**Request:**
```typescript
const communityRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  phone: z.string().optional(),
  schoolId: z.string(),                // which school they're requesting from
});
```

**Response:**
```typescript
{
  data: {
    user: { id: string; email: string; name: string };
    accessToken: string;
  };
}
```

This creates a User, a SchoolUser with role COMMUNITY, and returns a JWT.

---

### F10: Event Setup & Teardown Checklists

#### POST /api/v1/schools/:schoolId/operations-templates

Create an operations template.

**Auth:** `requireRole(ADMIN, AD)`

**Request:**
```typescript
const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  sport: z.string().optional(),
  eventType: z.enum(['HOME_GAME', 'AWAY_GAME', 'PRACTICE']),
  tasks: z.array(z.object({
    name: z.string(),
    category: z.string(),                    // "Setup", "Teardown", "Pre-Game", "Post-Game"
    defaultLeadTimeDays: z.number().min(0).max(30).default(1),
  })).min(1),
});
```

**Response:**
```typescript
{ data: OperationsTemplate }
```

#### GET /api/v1/schools/:schoolId/operations-templates

List templates for a school.

**Auth:** `requireRole(ADMIN, AD, COACH)`

**Response:**
```typescript
{ data: OperationsTemplate[] }
```

#### GET /api/v1/schools/:schoolId/events/:eventId/checklist

Get the checklist for an event. Auto-creates from template if none exists and event is a home game.

**Auth:** `requireRole(ADMIN, AD, COACH)`

**Response:**
```typescript
{
  data: {
    id: string;
    templateId: string | null;
    tasks: Array<{
      name: string;
      category: string;
      status: ChecklistItemStatus;
      assigneeId: string | null;
      assigneeName: string | null;
      dueDate: string | null;
    }>;
    completionPercent: number;
    createdAt: string;
    updatedAt: string;
  };
}
```

#### PATCH /api/v1/schools/:schoolId/events/:eventId/checklist

Update checklist task statuses.

**Auth:** `requireRole(ADMIN, AD, COACH)`

**Request:**
```typescript
const updateChecklistSchema = z.object({
  tasks: z.array(z.object({
    index: z.number(),                        // task array index
    status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'NOT_APPLICABLE']).optional(),
    assigneeId: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
  })),
});
```

**Response:**
```typescript
{ data: EventChecklist }
```

#### GET /api/v1/schools/:schoolId/operations-readiness

Operations readiness dashboard showing completion % per upcoming event.

**Auth:** `requireRole(ADMIN, AD)`

**Request (query):**
```typescript
const readinessSchema = z.object({
  days: z.coerce.number().optional().default(7),   // look ahead days
});
```

**Response:**
```typescript
{
  data: Array<{
    eventId: string;
    eventType: EventType;
    eventName: string;
    datetime: string;
    facilityName: string;
    checklist: {
      total: number;
      completed: number;
      percent: number;
      overdueTasks: Array<{ name: string; dueDate: string }>;
    } | null;                                       // null if no template applies
  }>;
}
```

---

### F11: Recurring Event Patterns

#### POST /api/v1/schools/:schoolId/practices/recurring

Create a recurring practice series.

**Auth:** `requireRole(ADMIN, AD, COACH)`

**Request:**
```typescript
const createRecurringSchema = z.object({
  seasonId: z.string(),
  facilityId: z.string().optional(),
  days: z.array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])).min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),    // "15:30"
  endTime: z.string().regex(/^\d{2}:\d{2}$/),      // "17:00"
  notes: z.string().optional(),
  excludeBlockers: z.boolean().default(true),
  dryRun: z.boolean().default(true),
});
```

**Response:**
```typescript
interface RecurringResponse {
  data: {
    recurrenceGroupId: string;
    generated: Array<{
      date: string;
      dayOfWeek: string;
      datetime: string;
      conflicts: TypedConflict[];
      excluded: boolean;              // true if auto-excluded due to blocker
      excludeReason: string | null;   // "Exam Week (Dec 15-19)"
    }>;
    totalGenerated: number;
    totalExcluded: number;
    totalWithConflicts: number;
    applied: boolean;                 // false if dryRun
  };
}
```

**Logic:**
1. Get season date range (startDate to endDate)
2. Generate all dates matching the selected days of week
3. For each date, create a datetime from date + startTime
4. If `excludeBlockers`, check each date against school-wide and team-specific blockers; mark excluded dates
5. If `dryRun`, return preview without saving
6. If not dryRun, create Practice records with shared `recurrenceGroupId` (cuid)

#### PATCH /api/v1/schools/:schoolId/practices/recurring/:groupId

Modify all remaining (future) practices in a series.

**Auth:** `requireRole(ADMIN, AD, COACH)`

**Request:**
```typescript
const updateRecurringSchema = z.object({
  facilityId: z.string().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes: z.string().optional(),
});
```

**Response:**
```typescript
{
  data: {
    updated: number;           // count of future practices updated
    conflicts: TypedConflict[];
  };
}
```

Only updates practices where `datetime > now()` and `recurrenceGroupId = groupId`.

#### DELETE /api/v1/schools/:schoolId/practices/recurring/:groupId

Cancel all remaining (future) practices in a series.

**Auth:** `requireRole(ADMIN, AD, COACH)`

**Response:**
```typescript
{ data: { deleted: number } }
```

Only deletes practices where `datetime > now()` and `recurrenceGroupId = groupId`.

---

## 5. Frontend Architecture

### Existing Structure (main branch, verified)

The frontend follows these conventions established in Sprints 1-2:

```
frontend/src/
  api/               -- API client functions (one file per resource)
    blockers.ts, client.ts, conflicts.ts, events.ts, facilities.ts,
    games.ts, import.ts, invites.ts, practices.ts, priorityRules.ts,
    schools.ts, seasons.ts, shares.ts, teams.ts
  components/        -- Shared components + module-specific folders
    blockers/        -- Blocker-specific components
    conflicts/       -- ConflictRow, ConflictDetailPanel, etc.
    dashboard/       -- Dashboard-specific components (hero, stat blocks, etc.)
    priority-rules/  -- Priority rule components
    CalendarTab.tsx, GamesTab.tsx, PracticesTab.tsx, FacilitiesTab.tsx, etc.
    Layout.tsx, Sidebar.tsx, Modal.tsx, Tabs.tsx
    Create*.tsx, Edit*.tsx modals
  hooks/             -- Custom React hooks
    useAuth.tsx, useBlockers.ts, useConflicts.ts, useEvents.ts,
    useInvites.ts, usePriorityRules.ts
  pages/             -- Route-level pages
    Dashboard.tsx, SchoolDetail.tsx, SeasonDetail.tsx,
    ConflictsPage.tsx, BlockersPage.tsx, PriorityRulesPage.tsx,
    Login.tsx, Register.tsx, AcceptInvitePage.tsx,
    PublicSchedulePage.tsx, PublicScheduleEmbed.tsx
  utils/
  App.tsx, main.tsx
```

**Conventions for Sprint 3 new code:**
- New pages go in `pages/` (e.g., `pages/WeeklyBoardPage.tsx`)
- New component folders go in `components/` (e.g., `components/weekly-board/`)
- New API client functions go in `api/` (e.g., `api/notifications.ts`, `api/calendarFeeds.ts`)
- New hooks go in `hooks/` (e.g., `hooks/useWeeklyEvents.ts`, `hooks/useNotificationPrefs.ts`)

### New Pages & Components Tree

```
frontend/src/
  pages/                            -- NEW pages
    WeeklyBoardPage.tsx          (F4) -- top-level page
    NotificationPrefsPage.tsx    (F3) -- user settings
    CalendarFeedsPage.tsx        (F5) -- user settings
    FacilityRequestsPage.tsx     (F9) -- school-scoped
    FacilityAvailabilityPage.tsx (F9) -- per-facility
    OperationsReadinessPage.tsx  (F10) -- school-scoped
    CommunityPortalPage.tsx      (F9) -- community users
    SmsOptOutPage.tsx            (F3) -- public page

  api/                              -- NEW API clients
    notifications.ts             -- getPreferences, updatePreferences, getLog, sendTest
    calendarFeeds.ts             -- create, list, deactivate
    facilityRequests.ts          -- create, list, update (approve/deny), getAvailability
    operations.ts                -- templates CRUD, checklists, readiness
    recurring.ts                 -- create, update, delete series
    quickAdd.ts                  -- parse text
    bulkOps.ts                   -- bulkMove, rainPlan, autoResolve

  hooks/                            -- NEW hooks
    useWeeklyEvents.ts           (F4) -- events for week range
    useNotificationPrefs.ts      (F3) -- notification preferences
    useCalendarFeeds.ts          (F5) -- feed CRUD
    useFacilityRequests.ts       (F9) -- request queue
    useOperations.ts             (F10) -- templates + checklists
    useRecurring.ts              (F11) -- recurring series

  components/
    weekly-board/                   -- NEW folder
      WeeklyGrid.tsx             -- CSS Grid: 7 cols x 30 rows
      EventCard.tsx              -- Positioned card with color coding
      SlotPopover.tsx            -- Quick-create on empty cell click
      InlineEventEditor.tsx      -- Click-to-edit event fields
      WeekNavigation.tsx         -- Prev / Next / Today + date picker
      GridFilters.tsx            -- Team, facility, type dropdowns
      QuickAddBar.tsx            (F6) -- text input with preview
      QuickAddPreview.tsx        (F6) -- parsed result card
      BulkMoveDialog.tsx         (F7) -- shift week modal
      RainPlanDialog.tsx         (F7) -- rain plan modal
      AutoResolveDialog.tsx      (F7) -- auto-resolve modal
      PrintWeekView.tsx          (F8) -- print-optimized table

    notifications/                  -- NEW folder
      NotificationPrefsForm.tsx  -- email/SMS/quiet hours/digest
      NotificationLog.tsx        -- admin log table
      TestNotificationBtn.tsx    -- send test button

    calendar-feeds/                 -- NEW folder
      FeedList.tsx               -- active feeds table
      FeedGenerator.tsx          -- create feed dialog

    facility-requests/              -- NEW folder
      FacilityRequestForm.tsx    -- submit request form
      RequestQueue.tsx           -- pending requests table
      RequestDetailPanel.tsx     -- review detail + approve/deny
      AvailabilityCalendar.tsx   -- visual slot grid

    operations/                     -- NEW folder
      TemplateEditor.tsx         -- create/edit template
      EventChecklistPanel.tsx    -- task list with status toggles
      ReadinessGrid.tsx          -- completion % cards

    recurring/                      -- NEW folder
      RecurrenceBuilder.tsx      -- day/time/season picker
      RecurrencePreview.tsx      -- generated dates with badges
```

### State Management Approach

All server state managed via TanStack Query. Pattern established in Sprint 1-2 continues:

```typescript
// hooks/useWeeklyEvents.ts
export function useWeeklyEvents(schoolId: string, weekStart: string) {
  const from = weekStart;
  const to = addDays(parseISO(weekStart), 6).toISOString();

  return useQuery({
    queryKey: ['events', 'weekly', schoolId, weekStart],
    queryFn: () => eventsApi.getUpcoming(schoolId, from, to),
    staleTime: 30_000,  // 30s -- events change frequently
  });
}

// hooks/useNotificationPrefs.ts
export function useNotificationPrefs() {
  return useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => notificationsApi.getPreferences(),
    staleTime: 5 * 60_000,  // 5 min
  });
}

// Mutations follow existing pattern:
export function useCreateRecurring(schoolId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRecurringInput) =>
      recurringApi.create(schoolId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['practices'] });
    },
  });
}
```

### Weekly Board Grid Implementation

The grid is built with **CSS Grid** (no external library). This matches the project's zero-external-dependency approach (Sprint 2 used CSS conic-gradient for the donut chart).

```
Grid layout:
  - display: grid
  - grid-template-columns: 60px repeat(7, 1fr)     // time col + 7 day cols
  - grid-template-rows: 40px repeat(30, 40px)       // header + 30 half-hour rows (7am-10pm)
  - Event cards use position: absolute within each day column
  - Card top = (startTime - 7:00) * pixelsPerMinute
  - Card height = durationMinutes * pixelsPerMinute
```

**Drag-and-drop** (optional enhancement): If implemented, use HTML5 Drag and Drop API with `draggable` attribute on EventCard. No library needed for the simple snap-to-slot behavior. Deferred if it adds complexity.

### Mobile Responsive Strategy

```
Desktop (>=1024px):
  Full 7-column grid
  All toolbars visible
  Inline editing

Tablet (768-1023px):
  Grid with narrower columns
  Abbreviated event text (initials, short facility names)
  Toolbar collapses to icon buttons

Mobile (<768px):
  NO grid -- falls back to existing CalendarTab list view
  Sticky date selector at top (swipe between days)
  Floating action button for quick-create
  Bottom nav: Schedule | Conflicts | Requests
  Print button hidden
```

**CSS approach:** Tailwind responsive prefixes (`lg:`, `md:`) with a conditional render:

```tsx
function ScheduleView({ schoolId, weekStart }: Props) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  return isDesktop
    ? <WeeklyGrid schoolId={schoolId} weekStart={weekStart} />
    : <CalendarTab seasonId={currentSeasonId} schoolId={schoolId} />;
}
```

---

## 6. Master Task List

### Phase 1: F1 (Permissions) + F5 (Calendar Feeds)

Foundation: security enforcement and immediate parent value.

| ID | Task | Feature | Dependencies | Status |
|----|------|---------|-------------|--------|
| T-001 | Define role constants (STAFF, MANAGEMENT, ALL_INTERNAL) in `auth.ts`; fix `requireRole()` to throw error when schoolId is missing instead of silently returning | F1 | -- | |
| T-002 | Add `requireRole()` to game routes (POST/PATCH/DELETE = STAFF, GET = ALL_INTERNAL) -- currently auth-only | F1 | T-001 | |
| T-003 | Add `requireRole()` to practice routes -- currently auth-only | F1 | T-001 | |
| T-004 | Fix facility routes: currently POST = ADMIN only; add AD to mutations, add requireRole to PATCH/DELETE/GET | F1 | T-001 | |
| T-005 | Fix team routes: currently POST = ADMIN+COACH; change to MANAGEMENT for mutations, add requireRole to PATCH/DELETE/GET | F1 | T-001 | |
| T-006 | Add `requireRole()` to season routes -- currently auth-only (mutations = STAFF, reads = ALL_INTERNAL) | F1 | T-001 | |
| T-007 | Fix invite routes: currently POST/list/revoke = ADMIN only; add AD | F1 | T-001 | |
| T-008 | Review priority-rules routes: currently mixed (GET=ALL, POST/PATCH=ADMIN/COACH, DELETE=ADMIN); adjust to MANAGEMENT for mutations | F1 | T-001 | |
| T-009 | Add `requireRole()` to share routes -- currently auth-only (mutations = STAFF) | F1 | T-001 | |
| T-010 | Add `requireRole()` to conflict routes -- currently auth-only (override POST = STAFF, reads = ALL_INTERNAL) | F1 | T-001 | |
| T-010b | Add `requireRole()` to events routes -- currently auth-only (reads = ALL_INTERNAL) | F1 | T-001 | |
| T-010c | Add `requireRole()` to import routes -- currently auth-only (POST = MANAGEMENT) | F1 | T-001 | |
| T-010d | Fix blocker routes: currently POST/PATCH/DELETE = ADMIN+COACH; add AD to mutations | F1 | T-001 | |
| T-010e | Fix school routes: currently PATCH/DELETE = ADMIN only; add AD | F1 | T-001 | |
| T-011 | Add permission denied audit logging to `requireRole()` | F1 | T-001 | |
| T-012 | Verify all existing demo workflows with ADMIN role user (login: burke@athleticos.dev) | F1 | T-002 to T-010e | |
| T-013 | Prisma migration 1: add COMMUNITY to Role enum + all new enums (separate migration, no DDL/DML referencing new values) | F1,F5 | -- | |
| T-013b | Prisma migration 2: add `phone` column to users table | F3 | T-013 | |
| T-014 | Prisma migration 3: create all new tables (calendar_feeds, notifications, notification_preferences, facility_requests, operations_templates, event_checklists) + add rain_fallback_id/recurrence_group_id to existing tables | F5,F3,F9,F10,F11 | T-013 | |
| T-015 | Backend: create `calendar-feeds` module (schemas.ts, service.ts, routes.ts) | F5 | T-014 | |
| T-016 | Backend: implement CalendarFeed CRUD (create, list, deactivate) | F5 | T-015 | |
| T-017 | Backend: implement `GET /cal/:token.ics` public endpoint with iCal generation | F5 | T-015 | |
| T-018 | Backend: reuse/extend `generateICS()` from shares module for feed generation | F5 | T-017 | |
| T-019 | Frontend: create CalendarFeedsPage with FeedList and FeedGenerator components | F5 | T-016 | |
| T-020 | Frontend: add "Calendar Feeds" link to user settings/sidebar | F5 | T-019 | |
| T-021 | Frontend: copy-to-clipboard for feed URL with success toast | F5 | T-019 | |

### Phase 2: F2 (Enhanced Conflicts) + F8 (Print View)

Trust: catch all conflict types. Print for paper-workflow coaches.

| ID | Task | Feature | Dependencies | Status |
|----|------|---------|-------------|--------|
| T-022 | Backend: add facility double-booking detection to `conflictService` | F2 | -- | |
| T-023 | Backend: add person overlap detection. NOTE: EventParticipant model is NOT in the data model section -- either add it to migrations or defer person overlap to a future sprint when roster/participant tracking exists. Recommend: defer to Sprint 4 (requires roster feature). For now, detect by team membership (if same user is coach of 2 teams with overlapping events). | F2 | -- | |
| T-024 | Backend: add resource collision detection. NOTE: EventResource model is NOT in the data model section -- either add a Resource + EventResource model to migrations, or defer. Recommend: defer to Sprint 4. Resources (buses, referees) are not yet modeled. | F2 | -- | |
| T-025 | Backend: create `TypedConflict` interface with severity and type fields | F2 | T-022 | |
| T-026 | Backend: implement `POST /check-conflicts` endpoint | F2 | T-022 to T-025 | |
| T-027 | Backend: implement `POST /suggest-slots` endpoint | F2 | T-022 | |
| T-028 | Backend: extend `GET /schools/:schoolId/conflicts` with `types` query param | F2 | T-022 to T-025 | |
| T-029 | Backend: add weather impact analysis to blocker creation | F2 | T-022 | |
| T-030 | Frontend: update conflict types/API to handle new TypedConflict shape | F2 | T-025 | |
| T-031 | Frontend: update ConflictRow and ConflictDetailPanel for severity badges | F2 | T-030 | |
| T-032 | Frontend: add conflict type filter (blocker/facility/person/resource/all) to ConflictsPage | F2 | T-030 | |
| T-033 | Frontend: display suggested slots in ConflictDetailPanel | F2 | T-027 | |
| T-034 | Frontend: create PrintWeekView component with `@media print` styles | F8 | -- | |
| T-035 | Frontend: add Print button to weekly board toolbar | F8 | T-034 | |
| T-036 | Frontend: add Print button to SeasonDetail page | F8 | T-034 | |
| T-037 | Frontend: print layout - landscape, hide nav/sidebar/buttons, clean table | F8 | T-034 | |
| T-038 | Frontend: print header (school, team, week dates) and footer (timestamp, feed URL) | F8 | T-034 | |

### Phase 3: F3 (Notifications)

Intelligence: changes reach the right people automatically.

| ID | Task | Feature | Dependencies | Status |
|----|------|---------|-------------|--------|
| T-039 | (Covered by T-013) Notification enums are created in the shared Phase 1 enum migration | F3 | T-013 | |
| T-040 | (Covered by T-014) Notification tables are created in the shared Phase 1 table migration | F3 | T-014 | |
| T-041 | Backend: create `notifications` module (schemas.ts, service.ts, routes.ts) | F3 | T-014 | |
| T-042 | Backend: implement `notificationService.emit()` -- recipient resolution + preference check | F3 | T-041 | |
| T-043 | Backend: implement email delivery via Resend (extend existing integration) | F3 | T-042 | |
| T-044 | Backend: implement SMS delivery via Resend SMS API | F3 | T-042 | |
| T-045 | Backend: implement quiet hours queueing logic | F3 | T-042 | |
| T-046 | Backend: implement digest mode batching | F3 | T-042 | |
| T-047 | Backend: implement retry logic (1 retry, then mark FAILED) | F3 | T-043, T-044 | |
| T-048 | Backend: implement `GET /notifications/preferences` endpoint | F3 | T-041 | |
| T-049 | Backend: implement `PUT /notifications/preferences` endpoint | F3 | T-041 | |
| T-050 | Backend: implement `GET /schools/:schoolId/notifications` (admin log) | F3 | T-041 | |
| T-051 | Backend: implement `POST /schools/:schoolId/notifications/test` with rate limit (5/hr) | F3 | T-041 | |
| T-052 | Backend: build SMS message formatter (160 char limit, opt-out link) | F3 | T-044 | |
| T-053 | Backend: build email templates (event change, cancellation, weather, digest) | F3 | T-043 | |
| T-054 | Backend: wire `notificationService.emit()` into games routes (create/update/delete) | F3 | T-042 | |
| T-055 | Backend: wire `notificationService.emit()` into practices routes (create/update/delete) | F3 | T-042 | |
| T-056 | Backend: wire `notificationService.emit()` into blockers routes (weather trigger) | F3 | T-042 | |
| T-057 | Frontend: create NotificationPrefsPage with NotificationPrefsForm | F3 | T-048, T-049 | |
| T-058 | Frontend: create NotificationLog component for admin view | F3 | T-050 | |
| T-059 | Frontend: create TestNotificationBtn component | F3 | T-051 | |
| T-060 | Frontend: create SmsOptOutPage (public, token-validated) | F3 | T-049 | |
| T-061 | Frontend: add "Notifications" link to user settings/sidebar | F3 | T-057 | |
| T-062 | Backend: implement SMS opt-out endpoint (sets smsEnabled=false via token) | F3 | T-049 | |

### Phase 4: F11 (Recurring Events) + F4 (Weekly Board Grid)

Scheduling UX: the headline features.

| ID | Task | Feature | Dependencies | Status |
|----|------|---------|-------------|--------|
| T-063 | (Covered by T-014) recurrence_group_id added in shared Phase 1 table migration | F11 | T-014 | |
| T-064 | Backend: create `recurring` module (schemas.ts, service.ts, routes.ts) | F11 | T-014 | |
| T-065 | Backend: implement recurring date generation (season range + day-of-week) | F11 | T-064 | |
| T-066 | Backend: implement blocker exclusion for generated dates | F11 | T-065 | |
| T-067 | Backend: implement `POST /practices/recurring` with dry-run preview | F11 | T-065, T-066 | |
| T-068 | Backend: implement `PATCH /practices/recurring/:groupId` (modify remaining) | F11 | T-064 | |
| T-069 | Backend: implement `DELETE /practices/recurring/:groupId` (cancel remaining) | F11 | T-064 | |
| T-070 | Frontend: create RecurrenceBuilder component (day picker, time inputs, season selector) | F11 | T-067 | |
| T-071 | Frontend: create RecurrencePreview component (date list with conflict badges) | F11 | T-067 | |
| T-072 | Frontend: add "Create Recurring" button to practices tab/weekly board | F11 | T-070 | |
| T-073 | Frontend: add "Modify Series" / "Cancel Series" actions to practice detail | F11 | T-068, T-069 | |
| T-074 | Frontend: create WeeklyGrid component (CSS Grid, 7 cols x 30 rows) | F4 | -- | |
| T-075 | Frontend: create EventCard component (positioned, colored by type) | F4 | T-074 | |
| T-076 | Frontend: create WeekNavigation component (prev/next/today + date picker) | F4 | T-074 | |
| T-077 | Frontend: create GridFilters component (team, facility, type dropdowns) | F4 | T-074 | |
| T-078 | Frontend: create SlotPopover (click empty cell to quick-create) | F4 | T-074 | |
| T-079 | Frontend: create InlineEventEditor (click event to edit fields) | F4 | T-075 | |
| T-080 | Frontend: add conflict badges to EventCard (red outline = error, amber = warning) | F4 | T-075, T-030 | |
| T-081 | Frontend: implement keyboard shortcuts (N, E, Delete, arrows, Escape) | F4 | T-074 | |
| T-082 | Frontend: create WeeklyBoardPage and wire to router | F4 | T-074 to T-081 | |
| T-083 | Frontend: responsive - grid on desktop/tablet, CalendarTab list on mobile | F4 | T-082 | |
| T-084 | Frontend: add "Calendar" tab link in sidebar/navigation to WeeklyBoardPage | F4 | T-082 | |

### Phase 5: F9 (Facility Requests) + F7 (Bulk Operations)

Operations: SchoolDude replacement and power-user tools.

| ID | Task | Feature | Dependencies | Status |
|----|------|---------|-------------|--------|
| T-085 | (Covered by T-013) RequestType, RequestStatus enums created in shared Phase 1 enum migration | F9 | T-013 | |
| T-086 | (Covered by T-014) facility_requests table + rain_fallback_id created in shared Phase 1 table migration | F9,F7 | T-014 | |
| T-087 | Backend: create `facility-requests` module (schemas.ts, service.ts, routes.ts) | F9 | T-014 | |
| T-088 | Backend: implement facility request CRUD with conflict pre-check | F9 | T-087 | |
| T-089 | Backend: implement approval workflow (approve -> generate events if recurring) | F9 | T-088, T-065 | |
| T-090 | Backend: implement `GET /facilities/:id/availability` endpoint | F9 | T-087 | |
| T-091 | Backend: implement `POST /auth/community-register` endpoint | F9 | T-013 | |
| T-092 | Backend: COMMUNITY role isolation (own requests only in list endpoint) | F9 | T-091 | |
| T-093 | Frontend: create FacilityRequestForm component | F9 | T-088 | |
| T-094 | Frontend: create RequestQueue component (pending requests table, approve/deny) | F9 | T-088 | |
| T-095 | Frontend: create FacilityRequestsPage and wire to router | F9 | T-093, T-094 | |
| T-096 | Frontend: create AvailabilityCalendar component | F9 | T-090 | |
| T-097 | Frontend: create FacilityAvailabilityPage | F9 | T-096 | |
| T-098 | Frontend: create CommunityPortalPage (register + request tracking) | F9 | T-091, T-092 | |
| T-099 | Backend: create `bulk-ops` module (schemas.ts, service.ts, routes.ts) | F7 | -- | |
| T-100 | Backend: implement `POST /bulk-move` (shift week) with dry-run | F7 | T-099 | |
| T-101 | Backend: implement `POST /rain-plan` with fallback lookup | F7 | T-099, T-086 | |
| T-102 | Backend: implement `POST /conflicts/auto-resolve` with confidence threshold | F7 | T-099, T-022 | |
| T-103 | Backend: wire notification triggers into bulk operations | F7 | T-100 to T-102, T-042 | |
| T-104 | Frontend: create BulkMoveDialog (date range, offset, filters, preview) | F7 | T-100 | |
| T-105 | Frontend: create RainPlanDialog (preview moves, conflicts at fallback) | F7 | T-101 | |
| T-106 | Frontend: create AutoResolveDialog (confidence threshold, scope, preview) | F7 | T-102 | |
| T-107 | Frontend: add bulk operation buttons to weekly board toolbar | F7 | T-104 to T-106 | |

### Phase 6: F10 (Event Checklists) + F6 (Quick-Add)

Operations polish and speed optimization.

| ID | Task | Feature | Dependencies | Status |
|----|------|---------|-------------|--------|
| T-108 | (Covered by T-014) operations_templates and event_checklists tables created in shared Phase 1 table migration | F10 | T-014 | |
| T-109 | Backend: create `operations` module (schemas.ts, service.ts, routes.ts) | F10 | T-014 | |
| T-110 | Backend: implement OperationsTemplate CRUD | F10 | T-109 | |
| T-111 | Backend: implement EventChecklist auto-creation from template on home game creation | F10 | T-110 | |
| T-112 | Backend: implement `GET /events/:eventId/checklist` with auto-create | F10 | T-109 | |
| T-113 | Backend: implement `PATCH /events/:eventId/checklist` (update task statuses) | F10 | T-109 | |
| T-114 | Backend: implement `GET /operations-readiness` (completion % per event) | F10 | T-109 | |
| T-115 | Frontend: create TemplateEditor component | F10 | T-110 | |
| T-116 | Frontend: create EventChecklistPanel component (task list with toggles) | F10 | T-112, T-113 | |
| T-117 | Frontend: create ReadinessGrid component (upcoming events with completion %) | F10 | T-114 | |
| T-118 | Frontend: create OperationsReadinessPage and wire to router | F10 | T-115 to T-117 | |
| T-119 | Frontend: add checklist icon/badge to EventCard on weekly board | F10 | T-112, T-075 | |
| T-120 | Backend: create `quick-add` module (schemas.ts, parser.ts, routes.ts) | F6 | -- | |
| T-121 | Backend: implement text parser (day, time, facility fuzzy match, team fuzzy match, opponent) | F6 | T-120 | |
| T-122 | Backend: implement `POST /quick-add` endpoint with conflict pre-check | F6 | T-121, T-022 | |
| T-123 | Frontend: create QuickAddBar component (text input on weekly board toolbar) | F6 | T-122 | |
| T-124 | Frontend: create QuickAddPreview component (parsed result card below input) | F6 | T-123 | |
| T-125 | Frontend: wire quick-add confirm to standard create mutation | F6 | T-124 | |
| T-126 | Frontend: handle ambiguous matches (facility/team dropdown in preview) | F6 | T-124 | |
| T-127 | Frontend: fallback to standard create modal when parsing fails | F6 | T-124 | |

### Verification & Deployment

| ID | Task | Feature | Dependencies | Status |
|----|------|---------|-------------|--------|
| T-128 | Smoke: login as each role, verify correct access/denial | F1 | T-012 | |
| T-129 | Smoke: create calendar feed, access iCal URL, verify events in output | F5 | T-017 | |
| T-130 | Smoke: trigger facility double-booking, verify detection | F2 | T-026 | |
| T-131 | Smoke: change event time, verify SMS + email sent | F3 | T-054 | |
| T-132 | Smoke: create recurring practice series, verify all instances created | F11 | T-067 | |
| T-133 | Smoke: weekly board loads events for current week | F4 | T-082 | |
| T-134 | Smoke: submit facility request, approve, verify events created | F9 | T-089 | |
| T-135 | Smoke: bulk move events, verify new times and notifications | F7 | T-100 | |
| T-136 | Smoke: rain plan moves outdoor events to fallback facilities | F7 | T-101 | |
| T-137 | Smoke: create operations template, auto-applied to new home game | F10 | T-111 | |
| T-138 | Smoke: quick-add "Tue 3:30-5pm Gym A", verify parse and create | F6 | T-122 | |
| T-139 | Smoke: print weekly view, verify clean one-page output | F8 | T-037 | |
| T-140 | WCAG AA audit on weekly board and new pages | All | T-082 | |
| T-141 | Mobile responsive testing at 375px width | All | T-083 | |
| T-142 | Run full migration on staging DB, verify no errors | All | All migrations | |
| T-143 | Deploy to Render + production smoke test | All | T-142 | |

---

## 6b. Beads (bd) Issue Tracking Workflow

All TRD tasks map to beads issues for tracking implementation progress. See `~/projects/beads/docs/BEADS_ENSEMBLE_INTEGRATION.md` for full reference.

### Epic Creation

Before any task creation, create a single epic for the entire TRD:

```bash
EPIC=$(bd create "TRD-009: Complete Athletic Operations" \
  -t epic -p 1 \
  --external-ref "TRD-009" \
  --description="docs/trd/009-complete-athletic-operations.md" -s)
```

### Issue Creation (Per Phase)

Before starting each phase, create bd issues from the task list as children of the epic, then wire up dependencies:

```bash
# Example: Create issues for Phase 1
T001=$(bd create "T-001: Define role constants + fix requireRole schoolId bypass" \
  -t task -p 1 --parent "$EPIC" \
  --labels "phase-1,permissions" \
  --external-ref "T-001" -s)

T002=$(bd create "T-002: Add requireRole to game routes" \
  -t task -p 1 --parent "$EPIC" \
  --labels "phase-1,permissions" \
  --external-ref "T-002" -s)

T003=$(bd create "T-003: Add requireRole to practice routes" \
  -t task -p 1 --parent "$EPIC" \
  --labels "phase-1,permissions" \
  --external-ref "T-003" -s)

# Wire dependencies (T-002 and T-003 depend on T-001)
bd dep add "$T002" "$T001"
bd dep add "$T003" "$T001"

# Export for dashboard
bd export -o .beads/issues.jsonl
```

### Task-to-Issue Mapping

- Each T-xxx task becomes one bd issue with `--parent "$EPIC"` and `--external-ref "T-xxx"`
- Use `--deps discovered-from:<parent>` for tasks that uncover new work during implementation
- Use `--labels` to tag phase and feature domain (e.g., `phase-1,permissions`, `phase-3,notifications`)
- Priority mapping: P0 features (F1, F2, F4) = bd priority 1; P1 (F3, F5, F7, F11) = bd priority 2; P2 (F6, F8, F9, F10) = bd priority 3

### Workflow Per Task

1. `bd ready --json` -- find next unblocked task
2. `bd update <id> --claim --json` -- claim the task atomically (prevents double-work)
3. Implement, test, verify
4. `bd close <id> --reason "Completed" --json` -- mark done
5. If new work discovered: `bd create "Found: <description>" --deps discovered-from:<parent-id> -p 1`
6. `bd export -o .beads/issues.jsonl` -- update dashboard (also auto-runs via post-commit hook)

### Dashboard & Sync

The `.beads/hooks/post-commit` hook automatically exports to `.beads/issues.jsonl` on each git commit. Manual export:

```bash
bd export -o .beads/issues.jsonl
```

Dashboard at http://localhost:3333 (from `~/projects/beads/`).

### Phase-to-Branch Mapping

Each phase should be implemented on a feature branch:

```
feature/sprint3-phase1-permissions-feeds    (T-001 through T-021)
feature/sprint3-phase2-conflicts-print      (T-022 through T-038)
feature/sprint3-phase3-notifications        (T-039 through T-062)
feature/sprint3-phase4-recurring-board      (T-063 through T-084)
feature/sprint3-phase5-requests-bulk        (T-085 through T-107)
feature/sprint3-phase6-checklists-quickadd  (T-108 through T-127)
feature/sprint3-verification                (T-128 through T-143)
```

### Sprint Checkpoints

```bash
bd epic status              # Check epic progress
bd blocked --json           # See blocked issues
bd graph                    # View dependency graph
bd epic close-eligible      # Check if epic can be closed
```

---

## 7. Testing Strategy

### Unit Tests (Vitest)

| Module | Key Test Scenarios |
|--------|--------------------|
| `notifications/service` | Recipient resolution by trigger type; quiet hours queueing; digest batching; SMS 160-char truncation; retry logic; urgent bypasses quiet hours |
| `calendar-feeds/service` | Feed creation (team + user types); iCal generation with correct VEVENT fields; deactivated feed returns null; last-accessed timestamp update |
| `conflicts/service` (enhanced) | Facility double-booking detection; back-to-back NOT flagged; person overlap with >5min threshold; resource collision; suggest-slots scoring; weather impact grouping |
| `facility-requests/service` | Request creation with conflict pre-check; approval generates events for recurring; COMMUNITY isolation; status transitions (only PENDING can be approved) |
| `operations/service` | Template CRUD; auto-apply on home game creation; checklist task status update; readiness percentage calculation |
| `recurring/service` | Date generation from season range + days; blocker exclusion; series update (future only); series delete (future only) |
| `quick-add/parser` | Day extraction; time range parsing; facility fuzzy match; team fuzzy match; "vs" opponent detection; confidence scoring; ambiguous match ranking |
| `bulk-ops/service` | Bulk move with offset; dry-run returns preview; rain plan outdoor-to-fallback mapping; auto-resolve applies high-confidence only |
| `auth` middleware | `requireRole()` allows correct roles; rejects others with 403; ADMIN bypasses; permission denied logging; throws error (not silent return) when schoolId missing from params |

### Integration Tests

| Scenario | What It Validates |
|----------|-------------------|
| Event create -> notification sent | Game creation triggers `notificationService.emit()`, recipients resolved, Resend API called |
| Event update -> calendar feed updated | Modify event time, fetch iCal feed, verify updated DTSTART |
| Bulk move -> conflict check -> notifications | Shift week, verify new conflicts detected, verify notifications queued |
| Facility request -> approve -> events created | Submit recurring request, approve, verify practice instances exist in DB |
| Recurring create -> blocker exclusion | Create recurring series, verify dates overlapping blockers are excluded |
| Permission enforcement end-to-end | Attempt mutation as PARENT, verify 403; retry as COACH, verify 200 |
| Community registration -> request -> isolation | Register community user, submit request, verify cannot access school events |

### Key Test Patterns

```typescript
// Unit test example: notification service
describe('notificationService', () => {
  test('emits email for event creation', async () => {
    const resendSpy = vi.spyOn(resend.emails, 'send').mockResolvedValue({ id: '123' });

    await notificationService.emit({
      trigger: 'EVENT_CREATED',
      schoolId: 'school1',
      eventType: 'GAME',
      eventId: 'game1',
    });

    expect(resendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'notifications@athleticos.co',
        subject: expect.stringContaining('New Game'),
      })
    );
  });

  test('queues during quiet hours', async () => {
    // Set current time to 22:00, user has quiet hours 21:00-07:00
    vi.setSystemTime(new Date('2026-03-13T22:00:00'));

    await notificationService.emit({ ... });

    const notification = await prisma.notification.findFirst({ where: { status: 'QUEUED' } });
    expect(notification).not.toBeNull();
  });
});
```

---

## 8. Security Considerations

### Permission Enforcement (F1)

- Every mutation endpoint protected by `requireRole()` middleware
- School membership verified via `SchoolUser` table (user must belong to the school)
- ADMIN role bypasses all role checks
- Permission denied events logged with userId, role, route, method for audit trail
- Frontend hides buttons/actions the user's role cannot perform (defense in depth -- backend is the authority)

### COMMUNITY Role Isolation (F9)

- COMMUNITY users can ONLY:
  - View their own facility requests
  - Create new facility requests
  - Update their notification preferences
- COMMUNITY users CANNOT access:
  - School events, teams, seasons, facilities (beyond what's needed for requests)
  - Conflict data, priority rules, blockers
  - Other users' data
- Isolation enforced in service layer: `where: { requestedBy: userId }` for COMMUNITY queries

### Calendar Feed Token Security (F5)

- Tokens are UUID v4 (122 bits of entropy, unguessable)
- No authentication on `/cal/:token.ics` (standard iCal behavior -- Apple/Google Calendar cannot authenticate)
- Feed data limited to event information (no phone numbers, addresses, or personal data)
- Users can deactivate feeds instantly (returns 404)
- `lastAccessed` timestamp tracked for monitoring

### SMS Opt-Out Handling (F3)

- Opt-out via link in SMS message: `https://athleticos.co/sms-stop?token={opaque-token}`
- Token is a JWT signed with app secret, containing userId, expires in 30 days
- Opt-out page: single button, no login required, sets `smsEnabled = false`
- Opt-out is immediate and irreversible via the link (user can re-enable in app settings)

### Rate Limiting

| Endpoint | Limit | Per |
|----------|-------|-----|
| `POST /notifications/test` | 5 | hour, per user |
| `POST /auth/community-register` | 10 | hour, per IP |
| `POST /quick-add` | 30 | minute, per user |
| `GET /cal/:token.ics` | 60 | minute, per token |

Implementation: Fastify rate-limit plugin (`@fastify/rate-limit`), already available in the ecosystem. Per-endpoint configuration.

### Notification Content Safety

- Email content: event name, team, time, facility. No other users' phone numbers or emails.
- SMS content: team name, event type, action, time, facility. No personal data.
- Digest emails: aggregated changes per team. No cross-team data for COACH role.

---

## 9. Performance Targets

| Operation | Target | Approach |
|-----------|--------|----------|
| Conflict check (full, 10 teams, 50 events/week) | <200ms | Parallel queries for blocker/facility/person/resource. Index on `datetime`, `facility_id`, `season_id`. |
| Weekly board load | <1s | Single `GET /events/upcoming?from=&to=` query. Prisma eager loading for facility and team. |
| Notification delivery: SMS | <60s | Resend API call is synchronous per notification. Fire-and-forget from route handler (non-blocking). |
| Notification delivery: Email | <5min | Same as SMS but email batching may add latency. Queue + process pattern. |
| Quick-add parse + preview | <100ms | Server-side parsing, no external API calls. Fuzzy match against in-memory facility/team lists (small school dataset). |
| Batch operations (50 events) | <5s | Use `prisma.$transaction()` for atomicity. Single query to fetch, batch update. |
| iCal feed generation | <500ms | Query events for team/user, format as iCal string. Cache with 60s TTL if needed. |
| Suggest-slots response | <300ms | Query facility events for the day, compute gaps, score. Single DB query. |
| Print view render | <500ms | Client-side only (no new network request -- uses already-loaded weekly data). |

### Database Indexes (New)

```sql
-- Notifications
CREATE INDEX idx_notifications_school_id ON notifications(school_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Calendar Feeds
CREATE INDEX idx_calendar_feeds_token ON calendar_feeds(token);  -- unique already implies index
CREATE INDEX idx_calendar_feeds_user_id ON calendar_feeds(user_id);

-- Facility Requests
CREATE INDEX idx_facility_requests_school_id ON facility_requests(school_id);
CREATE INDEX idx_facility_requests_facility_id ON facility_requests(facility_id);
CREATE INDEX idx_facility_requests_status ON facility_requests(status);

-- Event Checklists
CREATE INDEX idx_event_checklists_game_id ON event_checklists(game_id);
CREATE INDEX idx_event_checklists_practice_id ON event_checklists(practice_id);

-- Practices (recurrence)
CREATE INDEX idx_practices_recurrence_group_id ON practices(recurrence_group_id);

-- Operations Templates
CREATE INDEX idx_operations_templates_school_id ON operations_templates(school_id);
```

---

## 10. Deployment & Migration Plan

### Migration Order

```
Step 1: 20260314000000_add_sprint3_enums (T-013)
  - ALTER TYPE "Role" ADD VALUE 'COMMUNITY'
  - CREATE TYPE "RequestType", "RequestStatus", "NotificationChannel",
    "NotificationStatus", "NotificationTrigger", "ConflictType",
    "ConflictSeverity", "CalendarFeedType", "ChecklistItemStatus"
  *** ENUM-ONLY migration. No DDL/DML referencing new values. ***
  *** PostgreSQL cannot use new enum values in the same transaction ***

Step 2: 20260314000001_add_user_phone (T-013b)
  - ALTER TABLE "users" ADD COLUMN "phone" VARCHAR NULL
  *** Isolated change to existing high-traffic table ***

Step 3: 20260314000002_add_sprint3_tables (T-014)
  - CREATE TABLE "notifications"
  - CREATE TABLE "notification_preferences"
  - CREATE TABLE "calendar_feeds"
  - CREATE TABLE "facility_requests"
  - CREATE TABLE "operations_templates"
  - CREATE TABLE "event_checklists"
  - ALTER TABLE "facilities" ADD COLUMN "rain_fallback_id" (self-ref FK)
  - ALTER TABLE "practices" ADD COLUMN "recurrence_group_id"
  - CREATE all indexes

Step 4: Seed data (optional, for demo)
  - Add rain fallback mappings (Field A -> Main Gymnasium, etc.)
  - Add sample operations template ("Home Basketball Game")
  - Add notification preferences for existing demo users
```

### Feature Flags

No feature flags required. Features are additive (new endpoints, new pages). Existing functionality is not modified in breaking ways. The only existing-behavior change is F1 (permission enforcement), which is tested against all demo workflows before deployment.

### Rollback Strategy

- **Migrations:** Prisma `migrate reset` if critical issue. All new tables can be dropped without affecting Sprint 1-2 functionality.
- **Code:** Git revert to last Sprint 2 commit. New modules are isolated -- removing them does not break existing modules.
- **Partial rollback:** Each phase is independently deployable. If Phase 3 (notifications) has issues, Phases 1-2 continue to function.

### Render Deployment Checklist

1. Set new environment variables:
   - `RESEND_SMS_ENABLED=true` (feature toggle for SMS delivery)
   - Verify `RESEND_API_KEY` has SMS permissions
2. Run `prisma migrate deploy` (runs both migrations in order)
3. Run `prisma generate` (must complete before `tsc`)
4. Verify build succeeds
5. Smoke test: login, dashboard loads, create event, check notification log

### Monitoring

- Track notification delivery rate (SENT vs FAILED) in notification log
- Monitor Resend API usage for unexpected SMS costs
- Check `/cal/:token.ics` response times for iCal feed performance
- Watch for 403 responses in logs (permission enforcement working correctly)

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| SMS provider | Resend (same as email) | Single vendor, already integrated, simpler billing. TCA is US-based where Resend SMS is strong. |
| Weekly grid implementation | CSS Grid (no library) | Zero-dependency approach consistent with Sprint 2 (conic-gradient donut). Grid is simple enough. |
| Drag-and-drop | Deferred (optional) | Click-to-create + keyboard shortcuts cover core workflow. Drag-drop adds complexity without proportional value. |
| Permission scoping | School-level (not team-level) | Team-level requires coach-to-team relationships (roster feature). School-level is simpler and sufficient for TCA. |
| Calendar feed auth | None (token-based access) | Standard iCal behavior -- Apple/Google Calendar cannot send auth headers. UUID v4 tokens are unguessable. |
| Notification queue | In-DB (Notification table) | Simple, no external queue service. TCA scale (~100 parents) doesn't justify Redis/SQS. |
| Recurring event storage | Individual Practice records with shared groupId | Simpler than a recurrence rule + expansion. Each instance is independently editable. |
| Quick-add parsing | Server-side | Keeps parsing logic testable and consistent. Frontend sends text, backend returns structured preview. |
| Community accounts | Lightweight (User + SchoolUser with COMMUNITY role) | Reuses existing auth system. No separate auth flow needed. Minimal schema changes. |
| Migration strategy | Three migrations (enums, user phone column, then tables) | PostgreSQL requires enum additions in a separate transaction. Learned in Sprint 2. User table alteration isolated for safety. |
