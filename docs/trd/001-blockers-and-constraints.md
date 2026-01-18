# TRD-001: Blockers & Constraints

> Status: Complete
> PRD: [PRD-001](../prd/001-constraint-aware-scheduling.md)
> Created: 2026-01-12
> Last Updated: 2026-01-16

## Overview

Implement blockers as first-class entities that represent time periods when scheduling should be avoided. Blockers are the foundation of the constraint-aware reconciliation engine.

## Execution Environment

- **Branch**: `feature/blockers-and-constraints`
- **Working Directory**: `/Users/burke/projects/AthleticOS`
- **Required Skills**: Backend (Fastify/Prisma), Frontend (React/TanStack Query)
- **Prerequisites**:
  - Docker containers running (`docker compose up`)
  - Database migrated to current state
  - Existing CRUD for Schools, Teams, Facilities functional

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Delete policy | Restrict (block deletion if blockers exist) | Prevents silent data loss; forces explicit cleanup |
| Timezone | Store UTC, display in school timezone | Standard practice; simplifies queries and comparisons |
| Conflict count | Include in create response | Immediate feedback on retroactive conflicts |
| Soft deletes | Not for v1 | Keep simple; audit trail via ConflictOverride in TRD-002 |

---

## Data Model

### Blocker Entity

```prisma
model Blocker {
  id          String       @id @default(cuid())
  schoolId    String       @map("school_id")

  // What kind of blocker
  type        BlockerType
  name        String       // "Final Exams", "Gym Resurfacing", etc.
  description String?

  // Scope: what does this blocker apply to?
  scope       BlockerScope
  teamId      String?      @map("team_id")      // if scope is TEAM
  facilityId  String?      @map("facility_id")  // if scope is FACILITY

  // When is it blocked? (stored in UTC)
  startDatetime DateTime   @map("start_datetime")
  endDatetime   DateTime   @map("end_datetime")

  // Recurrence (Phase 2 - not in scope for TRD-001)
  // recurrenceRule String?  @map("recurrence_rule")  // RRULE format

  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")
  createdBy   String       @map("created_by")  // user id who created

  // Relations - use Restrict to prevent silent deletion
  school      School       @relation(fields: [schoolId], references: [id], onDelete: Restrict)
  team        Team?        @relation(fields: [teamId], references: [id], onDelete: Restrict)
  facility    Facility?    @relation(fields: [facilityId], references: [id], onDelete: Restrict)

  @@index([schoolId])
  @@index([startDatetime, endDatetime])
  @@map("blockers")
}

enum BlockerType {
  EXAM          // Exam periods - no practices/games
  MAINTENANCE   // Facility maintenance
  EVENT         // School-wide event (assembly, pep rally)
  TRAVEL        // Team travel blackout
  HOLIDAY       // School holiday
  WEATHER       // Weather closure
  CUSTOM        // User-defined
}

enum BlockerScope {
  SCHOOL_WIDE   // Applies to all teams and facilities
  TEAM          // Applies to specific team only
  FACILITY      // Applies to specific facility only
}
```

### Relationships

Add to existing models:

```prisma
model School {
  // ... existing fields
  blockers    Blocker[]
}

model Team {
  // ... existing fields
  blockers    Blocker[]
}

model Facility {
  // ... existing fields
  blockers    Blocker[]
}
```

---

## API Endpoints

Base URL: `/api/v1`

All endpoints require authentication via JWT. School context derived from route parameter.

### List Blockers

```
GET /api/v1/schools/:schoolId/blockers
```

**Query parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `from` | datetime | Filter blockers overlapping this start date |
| `to` | datetime | Filter blockers overlapping this end date |
| `scope` | enum | Filter by scope (SCHOOL_WIDE, TEAM, FACILITY) |
| `type` | enum | Filter by type |
| `teamId` | string | Include team-specific AND school-wide blockers |
| `facilityId` | string | Include facility-specific AND school-wide blockers |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50, max: 100) |

**Response:**
```json
{
  "data": [
    {
      "id": "clx...",
      "type": "EXAM",
      "name": "Final Exams",
      "description": "Fall semester finals",
      "scope": "SCHOOL_WIDE",
      "teamId": null,
      "facilityId": null,
      "startDatetime": "2026-12-15T00:00:00Z",
      "endDatetime": "2026-12-19T23:59:59Z",
      "createdAt": "2026-01-12T10:00:00Z",
      "createdBy": "clx..."
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 12,
    "totalPages": 1
  }
}
```

### Get Blocker

```
GET /api/v1/schools/:schoolId/blockers/:id
```

**Note:** Route scoped under school to enforce tenant isolation.

**Response:**
```json
{
  "data": {
    "id": "clx...",
    "type": "EXAM",
    "name": "Final Exams",
    // ... all fields
  }
}
```

**Errors:**
- `404 NOT_FOUND` - Blocker doesn't exist or belongs to different school

### Create Blocker

```
POST /api/v1/schools/:schoolId/blockers
```

**Request body:**
```json
{
  "type": "EXAM",
  "name": "Final Exams",
  "description": "Fall semester finals (max 500 chars)",
  "scope": "SCHOOL_WIDE",
  "teamId": null,
  "facilityId": null,
  "startDatetime": "2026-12-15T00:00:00Z",
  "endDatetime": "2026-12-19T23:59:59Z"
}
```

**Validation:**
| Field | Rules |
|-------|-------|
| `name` | Required, 1-100 chars |
| `description` | Optional, max 500 chars |
| `type` | Required, valid BlockerType enum |
| `scope` | Required, valid BlockerScope enum |
| `startDatetime` | Required, valid ISO datetime |
| `endDatetime` | Required, must be after startDatetime |
| `teamId` | Required if scope is TEAM; must belong to school |
| `facilityId` | Required if scope is FACILITY; must belong to school |

**Response (201 Created):**
```json
{
  "data": {
    "id": "clx...",
    "type": "EXAM",
    "name": "Final Exams",
    // ... all fields
  },
  "meta": {
    "conflictingEvents": {
      "games": 2,
      "practices": 3,
      "total": 5
    }
  }
}
```

**Errors:**
- `400 VALIDATION_ERROR` - Invalid input
- `404 NOT_FOUND` - Referenced team/facility not found
- `403 FORBIDDEN` - User lacks permission

### Update Blocker

```
PATCH /api/v1/schools/:schoolId/blockers/:id
```

**Request body (partial update):**
```json
{
  "name": "Final Exams - Extended",
  "endDatetime": "2026-12-20T23:59:59Z"
}
```

**Validation:**
- Same rules as create, but all fields optional
- If `scope` changes to TEAM, `teamId` must be provided in same request
- If `scope` changes to FACILITY, `facilityId` must be provided in same request
- If `scope` changes to SCHOOL_WIDE, `teamId` and `facilityId` are cleared

**Response:** Same as create, with updated `conflictingEvents` count.

**Errors:**
- `400 VALIDATION_ERROR` - Invalid input or scope/id mismatch
- `404 NOT_FOUND` - Blocker not found

### Delete Blocker

```
DELETE /api/v1/schools/:schoolId/blockers/:id
```

**Response (204 No Content)**

**Errors:**
- `404 NOT_FOUND` - Blocker not found

---

## Zod Schemas

```typescript
// backend/src/modules/blockers/schemas.ts

import { z } from 'zod';

export const BlockerType = z.enum([
  'EXAM',
  'MAINTENANCE',
  'EVENT',
  'TRAVEL',
  'HOLIDAY',
  'WEATHER',
  'CUSTOM'
]);

export const BlockerScope = z.enum([
  'SCHOOL_WIDE',
  'TEAM',
  'FACILITY'
]);

export const createBlockerSchema = z.object({
  type: BlockerType,
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  scope: BlockerScope,
  teamId: z.string().cuid().optional().nullable(),
  facilityId: z.string().cuid().optional().nullable(),
  startDatetime: z.coerce.date(),
  endDatetime: z.coerce.date()
}).refine(
  data => data.endDatetime > data.startDatetime,
  { message: 'End datetime must be after start datetime', path: ['endDatetime'] }
).refine(
  data => data.scope !== 'TEAM' || data.teamId,
  { message: 'teamId required when scope is TEAM', path: ['teamId'] }
).refine(
  data => data.scope !== 'FACILITY' || data.facilityId,
  { message: 'facilityId required when scope is FACILITY', path: ['facilityId'] }
);

export const updateBlockerSchema = z.object({
  type: BlockerType.optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  scope: BlockerScope.optional(),
  teamId: z.string().cuid().optional().nullable(),
  facilityId: z.string().cuid().optional().nullable(),
  startDatetime: z.coerce.date().optional(),
  endDatetime: z.coerce.date().optional()
}).refine(
  data => {
    if (data.startDatetime && data.endDatetime) {
      return data.endDatetime > data.startDatetime;
    }
    return true;
  },
  { message: 'End datetime must be after start datetime', path: ['endDatetime'] }
).refine(
  data => {
    // If changing to TEAM scope, teamId must be provided
    if (data.scope === 'TEAM' && !data.teamId) {
      return false;
    }
    return true;
  },
  { message: 'teamId required when changing scope to TEAM', path: ['teamId'] }
).refine(
  data => {
    // If changing to FACILITY scope, facilityId must be provided
    if (data.scope === 'FACILITY' && !data.facilityId) {
      return false;
    }
    return true;
  },
  { message: 'facilityId required when changing scope to FACILITY', path: ['facilityId'] }
);

export const blockerQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  scope: BlockerScope.optional(),
  type: BlockerType.optional(),
  teamId: z.string().cuid().optional(),
  facilityId: z.string().cuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50)
});

export type CreateBlockerInput = z.infer<typeof createBlockerSchema>;
export type UpdateBlockerInput = z.infer<typeof updateBlockerSchema>;
export type BlockerQuery = z.infer<typeof blockerQuerySchema>;
```

---

## Service Layer

```typescript
// backend/src/modules/blockers/service.ts

import { Prisma, Blocker, BlockerScope } from '@prisma/client';
import { prisma } from '../../common/db';
import { NotFoundError, ForbiddenError } from '../../common/errors';
import { CreateBlockerInput, UpdateBlockerInput, BlockerQuery } from './schemas';

interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ConflictingEventsCount {
  games: number;
  practices: number;
  total: number;
}

export class BlockerService {
  /**
   * List blockers with filtering and pagination
   */
  async list(schoolId: string, query: BlockerQuery): Promise<PaginatedResult<Blocker>> {
    const { page, limit, from, to, scope, type, teamId, facilityId } = query;

    const where: Prisma.BlockerWhereInput = {
      schoolId,
      ...(scope && { scope }),
      ...(type && { type }),
    };

    // Date range overlap: blocker overlaps with [from, to]
    if (from || to) {
      where.AND = [];
      if (from) {
        where.AND.push({ endDatetime: { gte: from } });
      }
      if (to) {
        where.AND.push({ startDatetime: { lte: to } });
      }
    }

    // Team filter: include team-specific AND school-wide
    if (teamId) {
      where.OR = [
        { teamId },
        { scope: 'SCHOOL_WIDE' }
      ];
    }

    // Facility filter: include facility-specific AND school-wide
    if (facilityId) {
      where.OR = [
        { facilityId },
        { scope: 'SCHOOL_WIDE' }
      ];
    }

    const [blockers, total] = await Promise.all([
      prisma.blocker.findMany({
        where,
        orderBy: { startDatetime: 'asc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.blocker.count({ where })
    ]);

    return {
      data: blockers,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get a single blocker by ID
   */
  async getById(schoolId: string, id: string): Promise<Blocker> {
    const blocker = await prisma.blocker.findFirst({
      where: { id, schoolId }
    });

    if (!blocker) {
      throw new NotFoundError('Blocker not found');
    }

    return blocker;
  }

  /**
   * Create a new blocker
   */
  async create(
    schoolId: string,
    data: CreateBlockerInput,
    userId: string
  ): Promise<{ blocker: Blocker; conflictingEvents: ConflictingEventsCount }> {
    // Validate team belongs to school
    if (data.teamId) {
      const team = await prisma.team.findFirst({
        where: { id: data.teamId, schoolId }
      });
      if (!team) {
        throw new NotFoundError('Team not found in this school');
      }
    }

    // Validate facility belongs to school
    if (data.facilityId) {
      const facility = await prisma.facility.findFirst({
        where: { id: data.facilityId, schoolId }
      });
      if (!facility) {
        throw new NotFoundError('Facility not found in this school');
      }
    }

    // Clear irrelevant foreign keys based on scope
    const cleanedData = this.cleanDataForScope(data);

    const blocker = await prisma.blocker.create({
      data: {
        ...cleanedData,
        schoolId,
        createdBy: userId
      }
    });

    // Calculate conflicting events
    const conflictingEvents = await this.countConflictingEvents(blocker);

    return { blocker, conflictingEvents };
  }

  /**
   * Update an existing blocker
   */
  async update(
    schoolId: string,
    id: string,
    data: UpdateBlockerInput
  ): Promise<{ blocker: Blocker; conflictingEvents: ConflictingEventsCount }> {
    // Verify blocker exists and belongs to school
    const existing = await this.getById(schoolId, id);

    // Validate team if changing
    if (data.teamId) {
      const team = await prisma.team.findFirst({
        where: { id: data.teamId, schoolId }
      });
      if (!team) {
        throw new NotFoundError('Team not found in this school');
      }
    }

    // Validate facility if changing
    if (data.facilityId) {
      const facility = await prisma.facility.findFirst({
        where: { id: data.facilityId, schoolId }
      });
      if (!facility) {
        throw new NotFoundError('Facility not found in this school');
      }
    }

    // Merge with existing for scope validation
    const merged = { ...existing, ...data };

    // Validate datetime range if both provided
    if (data.endDatetime || data.startDatetime) {
      const start = data.startDatetime || existing.startDatetime;
      const end = data.endDatetime || existing.endDatetime;
      if (end <= start) {
        throw new Error('End datetime must be after start datetime');
      }
    }

    // Clean data based on final scope
    const finalScope = data.scope || existing.scope;
    const cleanedData = this.cleanDataForScope({ ...data, scope: finalScope });

    const blocker = await prisma.blocker.update({
      where: { id },
      data: cleanedData
    });

    const conflictingEvents = await this.countConflictingEvents(blocker);

    return { blocker, conflictingEvents };
  }

  /**
   * Delete a blocker
   */
  async delete(schoolId: string, id: string): Promise<void> {
    // Verify blocker exists and belongs to school
    await this.getById(schoolId, id);

    await prisma.blocker.delete({
      where: { id }
    });
  }

  /**
   * Count events that conflict with a blocker
   */
  private async countConflictingEvents(blocker: Blocker): Promise<ConflictingEventsCount> {
    const eventWhere = this.buildEventWhereClause(blocker);

    const [gamesCount, practicesCount] = await Promise.all([
      prisma.game.count({
        where: {
          ...eventWhere,
          datetime: {
            gte: blocker.startDatetime,
            lt: blocker.endDatetime
          }
        }
      }),
      prisma.practice.count({
        where: {
          ...eventWhere,
          datetime: {
            gte: blocker.startDatetime,
            lt: blocker.endDatetime
          }
        }
      })
    ]);

    return {
      games: gamesCount,
      practices: practicesCount,
      total: gamesCount + practicesCount
    };
  }

  /**
   * Build Prisma where clause for events based on blocker scope
   */
  private buildEventWhereClause(blocker: Blocker): Prisma.GameWhereInput {
    switch (blocker.scope) {
      case 'SCHOOL_WIDE':
        return {
          season: { team: { schoolId: blocker.schoolId } }
        };
      case 'TEAM':
        return {
          season: { teamId: blocker.teamId! }
        };
      case 'FACILITY':
        return {
          facilityId: blocker.facilityId
        };
    }
  }

  /**
   * Clear irrelevant foreign keys based on scope
   */
  private cleanDataForScope<T extends { scope?: BlockerScope; teamId?: string | null; facilityId?: string | null }>(
    data: T
  ): T {
    const cleaned = { ...data };

    if (cleaned.scope === 'SCHOOL_WIDE') {
      cleaned.teamId = null;
      cleaned.facilityId = null;
    } else if (cleaned.scope === 'TEAM') {
      cleaned.facilityId = null;
    } else if (cleaned.scope === 'FACILITY') {
      cleaned.teamId = null;
    }

    return cleaned;
  }
}

export const blockerService = new BlockerService();
```

---

## Routes

```typescript
// backend/src/modules/blockers/routes.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { blockerService } from './service';
import {
  createBlockerSchema,
  updateBlockerSchema,
  blockerQuerySchema,
  CreateBlockerInput,
  UpdateBlockerInput,
  BlockerQuery
} from './schemas';
import { authenticate, authorize } from '../../common/middleware/auth';

interface SchoolParams {
  schoolId: string;
}

interface BlockerParams extends SchoolParams {
  id: string;
}

export async function blockerRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('onRequest', authenticate);

  // List blockers
  fastify.get<{ Params: SchoolParams; Querystring: BlockerQuery }>(
    '/schools/:schoolId/blockers',
    {
      preHandler: [authorize(['ADMIN', 'COACH', 'VIEWER'])],
      schema: {
        querystring: blockerQuerySchema
      }
    },
    async (request, reply) => {
      const query = blockerQuerySchema.parse(request.query);
      const result = await blockerService.list(request.params.schoolId, query);
      return result;
    }
  );

  // Get single blocker
  fastify.get<{ Params: BlockerParams }>(
    '/schools/:schoolId/blockers/:id',
    {
      preHandler: [authorize(['ADMIN', 'COACH', 'VIEWER'])]
    },
    async (request, reply) => {
      const blocker = await blockerService.getById(
        request.params.schoolId,
        request.params.id
      );
      return { data: blocker };
    }
  );

  // Create blocker
  fastify.post<{ Params: SchoolParams; Body: CreateBlockerInput }>(
    '/schools/:schoolId/blockers',
    {
      preHandler: [authorize(['ADMIN', 'COACH'])],
      schema: {
        body: createBlockerSchema
      }
    },
    async (request, reply) => {
      const data = createBlockerSchema.parse(request.body);
      const result = await blockerService.create(
        request.params.schoolId,
        data,
        request.user!.id
      );
      reply.status(201);
      return {
        data: result.blocker,
        meta: { conflictingEvents: result.conflictingEvents }
      };
    }
  );

  // Update blocker
  fastify.patch<{ Params: BlockerParams; Body: UpdateBlockerInput }>(
    '/schools/:schoolId/blockers/:id',
    {
      preHandler: [authorize(['ADMIN', 'COACH'])],
      schema: {
        body: updateBlockerSchema
      }
    },
    async (request, reply) => {
      const data = updateBlockerSchema.parse(request.body);
      const result = await blockerService.update(
        request.params.schoolId,
        request.params.id,
        data
      );
      return {
        data: result.blocker,
        meta: { conflictingEvents: result.conflictingEvents }
      };
    }
  );

  // Delete blocker
  fastify.delete<{ Params: BlockerParams }>(
    '/schools/:schoolId/blockers/:id',
    {
      preHandler: [authorize(['ADMIN', 'COACH'])]
    },
    async (request, reply) => {
      await blockerService.delete(request.params.schoolId, request.params.id);
      reply.status(204).send();
    }
  );
}
```

---

## Frontend Components

All components located in `frontend/src/`.

### File Structure

```
frontend/src/
├── components/
│   └── blockers/
│       ├── BlockerBadge.tsx       # Type badge with icon
│       ├── BlockerCard.tsx        # Display card for list view
│       ├── BlockerForm.tsx        # Create/edit modal form
│       └── BlockerTypeIcon.tsx    # Icon mapping for types
├── pages/
│   └── BlockersPage.tsx           # Main blockers list page
├── hooks/
│   └── useBlockers.ts             # TanStack Query hooks
└── api/
    └── blockers.ts                # API client functions
```

### Type Icon Mapping

```typescript
// frontend/src/components/blockers/BlockerTypeIcon.tsx

import {
  AcademicCapIcon,    // EXAM
  WrenchIcon,         // MAINTENANCE
  CalendarIcon,       // EVENT
  TruckIcon,          // TRAVEL
  HomeIcon,           // HOLIDAY
  CloudIcon,          // WEATHER
  TagIcon             // CUSTOM
} from '@heroicons/react/24/outline';

export const BLOCKER_TYPE_ICONS = {
  EXAM: AcademicCapIcon,
  MAINTENANCE: WrenchIcon,
  EVENT: CalendarIcon,
  TRAVEL: TruckIcon,
  HOLIDAY: HomeIcon,
  WEATHER: CloudIcon,
  CUSTOM: TagIcon
} as const;

export const BLOCKER_TYPE_LABELS = {
  EXAM: 'Exam Period',
  MAINTENANCE: 'Maintenance',
  EVENT: 'School Event',
  TRAVEL: 'Travel Blackout',
  HOLIDAY: 'Holiday',
  WEATHER: 'Weather',
  CUSTOM: 'Custom'
} as const;
```

### Hooks

```typescript
// frontend/src/hooks/useBlockers.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blockersApi, BlockerQuery, CreateBlockerInput, UpdateBlockerInput } from '../api/blockers';

export function useBlockers(schoolId: string, query?: Partial<BlockerQuery>) {
  return useQuery({
    queryKey: ['blockers', schoolId, query],
    queryFn: () => blockersApi.list(schoolId, query)
  });
}

export function useBlocker(schoolId: string, id: string) {
  return useQuery({
    queryKey: ['blockers', schoolId, id],
    queryFn: () => blockersApi.getById(schoolId, id),
    enabled: !!id
  });
}

export function useCreateBlocker(schoolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBlockerInput) => blockersApi.create(schoolId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blockers', schoolId] });
    }
  });
}

export function useUpdateBlocker(schoolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBlockerInput }) =>
      blockersApi.update(schoolId, id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['blockers', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['blockers', schoolId, id] });
    }
  });
}

export function useDeleteBlocker(schoolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => blockersApi.delete(schoolId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blockers', schoolId] });
    }
  });
}
```

### BlockersPage

Route: `/schools/:schoolId/blockers`

Features:
- List view with pagination
- Filter by type, scope, date range
- Create button → opens BlockerForm modal
- Click row → opens BlockerForm in edit mode
- Delete with confirmation
- Shows conflicting events count after create/update

### BlockerForm

Modal dialog for create/edit:
- Type dropdown with icons (using BLOCKER_TYPE_ICONS)
- Name text input (max 100 chars, validated)
- Description textarea (optional, max 500 chars)
- Scope radio buttons (School-wide, Team, Facility)
- Team dropdown (conditional, filtered to school)
- Facility dropdown (conditional, filtered to school)
- Date range picker (start/end datetime)
- Client-side validation with Zod schemas
- Submit shows loading state
- Success shows conflicting events count toast

### Calendar Integration

**Deferred to TRD-003** — Calendar overlay and blocker visualization will be implemented as part of the Reconciliation UI.

---

## Migration

```sql
-- CreateEnum
CREATE TYPE "BlockerType" AS ENUM ('EXAM', 'MAINTENANCE', 'EVENT', 'TRAVEL', 'HOLIDAY', 'WEATHER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BlockerScope" AS ENUM ('SCHOOL_WIDE', 'TEAM', 'FACILITY');

-- CreateTable
CREATE TABLE "blockers" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "type" "BlockerType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "BlockerScope" NOT NULL,
    "team_id" TEXT,
    "facility_id" TEXT,
    "start_datetime" TIMESTAMP(3) NOT NULL,
    "end_datetime" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "blockers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blockers_school_id_idx" ON "blockers"("school_id");

-- CreateIndex
CREATE INDEX "blockers_start_datetime_end_datetime_idx" ON "blockers"("start_datetime", "end_datetime");

-- AddForeignKey (using RESTRICT, not CASCADE)
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_facility_id_fkey"
  FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

### Migration Verification

After running migration:
```sql
-- VERIFY: Confirm blockers table exists with correct columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'blockers'
ORDER BY ordinal_position;

-- VERIFY: Confirm enums exist
SELECT typname FROM pg_type WHERE typname IN ('BlockerType', 'BlockerScope');

-- VERIFY: Confirm indexes exist
SELECT indexname FROM pg_indexes WHERE tablename = 'blockers';

-- VERIFY: Confirm foreign keys use RESTRICT
SELECT
  tc.constraint_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'blockers' AND tc.constraint_type = 'FOREIGN KEY';
```

---

## Test Data

### Seed Data

```typescript
// backend/prisma/seed-test-data.ts

export const TEST_SCHOOL = {
  id: 'cltest_school_001',
  name: 'Lincoln High School',
  timezone: 'America/Chicago'
};

export const TEST_TEAMS = [
  { id: 'cltest_team_varsity', name: 'Varsity Basketball', sport: 'Basketball', level: 'VARSITY' },
  { id: 'cltest_team_jv', name: 'JV Basketball', sport: 'Basketball', level: 'JV' }
];

export const TEST_FACILITIES = [
  { id: 'cltest_facility_gym', name: 'Main Gymnasium', type: 'GYM', capacity: 500 },
  { id: 'cltest_facility_field', name: 'Athletic Field', type: 'FIELD', capacity: 1000 }
];

export const TEST_USER = {
  id: 'cltest_user_coach',
  email: 'coach@lincoln.edu',
  role: 'COACH'
};
```

### Test Blockers

```typescript
export const TEST_BLOCKERS = {
  examBlocker: {
    type: 'EXAM',
    name: 'Fall Final Exams',
    description: 'Fall semester final examinations',
    scope: 'SCHOOL_WIDE',
    teamId: null,
    facilityId: null,
    startDatetime: '2026-12-15T00:00:00Z',
    endDatetime: '2026-12-19T23:59:59Z'
  },
  maintenanceBlocker: {
    type: 'MAINTENANCE',
    name: 'Gym Floor Refinishing',
    description: 'Annual floor maintenance',
    scope: 'FACILITY',
    teamId: null,
    facilityId: 'cltest_facility_gym',
    startDatetime: '2026-06-01T00:00:00Z',
    endDatetime: '2026-06-15T23:59:59Z'
  },
  travelBlocker: {
    type: 'TRAVEL',
    name: 'State Tournament Travel',
    description: 'Team traveling for state tournament',
    scope: 'TEAM',
    teamId: 'cltest_team_varsity',
    facilityId: null,
    startDatetime: '2026-03-10T00:00:00Z',
    endDatetime: '2026-03-14T23:59:59Z'
  }
};
```

---

## Test Cases

### Unit Tests

Located in `backend/src/modules/blockers/__tests__/`

**1. Schema Validation (`schemas.test.ts`)**

```typescript
describe('createBlockerSchema', () => {
  it('accepts valid school-wide blocker', () => {
    const result = createBlockerSchema.safeParse(TEST_BLOCKERS.examBlocker);
    expect(result.success).toBe(true);
  });

  it('rejects blocker where end < start', () => {
    const result = createBlockerSchema.safeParse({
      ...TEST_BLOCKERS.examBlocker,
      startDatetime: '2026-12-20T00:00:00Z',
      endDatetime: '2026-12-15T00:00:00Z'
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('endDatetime');
  });

  it('rejects TEAM scope without teamId', () => {
    const result = createBlockerSchema.safeParse({
      ...TEST_BLOCKERS.examBlocker,
      scope: 'TEAM',
      teamId: null
    });
    expect(result.success).toBe(false);
  });

  it('rejects FACILITY scope without facilityId', () => {
    const result = createBlockerSchema.safeParse({
      ...TEST_BLOCKERS.examBlocker,
      scope: 'FACILITY',
      facilityId: null
    });
    expect(result.success).toBe(false);
  });

  it('enforces name max length (100 chars)', () => {
    const result = createBlockerSchema.safeParse({
      ...TEST_BLOCKERS.examBlocker,
      name: 'a'.repeat(101)
    });
    expect(result.success).toBe(false);
  });

  it('enforces description max length (500 chars)', () => {
    const result = createBlockerSchema.safeParse({
      ...TEST_BLOCKERS.examBlocker,
      description: 'a'.repeat(501)
    });
    expect(result.success).toBe(false);
  });
});

describe('updateBlockerSchema', () => {
  it('accepts partial update', () => {
    const result = updateBlockerSchema.safeParse({ name: 'Updated Name' });
    expect(result.success).toBe(true);
  });

  it('rejects scope change to TEAM without teamId', () => {
    const result = updateBlockerSchema.safeParse({
      scope: 'TEAM'
      // missing teamId
    });
    expect(result.success).toBe(false);
  });
});
```

**2. Service Logic (`service.test.ts`)**

Uses REAL database (test database, not mocks).

```typescript
describe('BlockerService', () => {
  beforeAll(async () => {
    // Seed test data
    await seedTestData();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  describe('list', () => {
    it('returns blockers for school', async () => {
      const result = await blockerService.list(TEST_SCHOOL.id, { page: 1, limit: 50 });
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.meta.total).toBeGreaterThan(0);
    });

    it('filters by date range overlap', async () => {
      const result = await blockerService.list(TEST_SCHOOL.id, {
        page: 1,
        limit: 50,
        from: new Date('2026-12-16'),
        to: new Date('2026-12-17')
      });
      // Should return exam blocker (Dec 15-19)
      expect(result.data.some(b => b.name === 'Fall Final Exams')).toBe(true);
    });

    it('teamId filter includes school-wide blockers', async () => {
      const result = await blockerService.list(TEST_SCHOOL.id, {
        page: 1,
        limit: 50,
        teamId: TEST_TEAMS[0].id
      });
      // Should include both team-specific AND school-wide
      expect(result.data.some(b => b.scope === 'SCHOOL_WIDE')).toBe(true);
    });

    it('respects pagination', async () => {
      const page1 = await blockerService.list(TEST_SCHOOL.id, { page: 1, limit: 1 });
      const page2 = await blockerService.list(TEST_SCHOOL.id, { page: 2, limit: 1 });
      expect(page1.data[0]?.id).not.toBe(page2.data[0]?.id);
    });
  });

  describe('create', () => {
    it('creates blocker and returns conflict count', async () => {
      const result = await blockerService.create(
        TEST_SCHOOL.id,
        TEST_BLOCKERS.examBlocker,
        TEST_USER.id
      );
      expect(result.blocker.id).toBeDefined();
      expect(result.conflictingEvents.total).toBeGreaterThanOrEqual(0);
    });

    it('clears teamId/facilityId for SCHOOL_WIDE scope', async () => {
      const result = await blockerService.create(
        TEST_SCHOOL.id,
        {
          ...TEST_BLOCKERS.examBlocker,
          teamId: TEST_TEAMS[0].id // should be cleared
        },
        TEST_USER.id
      );
      expect(result.blocker.teamId).toBeNull();
    });

    it('throws NotFoundError for invalid teamId', async () => {
      await expect(
        blockerService.create(
          TEST_SCHOOL.id,
          {
            ...TEST_BLOCKERS.travelBlocker,
            teamId: 'nonexistent_team'
          },
          TEST_USER.id
        )
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('updates blocker and recalculates conflicts', async () => {
      // First create a blocker
      const { blocker } = await blockerService.create(
        TEST_SCHOOL.id,
        TEST_BLOCKERS.examBlocker,
        TEST_USER.id
      );

      // Update it
      const result = await blockerService.update(
        TEST_SCHOOL.id,
        blocker.id,
        { name: 'Updated Exam Period' }
      );

      expect(result.blocker.name).toBe('Updated Exam Period');
    });

    it('clears facilityId when scope changes to TEAM', async () => {
      const { blocker } = await blockerService.create(
        TEST_SCHOOL.id,
        TEST_BLOCKERS.maintenanceBlocker,
        TEST_USER.id
      );

      const result = await blockerService.update(
        TEST_SCHOOL.id,
        blocker.id,
        { scope: 'TEAM', teamId: TEST_TEAMS[0].id }
      );

      expect(result.blocker.scope).toBe('TEAM');
      expect(result.blocker.facilityId).toBeNull();
    });
  });

  describe('delete', () => {
    it('deletes blocker', async () => {
      const { blocker } = await blockerService.create(
        TEST_SCHOOL.id,
        TEST_BLOCKERS.examBlocker,
        TEST_USER.id
      );

      await blockerService.delete(TEST_SCHOOL.id, blocker.id);

      await expect(
        blockerService.getById(TEST_SCHOOL.id, blocker.id)
      ).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for other school blocker', async () => {
      await expect(
        blockerService.delete('other_school_id', 'any_blocker_id')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
```

### Integration Tests

Located in `backend/src/modules/blockers/__tests__/routes.test.ts`

Uses REAL API calls against test server.

```typescript
describe('Blocker API Routes', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeAll(async () => {
    app = await buildTestApp();
    authToken = await getTestAuthToken(TEST_USER);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /schools/:schoolId/blockers', () => {
    it('creates blocker with 201 status', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/schools/${TEST_SCHOOL.id}/blockers`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: TEST_BLOCKERS.examBlocker
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe('Fall Final Exams');
      expect(body.meta.conflictingEvents).toBeDefined();
    });

    it('returns 400 for invalid data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/schools/${TEST_SCHOOL.id}/blockers`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: { ...TEST_BLOCKERS.examBlocker, name: '' }
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 403 for VIEWER role', async () => {
      const viewerToken = await getTestAuthToken({ ...TEST_USER, role: 'VIEWER' });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/schools/${TEST_SCHOOL.id}/blockers`,
        headers: { authorization: `Bearer ${viewerToken}` },
        payload: TEST_BLOCKERS.examBlocker
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /schools/:schoolId/blockers', () => {
    it('returns paginated list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/schools/${TEST_SCHOOL.id}/blockers?page=1&limit=10`,
        headers: { authorization: `Bearer ${authToken}` }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeInstanceOf(Array);
      expect(body.meta.page).toBe(1);
      expect(body.meta.limit).toBe(10);
    });
  });

  describe('Authorization', () => {
    it('prevents access to other school blockers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/schools/other_school_id/blockers`,
        headers: { authorization: `Bearer ${authToken}` }
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
```

### UI Tests

Located in `frontend/src/pages/__tests__/BlockersPage.test.tsx`

Uses Playwright for E2E testing.

```typescript
// frontend/e2e/blockers.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Blockers Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to blockers
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'coach@lincoln.edu');
    await page.fill('[data-testid="password"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL(/\/schools\/.*\/dashboard/);
    await page.goto(`/schools/${TEST_SCHOOL.id}/blockers`);
  });

  test('displays blockers list', async ({ page }) => {
    await expect(page.locator('[data-testid="blockers-list"]')).toBeVisible();
  });

  test('creates new blocker', async ({ page }) => {
    await page.click('[data-testid="create-blocker-button"]');
    await expect(page.locator('[data-testid="blocker-form"]')).toBeVisible();

    await page.selectOption('[data-testid="blocker-type"]', 'EXAM');
    await page.fill('[data-testid="blocker-name"]', 'Spring Finals');
    await page.click('[data-testid="scope-school-wide"]');
    await page.fill('[data-testid="start-datetime"]', '2026-05-15T00:00');
    await page.fill('[data-testid="end-datetime"]', '2026-05-19T23:59');

    await page.click('[data-testid="submit-blocker"]');

    // Should show success and conflict count
    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible();
    await expect(page.locator('text=Spring Finals')).toBeVisible();
  });

  test('shows validation error for invalid dates', async ({ page }) => {
    await page.click('[data-testid="create-blocker-button"]');

    await page.fill('[data-testid="blocker-name"]', 'Invalid Blocker');
    await page.fill('[data-testid="start-datetime"]', '2026-05-20T00:00');
    await page.fill('[data-testid="end-datetime"]', '2026-05-15T00:00'); // end before start

    await page.click('[data-testid="submit-blocker"]');

    await expect(page.locator('text=End datetime must be after start')).toBeVisible();
  });

  test('deletes blocker with confirmation', async ({ page }) => {
    // Find a blocker and delete it
    await page.click('[data-testid="blocker-menu-button"]');
    await page.click('[data-testid="delete-blocker"]');

    // Confirmation dialog
    await expect(page.locator('[data-testid="confirm-delete-dialog"]')).toBeVisible();
    await page.click('[data-testid="confirm-delete"]');

    await expect(page.locator('[data-testid="success-toast"]')).toContainText('deleted');
  });
});
```

---

## Linear Lifecycle

### Ticket: Implement Blockers & Constraints (TRD-001)

**Tasks:**

- [ ] Create Linear issue for TRD-001 implementation
- [ ] Move to "In Progress" when starting implementation
- [ ] Subtasks:
  - [ ] Database migration
  - [ ] Blocker service implementation
  - [ ] API routes
  - [ ] Frontend components
  - [ ] Unit tests
  - [ ] Integration tests
  - [ ] E2E tests
- [ ] Move to "Review" when code complete
- [ ] Move to "Done" when merged to main

### Verification Gates

| Step | Verification |
|------|--------------|
| Migration run | SQL queries confirm tables, enums, indexes exist |
| Service created | Unit tests pass |
| Routes created | Integration tests pass |
| Frontend created | E2E tests pass |
| PR merged | All CI checks green |

---

## Deliverables Checklist

### Backend

- [ ] Prisma schema update with Blocker model
- [ ] Migration file (verified with SQL checks)
- [ ] `BlockerService` with full CRUD + conflict counting
- [ ] Blocker API routes with authorization
- [ ] Zod validation schemas (create, update, query)
- [ ] Unit tests (`schemas.test.ts`, `service.test.ts`)
- [ ] Integration tests (`routes.test.ts`)

### Frontend

- [ ] `BlockerTypeIcon.tsx` - Icon mapping
- [ ] `BlockerBadge.tsx` - Type badge component
- [ ] `BlockerCard.tsx` - List item component
- [ ] `BlockerForm.tsx` - Create/edit modal
- [ ] `BlockersPage.tsx` - Main page
- [ ] `useBlockers.ts` - TanStack Query hooks
- [ ] `blockers.ts` - API client
- [ ] E2E tests (`blockers.spec.ts`)

### Documentation

- [ ] Update CLAUDE.md with blocker module conventions
- [ ] API documentation in OpenAPI format (optional)
