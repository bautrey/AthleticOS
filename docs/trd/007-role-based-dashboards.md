# TRD-007: Role-Based Dashboard Scaffolding

> Status: Draft
> PRD: [PRD-002 (F5 - scaffolding only)](../prd/v2-athletic-operations.md#f5-role-based-dashboards)
> Created: 2026-02-19
> Last Updated: 2026-02-19

## Overview

### Problem

Different users need different views of the same system. A coach cares about their teams. An AD cares about the whole school. A Head of School wants a 30-second status check. Currently there is one basic dashboard (`Dashboard.tsx`) that does not adapt to the user's role, and the Role enum is limited to ADMIN, COACH, and VIEWER -- missing the Athletic Director, Coordinator, Head of School, and Parent roles needed for v2.

### Solution

This TRD covers **scaffolding only** -- extending the Role enum, implementing role-based routing, and creating the dashboard shell components with placeholder widgets. The dashboard content will be populated incrementally as other v2 features (F1 Priority Rules, F2 Event Operations, F3 Volunteers, etc.) are implemented.

Key scope:
1. Extend the `Role` enum with four new roles
2. Role-based routing to the appropriate dashboard component
3. Coach Dashboard shell with widget placeholders
4. AD Dashboard shell with widget placeholders
5. Head of School Dashboard shell with widget placeholders
6. Coordinator Dashboard shell with widget placeholders (same UI with smart defaults)
7. Dashboard API endpoint returning role-appropriate summary data from existing models

**Note from PRD:** Same UI for all roles with smart defaults and contextual help. No separate coordinator-specific experience. The difference is in data scope (my teams vs all teams) and widget emphasis, not in fundamental UI structure.

### Relationship to Existing System

- **Extends** existing `Role` enum (ADMIN, COACH, VIEWER)
- **Replaces** existing `Dashboard.tsx` with role-aware routing
- **Leverages** existing data: Game, Practice, Blocker, Facility, Team, Season models
- **Foundation** for F2 (Event Operations), F3 (Volunteers), F4 (Weather) dashboard widgets
- **Depends on** nothing beyond current v1 -- all data sources already exist

## Execution Environment

- **Branch**: `feature/role-based-dashboards`
- **Working Directory**: `/Users/burkestudio/projects/AthleticOS`
- **Required Skills**: Backend (Fastify/Prisma), Frontend (React/TanStack Query/Tailwind)
- **Prerequisites**:
  - Docker containers running (`docker compose up`)
  - Database migrated to current state
  - Existing Dashboard.tsx functional

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Role enum extension | Add to existing enum via migration | Prisma supports adding enum values; no breaking change |
| Dashboard routing | Single `/dashboard` route, role detected from JWT | Simpler than separate routes; components swap based on role |
| Widget architecture | Composable widget components with shared data hooks | Same widget can appear on multiple dashboards with different props |
| Placeholder content | Skeleton loaders + "Coming soon" for unbuilt features | Users see the dashboard structure immediately; features fill in over sprints |
| Role mapping | ADMIN -> AD Dashboard, COACH -> Coach Dashboard, new roles -> their dashboards | ADMIN maps to AD since AD is effectively the admin role for athletics |
| VIEWER role | Gets Head of School dashboard (read-only summary) | Closest match; VIEWER is read-only by definition |

---

## Data Model

### Role Enum Extension

```prisma
enum Role {
  ADMIN
  COACH
  VIEWER
  ATHLETIC_DIRECTOR
  COORDINATOR
  HEAD_OF_SCHOOL
  PARENT
}
```

No new models are required for the scaffolding. The existing `SchoolUser` model already has a `role` field that will accept the new enum values.

### Migration Considerations

- Adding values to a PostgreSQL enum requires `ALTER TYPE ... ADD VALUE`
- Existing data is unaffected (ADMIN, COACH, VIEWER values remain)
- The `authorize()` middleware must be updated to recognize new roles
- Role-to-dashboard mapping is handled in frontend routing, not the database

---

## API Endpoints

Base URL: `/api/v1`

### Dashboard Summary

```
GET /api/v1/schools/:schoolId/dashboard
```

Returns role-appropriate dashboard data using existing models. The response shape varies by role but uses a unified endpoint -- the backend determines what to return based on the user's role.

**Response for COACH / ADMIN (my teams or all teams):**
```json
{
  "data": {
    "role": "COACH",
    "scope": "my_teams",
    "upcomingEvents": {
      "thisWeek": [
        {
          "id": "clx...",
          "type": "GAME",
          "teamName": "Varsity Basketball",
          "opponent": "Rival High",
          "datetime": "2026-02-22T18:00:00Z",
          "facility": "Main Gymnasium",
          "homeAway": "HOME",
          "status": "SCHEDULED"
        }
      ],
      "nextWeek": [ "..." ],
      "totalThisWeek": 5,
      "totalNextWeek": 3
    },
    "activeBlockers": [
      {
        "id": "clx...",
        "type": "WEATHER",
        "name": "Ice Storm Warning",
        "startDatetime": "2026-02-21T00:00:00Z",
        "endDatetime": "2026-02-21T23:59:00Z",
        "affectedEventCount": 3
      }
    ],
    "unresolvedConflicts": {
      "count": 2,
      "events": [
        {
          "eventId": "clx...",
          "eventType": "PRACTICE",
          "teamName": "Varsity Basketball",
          "conflictReason": "Facility conflict with JV Soccer"
        }
      ]
    },
    "facilityUtilization": {
      "summary": [
        { "facilityName": "Main Gymnasium", "hoursBookedThisWeek": 22, "capacity": 40, "utilizationPct": 55 }
      ]
    },
    "stats": {
      "totalTeams": 12,
      "totalEventsThisMonth": 45,
      "totalBlockersActive": 2,
      "totalConflictsUnresolved": 2
    },
    "operationsReadiness": {
      "placeholder": true,
      "message": "Operations tracking coming soon (F2)"
    },
    "volunteerCoverage": {
      "placeholder": true,
      "message": "Volunteer management coming soon (F3)"
    }
  }
}
```

**Response for HEAD_OF_SCHOOL / VIEWER (executive summary):**
```json
{
  "data": {
    "role": "HEAD_OF_SCHOOL",
    "scope": "school_wide",
    "weekAtAGlance": {
      "status": "YELLOW",
      "statusReason": "2 events within 48 hours have unresolved conflicts",
      "totalEvents": 15,
      "eventsWithIssues": 2,
      "eventsFullyReady": 13
    },
    "redFlags": [
      {
        "type": "UNRESOLVED_CONFLICT",
        "description": "Varsity Basketball practice conflicts with JV Soccer on Feb 22",
        "hoursUntilEvent": 36
      }
    ],
    "stats": {
      "totalTeams": 12,
      "totalEventsThisMonth": 45,
      "activeBlockers": 2
    },
    "volunteerEngagement": {
      "placeholder": true,
      "message": "Volunteer engagement metrics coming soon (F3)"
    },
    "trends": {
      "placeholder": true,
      "message": "Trend analysis coming soon"
    }
  }
}
```

### Update User Role

```
PATCH /api/v1/schools/:schoolId/users/:userId/role
```

ADMIN only. Allows assigning the new role types.

**Request body:**
```json
{
  "role": "ATHLETIC_DIRECTOR"
}
```

**Validation:**
| Field | Rules |
|-------|-------|
| `role` | Required, valid Role enum value |

**Response (200):**
```json
{
  "data": {
    "id": "clx...",
    "userId": "clx...",
    "schoolId": "clx...",
    "role": "ATHLETIC_DIRECTOR"
  }
}
```

---

## Zod Schemas

```typescript
// backend/src/modules/dashboard/schemas.ts

import { z } from 'zod';

export const RoleEnum = z.enum([
  'ADMIN',
  'COACH',
  'VIEWER',
  'ATHLETIC_DIRECTOR',
  'COORDINATOR',
  'HEAD_OF_SCHOOL',
  'PARENT'
]);

export const updateUserRoleSchema = z.object({
  role: RoleEnum
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
```

---

## Service Layer

```typescript
// backend/src/modules/dashboard/service.ts

import { prisma } from '../../common/db';

// Role-to-scope mapping
const ROLE_SCOPE_MAP: Record<string, 'my_teams' | 'school_wide'> = {
  ADMIN: 'school_wide',
  ATHLETIC_DIRECTOR: 'school_wide',
  COORDINATOR: 'school_wide',
  HEAD_OF_SCHOOL: 'school_wide',
  COACH: 'my_teams',
  VIEWER: 'school_wide',
  PARENT: 'my_teams'
};

// Roles that see executive summary vs operational detail
const EXECUTIVE_ROLES = ['HEAD_OF_SCHOOL', 'VIEWER'];
const OPERATIONAL_ROLES = ['ADMIN', 'ATHLETIC_DIRECTOR', 'COORDINATOR', 'COACH', 'PARENT'];

export class DashboardService {
  /**
   * Get dashboard data based on user role
   */
  async getDashboard(schoolId: string, userId: string, role: string) {
    const scope = ROLE_SCOPE_MAP[role] || 'my_teams';

    if (EXECUTIVE_ROLES.includes(role)) {
      return this.getExecutiveDashboard(schoolId);
    }

    return this.getOperationalDashboard(schoolId, userId, role, scope);
  }

  private async getOperationalDashboard(
    schoolId: string,
    userId: string,
    role: string,
    scope: 'my_teams' | 'school_wide'
  ) {
    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
    const endOfNextWeek = new Date(endOfWeek);
    endOfNextWeek.setDate(endOfNextWeek.getDate() + 7);

    // Determine team filter based on scope
    const teamFilter = scope === 'my_teams'
      ? await this.getUserTeamIds(schoolId, userId)
      : undefined;

    const [
      thisWeekGames,
      thisWeekPractices,
      nextWeekGames,
      nextWeekPractices,
      activeBlockers,
      stats,
      facilityUtilization
    ] = await Promise.all([
      this.getEvents(schoolId, 'game', now, endOfWeek, teamFilter),
      this.getEvents(schoolId, 'practice', now, endOfWeek, teamFilter),
      this.getEvents(schoolId, 'game', endOfWeek, endOfNextWeek, teamFilter),
      this.getEvents(schoolId, 'practice', endOfWeek, endOfNextWeek, teamFilter),
      this.getActiveBlockers(schoolId, teamFilter),
      this.getStats(schoolId),
      this.getFacilityUtilization(schoolId, now, endOfWeek)
    ]);

    const thisWeekEvents = [...thisWeekGames, ...thisWeekPractices]
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
    const nextWeekEvents = [...nextWeekGames, ...nextWeekPractices]
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

    return {
      role,
      scope,
      upcomingEvents: {
        thisWeek: thisWeekEvents,
        nextWeek: nextWeekEvents,
        totalThisWeek: thisWeekEvents.length,
        totalNextWeek: nextWeekEvents.length
      },
      activeBlockers,
      unresolvedConflicts: { count: 0, events: [] }, // Populated when priority rules are active
      facilityUtilization: { summary: facilityUtilization },
      stats,
      operationsReadiness: { placeholder: true, message: 'Operations tracking coming soon (F2)' },
      volunteerCoverage: { placeholder: true, message: 'Volunteer management coming soon (F3)' }
    };
  }

  private async getExecutiveDashboard(schoolId: string) {
    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + (7 - now.getDay()));

    const [games, practices, activeBlockers, stats] = await Promise.all([
      this.getEvents(schoolId, 'game', now, endOfWeek),
      this.getEvents(schoolId, 'practice', now, endOfWeek),
      this.getActiveBlockers(schoolId),
      this.getStats(schoolId)
    ]);

    const totalEvents = games.length + practices.length;
    const eventsWithIssues = 0; // Will be populated with conflict data
    const status = eventsWithIssues === 0 ? 'GREEN' :
                   eventsWithIssues <= 2 ? 'YELLOW' : 'RED';

    return {
      role: 'HEAD_OF_SCHOOL',
      scope: 'school_wide',
      weekAtAGlance: {
        status,
        statusReason: status === 'GREEN'
          ? 'All events are on track this week'
          : `${eventsWithIssues} events have unresolved issues`,
        totalEvents,
        eventsWithIssues,
        eventsFullyReady: totalEvents - eventsWithIssues
      },
      redFlags: [], // Will be populated with conflict + operations gap data
      stats,
      volunteerEngagement: { placeholder: true, message: 'Volunteer engagement metrics coming soon (F3)' },
      trends: { placeholder: true, message: 'Trend analysis coming soon' }
    };
  }

  private async getUserTeamIds(schoolId: string, userId: string): Promise<string[]> {
    // For now, coaches see all teams at their school
    // Future: link coaches to specific teams via a CoachTeam model
    const teams = await prisma.team.findMany({
      where: { schoolId },
      select: { id: true }
    });
    return teams.map(t => t.id);
  }

  private async getEvents(
    schoolId: string,
    type: 'game' | 'practice',
    from: Date,
    to: Date,
    teamIds?: string[]
  ) {
    const seasonFilter = teamIds
      ? { season: { teamId: { in: teamIds } } }
      : { season: { team: { schoolId } } };

    if (type === 'game') {
      return prisma.game.findMany({
        where: {
          ...seasonFilter,
          datetime: { gte: from, lt: to }
        },
        include: {
          season: { include: { team: true } },
          facility: true
        },
        orderBy: { datetime: 'asc' }
      });
    }

    return prisma.practice.findMany({
      where: {
        ...seasonFilter,
        datetime: { gte: from, lt: to }
      },
      include: {
        season: { include: { team: true } },
        facility: true
      },
      orderBy: { datetime: 'asc' }
    });
  }

  private async getActiveBlockers(schoolId: string, teamIds?: string[]) {
    const now = new Date();
    const where: any = {
      schoolId,
      startDatetime: { lte: now },
      endDatetime: { gte: now }
    };

    if (teamIds) {
      where.OR = [
        { scope: 'SCHOOL_WIDE' },
        { teamId: { in: teamIds } }
      ];
    }

    return prisma.blocker.findMany({
      where,
      orderBy: { startDatetime: 'asc' }
    });
  }

  private async getStats(schoolId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [totalTeams, gamesThisMonth, practicesThisMonth, activeBlockers] = await Promise.all([
      prisma.team.count({ where: { schoolId } }),
      prisma.game.count({
        where: {
          season: { team: { schoolId } },
          datetime: { gte: startOfMonth, lte: endOfMonth }
        }
      }),
      prisma.practice.count({
        where: {
          season: { team: { schoolId } },
          datetime: { gte: startOfMonth, lte: endOfMonth }
        }
      }),
      prisma.blocker.count({
        where: {
          schoolId,
          startDatetime: { lte: now },
          endDatetime: { gte: now }
        }
      })
    ]);

    return {
      totalTeams,
      totalEventsThisMonth: gamesThisMonth + practicesThisMonth,
      totalBlockersActive: activeBlockers,
      totalConflictsUnresolved: 0 // Populated when priority rules are active
    };
  }

  private async getFacilityUtilization(schoolId: string, from: Date, to: Date) {
    const facilities = await prisma.facility.findMany({
      where: { schoolId },
      include: {
        games: {
          where: { datetime: { gte: from, lt: to } }
        },
        practices: {
          where: { datetime: { gte: from, lt: to } }
        }
      }
    });

    return facilities.map(f => {
      const gameHours = f.games.length * 2; // Assume 2 hours per game
      const practiceHours = f.practices.reduce((sum, p) => sum + (p.durationMinutes / 60), 0);
      const totalHours = gameHours + practiceHours;
      const weeklyCapacityHours = 40; // Configurable in future

      return {
        facilityId: f.id,
        facilityName: f.name,
        facilityType: f.type,
        hoursBookedThisWeek: Math.round(totalHours * 10) / 10,
        capacity: weeklyCapacityHours,
        utilizationPct: Math.round((totalHours / weeklyCapacityHours) * 100)
      };
    });
  }
}

export const dashboardService = new DashboardService();
```

---

## Routes

```typescript
// backend/src/modules/dashboard/routes.ts

import { FastifyInstance } from 'fastify';
import { dashboardService } from './service';
import { updateUserRoleSchema, UpdateUserRoleInput } from './schemas';
import { authenticate, authorize } from '../../common/middleware/auth';

interface SchoolParams {
  schoolId: string;
}

interface UserRoleParams extends SchoolParams {
  userId: string;
}

export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  // Get dashboard data (role-aware)
  fastify.get<{ Params: SchoolParams }>(
    '/schools/:schoolId/dashboard',
    {
      preHandler: [authorize([
        'ADMIN', 'COACH', 'VIEWER',
        'ATHLETIC_DIRECTOR', 'COORDINATOR', 'HEAD_OF_SCHOOL', 'PARENT'
      ])]
    },
    async (request) => {
      const data = await dashboardService.getDashboard(
        request.params.schoolId,
        request.user!.id,
        request.user!.role
      );
      return { data };
    }
  );

  // Update user role (ADMIN only)
  fastify.patch<{ Params: UserRoleParams; Body: UpdateUserRoleInput }>(
    '/schools/:schoolId/users/:userId/role',
    {
      preHandler: [authorize(['ADMIN'])]
    },
    async (request) => {
      const { role } = updateUserRoleSchema.parse(request.body);

      const schoolUser = await fastify.prisma.schoolUser.update({
        where: {
          schoolId_userId: {
            schoolId: request.params.schoolId,
            userId: request.params.userId
          }
        },
        data: { role }
      });

      return { data: schoolUser };
    }
  );
}
```

---

## Frontend Components

### File Structure

```
frontend/src/
├── components/
│   └── dashboard/
│       ├── DashboardRouter.tsx          # Routes to correct dashboard by role
│       ├── CoachDashboard.tsx           # Coach-specific layout
│       ├── ADDashboard.tsx              # Athletic Director layout
│       ├── HeadOfSchoolDashboard.tsx    # Executive summary layout
│       ├── CoordinatorDashboard.tsx     # Task-oriented layout
│       └── widgets/
│           ├── UpcomingEventsWidget.tsx  # Events this/next week
│           ├── ActiveBlockersWidget.tsx  # Active blockers list
│           ├── ConflictQueueWidget.tsx   # Unresolved conflicts
│           ├── FacilityUtilWidget.tsx    # Facility utilization bars
│           ├── StatsWidget.tsx          # Key stats cards
│           ├── WeekStatusWidget.tsx     # Green/Yellow/Red indicator
│           ├── RedFlagsWidget.tsx       # Events needing attention
│           └── PlaceholderWidget.tsx    # "Coming soon" placeholder
├── pages/
│   └── Dashboard.tsx                    # Updated to use DashboardRouter
├── hooks/
│   └── useDashboard.ts                 # TanStack Query hook for dashboard data
└── api/
    └── dashboard.ts                    # API client
```

### DashboardRouter

```typescript
// frontend/src/components/dashboard/DashboardRouter.tsx

// Maps user role to dashboard component:
// ADMIN, ATHLETIC_DIRECTOR -> ADDashboard
// COACH -> CoachDashboard
// HEAD_OF_SCHOOL, VIEWER -> HeadOfSchoolDashboard
// COORDINATOR -> CoordinatorDashboard
// PARENT -> CoachDashboard (filtered to their teams)

// Uses useAuth() hook to get current user's role
// Falls back to CoachDashboard if role is unknown
```

### CoachDashboard

Layout:
```
+--------------------------------------------------+
| My Teams This Week                               |
| [UpcomingEventsWidget - filtered to my teams]    |
+--------------------------------------------------+
| Operations Readiness     | Volunteer Needs        |
| [PlaceholderWidget F2]   | [PlaceholderWidget F3] |
+--------------------------------------------------+
| Active Blockers          | My Conflicts           |
| [ActiveBlockersWidget]   | [ConflictQueueWidget]  |
+--------------------------------------------------+
```

### ADDashboard

Layout:
```
+--------------------------------------------------+
| School Overview          [StatsWidget]           |
+--------------------------------------------------+
| School-Wide Calendar                              |
| [UpcomingEventsWidget - all teams]               |
+--------------------------------------------------+
| Operations Readiness     | Facility Utilization   |
| [PlaceholderWidget F2]   | [FacilityUtilWidget]   |
+--------------------------------------------------+
| Volunteer Coverage       | Conflict Queue         |
| [PlaceholderWidget F3]   | [ConflictQueueWidget]  |
+--------------------------------------------------+
| Active Blockers                                   |
| [ActiveBlockersWidget]                            |
+--------------------------------------------------+
```

### HeadOfSchoolDashboard

Layout:
```
+--------------------------------------------------+
| This Week at a Glance                             |
| [WeekStatusWidget - GREEN/YELLOW/RED]            |
+--------------------------------------------------+
| Red Flags (0)                                     |
| [RedFlagsWidget]                                 |
+--------------------------------------------------+
| Key Numbers            | Volunteer Engagement     |
| [StatsWidget]          | [PlaceholderWidget F3]   |
+--------------------------------------------------+
| Trends                                            |
| [PlaceholderWidget - trend charts coming soon]   |
+--------------------------------------------------+
```

### CoordinatorDashboard

Same widgets as AD Dashboard but reordered for task orientation:
```
+--------------------------------------------------+
| What Needs Attention Today                        |
| [RedFlagsWidget + overdue items]                 |
+--------------------------------------------------+
| Upcoming Events Needing Setup                     |
| [UpcomingEventsWidget with ops status]           |
+--------------------------------------------------+
| Active Blockers & Impact | Recent Imports         |
| [ActiveBlockersWidget]   | [PlaceholderWidget]    |
+--------------------------------------------------+
| Operations Readiness                              |
| [PlaceholderWidget F2]                            |
+--------------------------------------------------+
```

### Widget Components

**UpcomingEventsWidget**
- Table/card list of events with date, team, opponent, facility, status
- "This Week" / "Next Week" tabs
- Click-through to event detail
- Badge for HOME/AWAY

**ActiveBlockersWidget**
- List of currently active blockers
- Type icon + name + date range
- Affected event count badge
- Link to blockers page

**ConflictQueueWidget**
- List of events with unresolved facility conflicts
- Priority comparison summary (when TRD-005 is complete)
- "Resolve" action button

**FacilityUtilWidget**
- Horizontal bar chart per facility
- Color coding: green (<60%), yellow (60-85%), red (>85%)
- Hours booked / capacity label

**StatsWidget**
- Card grid: Total Teams, Events This Month, Active Blockers, Unresolved Conflicts
- Each card with icon and large number

**WeekStatusWidget**
- Large circular status indicator: GREEN / YELLOW / RED
- Status reason text
- Event counts: total, fully ready, with issues

**RedFlagsWidget**
- List of events within 48 hours with issues
- Each item: event name, issue type, hours until event
- Empty state: "No red flags this week"

**PlaceholderWidget**
- Dashed border card with icon
- "Coming soon" message with feature name
- Subtle background color

### Hooks

```typescript
// frontend/src/hooks/useDashboard.ts

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';

export function useDashboard(schoolId: string) {
  return useQuery({
    queryKey: ['dashboard', schoolId],
    queryFn: () => dashboardApi.get(schoolId),
    refetchInterval: 60000 // Refresh every 60 seconds
  });
}
```

---

## Migration

```sql
-- Add new values to the Role enum
ALTER TYPE "Role" ADD VALUE 'ATHLETIC_DIRECTOR';
ALTER TYPE "Role" ADD VALUE 'COORDINATOR';
ALTER TYPE "Role" ADD VALUE 'HEAD_OF_SCHOOL';
ALTER TYPE "Role" ADD VALUE 'PARENT';
```

### Migration Notes

- `ALTER TYPE ... ADD VALUE` cannot be rolled back within a transaction in PostgreSQL
- Prisma handles this via a special migration that runs outside of a transaction
- Existing rows with ADMIN, COACH, VIEWER are unaffected
- No table alterations needed -- SchoolUser.role column already uses the Role enum

### Migration Verification

```sql
-- VERIFY: Confirm new enum values exist
SELECT enumlabel FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'Role'
ORDER BY enumsortorder;

-- Expected: ADMIN, COACH, VIEWER, ATHLETIC_DIRECTOR, COORDINATOR, HEAD_OF_SCHOOL, PARENT

-- VERIFY: Existing data unaffected
SELECT role, COUNT(*) FROM school_users GROUP BY role;
```

---

## Authorization Middleware Update

The existing `authorize()` middleware must be updated to recognize new roles.

```typescript
// backend/src/common/middleware/auth.ts

// Update the authorize function to accept new Role values
// The function already accepts an array of role strings and checks against user.role
// Just ensure the new enum values are valid in the check

// Role hierarchy for permission inheritance:
// ADMIN >= ATHLETIC_DIRECTOR >= COORDINATOR >= COACH >= PARENT >= VIEWER
// HEAD_OF_SCHOOL has read-only access to everything (like VIEWER with school-wide scope)

export function authorize(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = request.user?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' }
      });
    }
  };
}
```

### Role Permission Matrix

| Endpoint Pattern | ADMIN | AD | COORD | COACH | HOS | PARENT | VIEWER |
|-----------------|-------|-----|-------|-------|-----|--------|--------|
| GET /dashboard | X | X | X | X | X | X | X |
| CRUD /teams | X | X | X | - | - | - | - |
| CRUD /games, /practices | X | X | X | X | - | - | - |
| CRUD /blockers | X | X | X | X | - | - | - |
| GET /blockers (read) | X | X | X | X | X | - | X |
| PATCH /users/:id/role | X | - | - | - | - | - | - |
| POST /feedback | X | X | X | X | X | X | X |
| GET /feedback (admin queue) | X | X | - | - | - | - | - |

Note: AD = ATHLETIC_DIRECTOR, COORD = COORDINATOR, HOS = HEAD_OF_SCHOOL

---

## Master Task List

### Sprint 1 Tasks

| # | Task | Estimate | Dependencies | Status |
|---|------|----------|-------------|--------|
| 1 | Prisma schema: extend Role enum with 4 new values | 0.5h | None | [] |
| 2 | Run migration, verify enum values | 0.5h | Task 1 | [] |
| 3 | Update authorize() middleware to accept new roles | 1h | Task 2 | [] |
| 4 | Define role permission matrix and update all existing route guards | 2h | Task 3 | [] |
| 5 | Zod schema: updateUserRole | 0.5h | None | [] |
| 6 | DashboardService: role-to-scope mapping and data aggregation | 3h | Task 2 | [] |
| 7 | DashboardService: getOperationalDashboard (coach/AD/coordinator) | 2h | Task 6 | [] |
| 8 | DashboardService: getExecutiveDashboard (HOS/viewer) | 1.5h | Task 6 | [] |
| 9 | DashboardService: getFacilityUtilization helper | 1h | Task 6 | [] |
| 10 | Dashboard API route: GET /dashboard | 1h | Tasks 6-9 | [] |
| 11 | User role update route: PATCH /users/:userId/role | 1h | Tasks 3, 5 | [] |
| 12 | Unit tests: dashboard service (service.test.ts) | 2h | Tasks 6-9 | [] |
| 13 | Integration tests: dashboard route, role update route (routes.test.ts) | 2h | Tasks 10, 11 | [] |
| 14 | API client: dashboard.ts | 0.5h | Task 10 | [] |
| 15 | TanStack Query hooks: useDashboard.ts | 0.5h | Task 14 | [] |
| 16 | PlaceholderWidget component | 0.5h | None | [] |
| 17 | StatsWidget component | 1h | Task 15 | [] |
| 18 | UpcomingEventsWidget component | 2h | Task 15 | [] |
| 19 | ActiveBlockersWidget component | 1h | Task 15 | [] |
| 20 | ConflictQueueWidget component | 1h | Task 15 | [] |
| 21 | FacilityUtilWidget component | 1.5h | Task 15 | [] |
| 22 | WeekStatusWidget component (executive) | 1h | Task 15 | [] |
| 23 | RedFlagsWidget component (executive) | 1h | Task 15 | [] |
| 24 | CoachDashboard layout with widgets | 1.5h | Tasks 16-20 | [] |
| 25 | ADDashboard layout with widgets | 1.5h | Tasks 16-21 | [] |
| 26 | HeadOfSchoolDashboard layout with widgets | 1h | Tasks 16-17, 22-23 | [] |
| 27 | CoordinatorDashboard layout with widgets | 1h | Tasks 16-21, 23 | [] |
| 28 | DashboardRouter (role-based component selection) | 1h | Tasks 24-27 | [] |
| 29 | Update Dashboard.tsx page to use DashboardRouter | 0.5h | Task 28 | [] |
| 30 | Add role selector to user management (admin settings) | 2h | Task 11 | [] |
| 31 | E2E tests: role-based dashboard routing and content | 2h | Tasks 29, 30 | [] |

**Total Estimate: ~35 hours (approx. 5 person-days)**

---

## Sprint Planning

### Phase 1: Backend (Tasks 1-13) -- Days 1-2

**Day 1:**
- Task 1: Schema + Task 2: Migration (1h)
- Task 3: Update authorize middleware (1h)
- Task 4: Update route guards (2h)
- Task 5: Zod schema (0.5h)
- Task 6: DashboardService foundation (3h)

**Day 2:**
- Task 7: Operational dashboard (2h)
- Task 8: Executive dashboard (1.5h)
- Task 9: Facility utilization (1h)
- Task 10: Dashboard route (1h)
- Task 11: Role update route (1h)
- Task 12: Unit tests (2h)
- Task 13: Integration tests (2h)

### Phase 2: Frontend Widgets (Tasks 14-23) -- Day 3

**Day 3:**
- Task 14: API client (0.5h)
- Task 15: Hooks (0.5h)
- Task 16: PlaceholderWidget (0.5h)
- Task 17: StatsWidget (1h)
- Task 18: UpcomingEventsWidget (2h)
- Task 19: ActiveBlockersWidget (1h)
- Task 20: ConflictQueueWidget (1h)
- Task 21: FacilityUtilWidget (1.5h)
- Task 22: WeekStatusWidget (1h)
- Task 23: RedFlagsWidget (1h)

### Phase 3: Dashboard Assembly (Tasks 24-31) -- Days 4-5

**Day 4:**
- Task 24: CoachDashboard (1.5h)
- Task 25: ADDashboard (1.5h)
- Task 26: HeadOfSchoolDashboard (1h)
- Task 27: CoordinatorDashboard (1h)
- Task 28: DashboardRouter (1h)
- Task 29: Update Dashboard.tsx (0.5h)

**Day 5:**
- Task 30: Role management UI (2h)
- Task 31: E2E tests (2h)

---

## Testing Strategy

### Unit Tests (Vitest)

**Service Logic (service.test.ts)**
- Returns operational dashboard for COACH role
- Returns operational dashboard for ADMIN role (school-wide scope)
- Returns executive dashboard for HEAD_OF_SCHOOL role
- Returns executive dashboard for VIEWER role
- Correctly maps ATHLETIC_DIRECTOR to school-wide scope
- Correctly maps COORDINATOR to school-wide scope
- Correctly maps PARENT to my_teams scope
- Upcoming events filtered to correct date range
- Active blockers returns only currently active
- Stats returns correct counts
- Facility utilization calculates correct percentages
- Week status returns GREEN when no issues
- Week status returns YELLOW/RED based on issue count

**Schema Validation**
- Accepts all valid Role enum values
- Rejects invalid role values

### Integration Tests (routes.test.ts)

- GET /dashboard returns data for COACH
- GET /dashboard returns data for ADMIN
- GET /dashboard returns executive data for HEAD_OF_SCHOOL
- GET /dashboard returns data for ATHLETIC_DIRECTOR
- GET /dashboard returns data for COORDINATOR
- GET /dashboard returns 401 for unauthenticated
- PATCH /users/:id/role updates role (ADMIN only)
- PATCH /users/:id/role returns 403 for COACH
- PATCH /users/:id/role rejects invalid role
- Existing routes still work with new role values
- Tenant isolation on dashboard data

### E2E Tests (Playwright)

- Coach login sees CoachDashboard with upcoming events
- Admin login sees ADDashboard with school-wide data
- HEAD_OF_SCHOOL login sees executive dashboard with status indicator
- Dashboard shows placeholder widgets for unbuilt features
- Admin can change user's role in settings
- After role change, user sees new dashboard on next login
- Stats widget shows correct numbers from seed data
- Active blockers widget lists current blockers
- Upcoming events widget shows this week's events

---

## Acceptance Criteria

### US-F5-1: Coach Sees Their World

- [x] Dashboard filtered to teams the coach is assigned to (scaffolding: all teams for now)
- [x] Sections: upcoming events, active blockers
- [ ] Operations gaps (placeholder -- requires F2)
- [ ] Volunteer needs (placeholder -- requires F3)
- [x] Click-through to event detail for any item

### US-F5-2: AD Sees School-Wide Operations

- [x] All teams visible with school-wide scope
- [x] Facility utilization summary
- [ ] Operations readiness (placeholder -- requires F2)
- [ ] Conflict resolution queue with priority recommendations (placeholder -- populates with TRD-005)

### US-F5-3: Head of School Executive View

- [x] Green/Yellow/Red status indicator for the week
- [x] Green: no issues; Yellow: some issues; Red: critical issues within 48 hours
- [x] Drill-down available via red flags widget
- [ ] Volunteer engagement (placeholder -- requires F3)

### Role Enum Extension

- [x] ATHLETIC_DIRECTOR role available
- [x] COORDINATOR role available
- [x] HEAD_OF_SCHOOL role available
- [x] PARENT role available
- [x] Existing ADMIN, COACH, VIEWER roles unaffected
- [x] Admin can assign new roles to users
- [x] Role-based routing to correct dashboard component

---

## Deliverables Checklist

### Backend

- [] Prisma schema: extend Role enum with 4 new values
- [] Migration file (verified with SQL checks)
- [] Updated authorize() middleware
- [] Updated route guards across all existing routes
- [] `DashboardService` with role-aware data aggregation
- [] Dashboard API route
- [] User role update route
- [] Zod validation schemas
- [] Unit tests (`service.test.ts`)
- [] Integration tests (`routes.test.ts`)

### Frontend

- [] `DashboardRouter.tsx` - Role-based component routing
- [] `CoachDashboard.tsx` - Coach layout with widgets
- [] `ADDashboard.tsx` - AD layout with widgets
- [] `HeadOfSchoolDashboard.tsx` - Executive layout
- [] `CoordinatorDashboard.tsx` - Task-oriented layout
- [] `UpcomingEventsWidget.tsx`
- [] `ActiveBlockersWidget.tsx`
- [] `ConflictQueueWidget.tsx`
- [] `FacilityUtilWidget.tsx`
- [] `StatsWidget.tsx`
- [] `WeekStatusWidget.tsx`
- [] `RedFlagsWidget.tsx`
- [] `PlaceholderWidget.tsx`
- [] Updated `Dashboard.tsx` page
- [] `useDashboard.ts` - TanStack Query hook
- [] `dashboard.ts` - API client
- [] Role management UI in admin settings
- [] E2E tests
