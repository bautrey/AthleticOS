# TRD-006: In-App Feedback System

> Status: Draft
> PRD: [PRD-002 (F7)](../prd/v2-athletic-operations.md#f7-in-app-feature-request-and-bug-report-system)
> Created: 2026-02-19
> Last Updated: 2026-02-19

## Overview

### Problem

Coaches are the primary users of AthleticOS and will encounter bugs and have ideas for improvements. Without a structured feedback channel, these go to text messages, get mentioned in passing, or get forgotten entirely. There is no way to capture, triage, and track feature requests and bug reports from within the product.

### Solution

A simple in-app feedback system with a persistent "Feedback" button accessible from every page. Any authenticated user can submit a feature request, bug report, or general feedback. Admins see a triage queue with status workflow. The system auto-captures the submitter's identity and the page URL where they submitted.

This is a quick win -- estimated at 1 person-week. No complex integrations, no external services, no background jobs.

### Relationship to Existing System

- **Leverages** existing authentication system for user identity
- **Leverages** existing school-scoped patterns (SchoolUser, multi-tenancy)
- **No dependencies** on other v2 features -- can be built in parallel
- **Foundation** for future GitHub Issues integration (auto-forward feedback)

## Execution Environment

- **Branch**: `feature/feedback-system`
- **Working Directory**: `/Users/burkestudio/projects/AthleticOS`
- **Required Skills**: Backend (Fastify/Prisma), Frontend (React/TanStack Query)
- **Prerequisites**:
  - Docker containers running (`docker compose up`)
  - Database migrated to current state
  - Existing auth system functional

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Feedback scope | School-level (schoolId on Feedback) | Multi-tenant consistency; admins see their school's feedback only |
| Screenshot upload | Deferred to v2.1 | Keep v1 simple; text-only feedback is sufficient for launch |
| External integration | Deferred | Future: auto-create GitHub issue from feedback |
| Status workflow | Linear: new -> reviewed -> planned -> completed -> declined | Simple, matches PRD; no parallel states |
| Internal notes | Separate model (FeedbackNote) | Clean separation; supports multiple notes per feedback |
| Notification on submit | None for v1 | Admin checks the queue; no email overhead |

---

## Data Model

### Feedback Entity

```prisma
model Feedback {
  id          String         @id @default(cuid())
  schoolId    String         @map("school_id")
  submittedBy String         @map("submitted_by")

  type        FeedbackType
  title       String
  description String?
  status      FeedbackStatus @default(NEW)
  pageUrl     String?        @map("page_url")

  createdAt   DateTime       @default(now()) @map("created_at")
  updatedAt   DateTime       @updatedAt @map("updated_at")

  school      School         @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  submitter   User           @relation(fields: [submittedBy], references: [id], onDelete: Cascade)
  notes       FeedbackNote[]

  @@index([schoolId])
  @@index([status])
  @@index([submittedBy])
  @@map("feedback")
}

model FeedbackNote {
  id         String   @id @default(cuid())
  feedbackId String   @map("feedback_id")
  authorId   String   @map("author_id")
  content    String
  createdAt  DateTime @default(now()) @map("created_at")

  feedback   Feedback @relation(fields: [feedbackId], references: [id], onDelete: Cascade)
  author     User     @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([feedbackId])
  @@map("feedback_notes")
}

enum FeedbackType {
  FEATURE_REQUEST
  BUG_REPORT
  OTHER
}

enum FeedbackStatus {
  NEW
  REVIEWED
  PLANNED
  COMPLETED
  DECLINED
}
```

### Relationships

Add to existing models:

```prisma
model School {
  // ... existing fields
  feedback    Feedback[]
}

model User {
  // ... existing fields
  feedback       Feedback[]
  feedbackNotes  FeedbackNote[]
}
```

---

## API Endpoints

Base URL: `/api/v1`

All endpoints require authentication via JWT.

### Submit Feedback

```
POST /api/v1/schools/:schoolId/feedback
```

Any authenticated user (ADMIN, COACH, VIEWER) can submit.

**Request body:**
```json
{
  "type": "FEATURE_REQUEST",
  "title": "Add calendar export to Google Calendar",
  "description": "It would be helpful to sync the team schedule with my personal Google Calendar so I can see conflicts with personal commitments.",
  "pageUrl": "/schools/clx.../seasons/clx.../calendar"
}
```

**Validation:**
| Field | Rules |
|-------|-------|
| `type` | Required, valid FeedbackType enum |
| `title` | Required, 1-200 chars |
| `description` | Optional, max 2000 chars |
| `pageUrl` | Optional, max 500 chars |

**Response (201 Created):**
```json
{
  "data": {
    "id": "clx...",
    "type": "FEATURE_REQUEST",
    "title": "Add calendar export to Google Calendar",
    "description": "...",
    "status": "NEW",
    "pageUrl": "/schools/clx.../seasons/clx.../calendar",
    "submittedBy": "clx...",
    "createdAt": "2026-02-19T10:00:00Z",
    "submitter": {
      "id": "clx...",
      "email": "coach@tca.edu"
    }
  }
}
```

### List Feedback (Admin)

```
GET /api/v1/schools/:schoolId/feedback
```

ADMIN only. Returns all feedback for the school with filtering and pagination.

**Query parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | enum | Filter by feedback type |
| `status` | enum | Filter by status |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 25, max: 100) |
| `sortBy` | string | Sort field: `createdAt` (default), `updatedAt`, `status` |
| `sortOrder` | string | `asc` or `desc` (default: `desc`) |

**Response:**
```json
{
  "data": [
    {
      "id": "clx...",
      "type": "BUG_REPORT",
      "title": "Calendar shows wrong date for away games",
      "description": "...",
      "status": "NEW",
      "pageUrl": "/schools/clx.../seasons/clx.../calendar",
      "submittedBy": "clx...",
      "createdAt": "2026-02-19T10:00:00Z",
      "submitter": {
        "id": "clx...",
        "email": "coach@tca.edu"
      },
      "_count": {
        "notes": 0
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 25,
    "total": 12,
    "totalPages": 1
  }
}
```

### Get Single Feedback (Admin)

```
GET /api/v1/schools/:schoolId/feedback/:id
```

ADMIN only. Returns feedback with all notes.

**Response:**
```json
{
  "data": {
    "id": "clx...",
    "type": "BUG_REPORT",
    "title": "Calendar shows wrong date for away games",
    "description": "...",
    "status": "REVIEWED",
    "pageUrl": "/schools/clx.../seasons/clx.../calendar",
    "submittedBy": "clx...",
    "createdAt": "2026-02-19T10:00:00Z",
    "submitter": {
      "id": "clx...",
      "email": "coach@tca.edu"
    },
    "notes": [
      {
        "id": "clx...",
        "content": "Confirmed: timezone conversion issue. Will fix in next release.",
        "authorId": "clx...",
        "createdAt": "2026-02-20T09:00:00Z",
        "author": { "email": "admin@tca.edu" }
      }
    ]
  }
}
```

### Update Feedback Status (Admin)

```
PATCH /api/v1/schools/:schoolId/feedback/:id
```

ADMIN only. Update status (triage workflow).

**Request body:**
```json
{
  "status": "REVIEWED"
}
```

**Validation:**
| Field | Rules |
|-------|-------|
| `status` | Required, valid FeedbackStatus enum |

**Response (200):**
```json
{
  "data": { "...updated feedback..." }
}
```

### Add Internal Note (Admin)

```
POST /api/v1/schools/:schoolId/feedback/:id/notes
```

ADMIN only.

**Request body:**
```json
{
  "content": "Confirmed: this is a timezone conversion issue. Will fix in next sprint."
}
```

**Validation:**
| Field | Rules |
|-------|-------|
| `content` | Required, 1-2000 chars |

**Response (201 Created):**
```json
{
  "data": {
    "id": "clx...",
    "content": "Confirmed: this is a timezone conversion issue...",
    "authorId": "clx...",
    "createdAt": "2026-02-20T09:00:00Z",
    "author": { "email": "admin@tca.edu" }
  }
}
```

### My Feedback (Any user)

```
GET /api/v1/schools/:schoolId/feedback/mine
```

Returns the current user's own feedback submissions. Lets users check on status of their submissions.

**Query parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 25) |

**Response:** Same shape as list, but filtered to current user's submissions. Does NOT include internal notes.

---

## Zod Schemas

```typescript
// backend/src/modules/feedback/schemas.ts

import { z } from 'zod';

export const FeedbackType = z.enum(['FEATURE_REQUEST', 'BUG_REPORT', 'OTHER']);
export const FeedbackStatus = z.enum(['NEW', 'REVIEWED', 'PLANNED', 'COMPLETED', 'DECLINED']);

export const createFeedbackSchema = z.object({
  type: FeedbackType,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  pageUrl: z.string().max(500).optional().nullable()
});

export const updateFeedbackSchema = z.object({
  status: FeedbackStatus
});

export const createFeedbackNoteSchema = z.object({
  content: z.string().min(1).max(2000)
});

export const feedbackQuerySchema = z.object({
  type: FeedbackType.optional(),
  status: FeedbackStatus.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  sortBy: z.enum(['createdAt', 'updatedAt', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const myFeedbackQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25)
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
export type UpdateFeedbackInput = z.infer<typeof updateFeedbackSchema>;
export type CreateFeedbackNoteInput = z.infer<typeof createFeedbackNoteSchema>;
export type FeedbackQuery = z.infer<typeof feedbackQuerySchema>;
export type MyFeedbackQuery = z.infer<typeof myFeedbackQuerySchema>;
```

---

## Service Layer

```typescript
// backend/src/modules/feedback/service.ts

import { Feedback, FeedbackNote, Prisma } from '@prisma/client';
import { prisma } from '../../common/db';
import { NotFoundError } from '../../common/errors';
import {
  CreateFeedbackInput,
  UpdateFeedbackInput,
  CreateFeedbackNoteInput,
  FeedbackQuery,
  MyFeedbackQuery
} from './schemas';

interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class FeedbackService {
  /**
   * Submit new feedback
   */
  async create(
    schoolId: string,
    data: CreateFeedbackInput,
    userId: string
  ): Promise<Feedback> {
    return prisma.feedback.create({
      data: {
        ...data,
        schoolId,
        submittedBy: userId
      },
      include: {
        submitter: { select: { id: true, email: true } }
      }
    });
  }

  /**
   * List all feedback for a school (admin view)
   */
  async list(schoolId: string, query: FeedbackQuery): Promise<PaginatedResult<Feedback>> {
    const { page, limit, type, status, sortBy, sortOrder } = query;

    const where: Prisma.FeedbackWhereInput = {
      schoolId,
      ...(type && { type }),
      ...(status && { status })
    };

    const [feedback, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          submitter: { select: { id: true, email: true } },
          _count: { select: { notes: true } }
        }
      }),
      prisma.feedback.count({ where })
    ]);

    return {
      data: feedback,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  /**
   * Get single feedback with notes (admin view)
   */
  async getById(schoolId: string, id: string): Promise<Feedback> {
    const feedback = await prisma.feedback.findFirst({
      where: { id, schoolId },
      include: {
        submitter: { select: { id: true, email: true } },
        notes: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { id: true, email: true } }
          }
        }
      }
    });

    if (!feedback) {
      throw new NotFoundError('Feedback not found');
    }

    return feedback;
  }

  /**
   * Update feedback status (admin triage)
   */
  async updateStatus(
    schoolId: string,
    id: string,
    data: UpdateFeedbackInput
  ): Promise<Feedback> {
    await this.getById(schoolId, id); // verify exists

    return prisma.feedback.update({
      where: { id },
      data: { status: data.status },
      include: {
        submitter: { select: { id: true, email: true } }
      }
    });
  }

  /**
   * Add internal note to feedback (admin only)
   */
  async addNote(
    schoolId: string,
    feedbackId: string,
    data: CreateFeedbackNoteInput,
    userId: string
  ): Promise<FeedbackNote> {
    await this.getById(schoolId, feedbackId); // verify exists

    return prisma.feedbackNote.create({
      data: {
        feedbackId,
        authorId: userId,
        content: data.content
      },
      include: {
        author: { select: { id: true, email: true } }
      }
    });
  }

  /**
   * Get current user's feedback submissions
   */
  async listMine(
    schoolId: string,
    userId: string,
    query: MyFeedbackQuery
  ): Promise<PaginatedResult<Feedback>> {
    const { page, limit } = query;

    const where: Prisma.FeedbackWhereInput = {
      schoolId,
      submittedBy: userId
    };

    const [feedback, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          submitter: { select: { id: true, email: true } }
          // No notes included for non-admin view
        }
      }),
      prisma.feedback.count({ where })
    ]);

    return {
      data: feedback,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }
}

export const feedbackService = new FeedbackService();
```

---

## Routes

```typescript
// backend/src/modules/feedback/routes.ts

import { FastifyInstance } from 'fastify';
import { feedbackService } from './service';
import {
  createFeedbackSchema,
  updateFeedbackSchema,
  createFeedbackNoteSchema,
  feedbackQuerySchema,
  myFeedbackQuerySchema,
  CreateFeedbackInput,
  UpdateFeedbackInput,
  CreateFeedbackNoteInput,
  FeedbackQuery,
  MyFeedbackQuery
} from './schemas';
import { authenticate, authorize } from '../../common/middleware/auth';

interface SchoolParams {
  schoolId: string;
}

interface FeedbackParams extends SchoolParams {
  id: string;
}

export async function feedbackRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  // Submit feedback (any authenticated user)
  fastify.post<{ Params: SchoolParams; Body: CreateFeedbackInput }>(
    '/schools/:schoolId/feedback',
    {
      preHandler: [authorize(['ADMIN', 'COACH', 'VIEWER'])]
    },
    async (request, reply) => {
      const data = createFeedbackSchema.parse(request.body);
      const feedback = await feedbackService.create(
        request.params.schoolId,
        data,
        request.user!.id
      );
      reply.status(201);
      return { data: feedback };
    }
  );

  // My feedback (any authenticated user)
  fastify.get<{ Params: SchoolParams; Querystring: MyFeedbackQuery }>(
    '/schools/:schoolId/feedback/mine',
    {
      preHandler: [authorize(['ADMIN', 'COACH', 'VIEWER'])]
    },
    async (request) => {
      const query = myFeedbackQuerySchema.parse(request.query);
      return await feedbackService.listMine(
        request.params.schoolId,
        request.user!.id,
        query
      );
    }
  );

  // List all feedback (admin only)
  fastify.get<{ Params: SchoolParams; Querystring: FeedbackQuery }>(
    '/schools/:schoolId/feedback',
    {
      preHandler: [authorize(['ADMIN'])]
    },
    async (request) => {
      const query = feedbackQuerySchema.parse(request.query);
      return await feedbackService.list(request.params.schoolId, query);
    }
  );

  // Get single feedback with notes (admin only)
  fastify.get<{ Params: FeedbackParams }>(
    '/schools/:schoolId/feedback/:id',
    {
      preHandler: [authorize(['ADMIN'])]
    },
    async (request) => {
      const feedback = await feedbackService.getById(
        request.params.schoolId,
        request.params.id
      );
      return { data: feedback };
    }
  );

  // Update feedback status (admin only)
  fastify.patch<{ Params: FeedbackParams; Body: UpdateFeedbackInput }>(
    '/schools/:schoolId/feedback/:id',
    {
      preHandler: [authorize(['ADMIN'])]
    },
    async (request) => {
      const data = updateFeedbackSchema.parse(request.body);
      const feedback = await feedbackService.updateStatus(
        request.params.schoolId,
        request.params.id,
        data
      );
      return { data: feedback };
    }
  );

  // Add internal note (admin only)
  fastify.post<{ Params: FeedbackParams; Body: CreateFeedbackNoteInput }>(
    '/schools/:schoolId/feedback/:id/notes',
    {
      preHandler: [authorize(['ADMIN'])]
    },
    async (request, reply) => {
      const data = createFeedbackNoteSchema.parse(request.body);
      const note = await feedbackService.addNote(
        request.params.schoolId,
        request.params.id,
        data,
        request.user!.id
      );
      reply.status(201);
      return { data: note };
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
│   └── feedback/
│       ├── FeedbackButton.tsx          # Persistent button in nav (all pages)
│       ├── FeedbackModal.tsx           # Submit feedback modal form
│       ├── FeedbackStatusBadge.tsx     # Status badge with color coding
│       ├── FeedbackTypeBadge.tsx       # Type badge (feature/bug/other)
│       ├── FeedbackCard.tsx            # List item for admin queue
│       ├── FeedbackDetail.tsx          # Detail view with notes (admin)
│       └── FeedbackNoteForm.tsx        # Add internal note form
├── pages/
│   └── FeedbackPage.tsx               # Admin feedback queue page
├── hooks/
│   └── useFeedback.ts                 # TanStack Query hooks
└── api/
    └── feedback.ts                    # API client functions
```

### FeedbackButton

Persistent in the navigation bar (Layout component), visible on every page.

```typescript
// Renders a small "Feedback" button with a megaphone/chat icon
// Positioned in the sidebar or top-right of navigation
// Clicking opens FeedbackModal
// Auto-captures current page URL via window.location.pathname
```

### FeedbackModal

Modal dialog for submitting feedback:
- Type radio buttons: Feature Request, Bug Report, Other
- Title text input (required, max 200 chars)
- Description textarea (optional, max 2000 chars)
- Page URL auto-filled (read-only, shown as context)
- Submit button with loading state
- Success confirmation: "Thanks for your feedback! We'll review it soon."
- Client-side validation with Zod schemas

### FeedbackPage (Admin)

Route: `/schools/:schoolId/feedback`

Features:
- Table/list view of all feedback submissions
- Filter tabs: All, New, Reviewed, Planned, Completed, Declined
- Filter dropdown by type (Feature Request, Bug Report, Other)
- Sort by date (newest first default) or status
- Each row shows: type badge, title, submitter email, date, status badge, note count
- Click row to expand FeedbackDetail inline or navigate to detail
- Status counts in header: "12 New, 3 Reviewed, 5 Planned"

### FeedbackDetail (Admin)

Expanded view within FeedbackPage:
- Full description text
- Status dropdown for triage (NEW -> REVIEWED -> PLANNED -> COMPLETED / DECLINED)
- Page URL shown as link
- Submitter info
- Internal notes timeline (chronological)
- FeedbackNoteForm at bottom to add new note

### FeedbackStatusBadge

Color-coded status badges:
- NEW: gray
- REVIEWED: blue
- PLANNED: purple
- COMPLETED: green
- DECLINED: red

### FeedbackTypeBadge

Type badges with icons:
- FEATURE_REQUEST: lightbulb icon, indigo
- BUG_REPORT: bug icon, red
- OTHER: chat icon, gray

### Hooks

```typescript
// frontend/src/hooks/useFeedback.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { feedbackApi } from '../api/feedback';

export function useFeedbackList(schoolId: string, query?: Partial<FeedbackQuery>) {
  return useQuery({
    queryKey: ['feedback', schoolId, query],
    queryFn: () => feedbackApi.list(schoolId, query)
  });
}

export function useFeedbackDetail(schoolId: string, id: string) {
  return useQuery({
    queryKey: ['feedback', schoolId, id],
    queryFn: () => feedbackApi.getById(schoolId, id),
    enabled: !!id
  });
}

export function useMyFeedback(schoolId: string) {
  return useQuery({
    queryKey: ['feedback', schoolId, 'mine'],
    queryFn: () => feedbackApi.listMine(schoolId)
  });
}

export function useCreateFeedback(schoolId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFeedbackInput) => feedbackApi.create(schoolId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback', schoolId] });
    }
  });
}

export function useUpdateFeedbackStatus(schoolId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      feedbackApi.updateStatus(schoolId, id, { status }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['feedback', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['feedback', schoolId, id] });
    }
  });
}

export function useAddFeedbackNote(schoolId: string, feedbackId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { content: string }) =>
      feedbackApi.addNote(schoolId, feedbackId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback', schoolId, feedbackId] });
    }
  });
}
```

---

## Migration

```sql
-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('FEATURE_REQUEST', 'BUG_REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'REVIEWED', 'PLANNED', 'COMPLETED', 'DECLINED');

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "submitted_by" TEXT NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "page_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_school_id_idx" ON "feedback"("school_id");

-- CreateIndex
CREATE INDEX "feedback_status_idx" ON "feedback"("status");

-- CreateIndex
CREATE INDEX "feedback_submitted_by_idx" ON "feedback"("submitted_by");

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_submitted_by_fkey"
  FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "feedback_notes" (
    "id" TEXT NOT NULL,
    "feedback_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_notes_feedback_id_idx" ON "feedback_notes"("feedback_id");

-- AddForeignKey
ALTER TABLE "feedback_notes" ADD CONSTRAINT "feedback_notes_feedback_id_fkey"
  FOREIGN KEY ("feedback_id") REFERENCES "feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_notes" ADD CONSTRAINT "feedback_notes_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

---

## Master Task List

### Sprint 1 Tasks

| # | Task | Estimate | Dependencies | Status |
|---|------|----------|-------------|--------|
| 1 | Prisma schema: add Feedback, FeedbackNote models, enums | 1h | None | [] |
| 2 | Run migration, verify tables and indexes | 0.5h | Task 1 | [] |
| 3 | Zod schemas: createFeedback, updateFeedback, createNote, queries | 1h | None | [] |
| 4 | FeedbackService: create, list, getById | 1.5h | Tasks 1, 3 | [] |
| 5 | FeedbackService: updateStatus, addNote, listMine | 1.5h | Task 4 | [] |
| 6 | Unit tests: schema validation (schemas.test.ts) | 0.5h | Task 3 | [] |
| 7 | Unit tests: service logic (service.test.ts) | 1.5h | Tasks 4, 5 | [] |
| 8 | API routes: all feedback endpoints | 2h | Tasks 4, 5 | [] |
| 9 | Integration tests: route tests (routes.test.ts) | 1.5h | Task 8 | [] |
| 10 | API client: feedback.ts | 0.5h | Task 8 | [] |
| 11 | TanStack Query hooks: useFeedback.ts | 0.5h | Task 10 | [] |
| 12 | FeedbackButton component (persistent nav button) | 1h | None | [] |
| 13 | FeedbackModal component (submit form) | 2h | Task 11 | [] |
| 14 | FeedbackStatusBadge + FeedbackTypeBadge components | 0.5h | None | [] |
| 15 | FeedbackCard component (list item) | 1h | Task 14 | [] |
| 16 | FeedbackDetail component (detail with notes) | 2h | Task 15 | [] |
| 17 | FeedbackNoteForm component | 0.5h | Task 11 | [] |
| 18 | FeedbackPage (admin queue with filters) | 2h | Tasks 15, 16 | [] |
| 19 | Integrate FeedbackButton into Layout component | 0.5h | Tasks 12, 13 | [] |
| 20 | Add FeedbackPage to router and sidebar nav (admin only) | 0.5h | Task 18 | [] |
| 21 | E2E tests: submit feedback, admin triage workflow | 2h | Tasks 19, 20 | [] |

**Total Estimate: ~21 hours (approx. 3 person-days)**

---

## Sprint Planning

### Phase 1: Backend (Tasks 1-9) -- Day 1

**Day 1:**
- Task 1: Schema + Task 2: Migration (1.5h)
- Task 3: Zod schemas (1h)
- Task 4: Service create/list/getById (1.5h)
- Task 5: Service updateStatus/addNote/listMine (1.5h)
- Task 6: Schema tests (0.5h)
- Task 7: Service tests (1.5h)
- Task 8: Routes (2h)
- Task 9: Route tests (1.5h)

### Phase 2: Frontend (Tasks 10-21) -- Days 2-3

**Day 2:**
- Task 10: API client (0.5h)
- Task 11: Hooks (0.5h)
- Task 12: FeedbackButton (1h)
- Task 13: FeedbackModal (2h)
- Task 14: Badge components (0.5h)
- Task 15: FeedbackCard (1h)
- Task 16: FeedbackDetail (2h)

**Day 3:**
- Task 17: FeedbackNoteForm (0.5h)
- Task 18: FeedbackPage (2h)
- Task 19: Layout integration (0.5h)
- Task 20: Router + nav (0.5h)
- Task 21: E2E tests (2h)

---

## Testing Strategy

### Unit Tests (Vitest)

**Schema Validation (schemas.test.ts)**
- Accepts valid feature request
- Accepts valid bug report
- Rejects empty title
- Rejects title over 200 chars
- Rejects description over 2000 chars
- Accepts valid status transitions
- Rejects invalid FeedbackType
- Rejects invalid FeedbackStatus

**Service Logic (service.test.ts)**
- Creates feedback with correct schoolId and submittedBy
- Lists feedback with type filter
- Lists feedback with status filter
- Sorts by createdAt desc by default
- Returns feedback with notes for getById
- Updates status from NEW to REVIEWED
- Adds note to feedback
- listMine returns only current user's feedback
- Throws NotFoundError for non-existent feedback
- Tenant isolation: cannot access other school's feedback

### Integration Tests (routes.test.ts)

- POST creates feedback with 201 (any authenticated user)
- POST returns 401 for unauthenticated request
- GET list returns 403 for COACH (admin only)
- GET list returns paginated results for ADMIN
- GET list filters by type and status
- GET /:id returns feedback with notes (admin)
- PATCH updates status (admin)
- POST /notes adds note (admin)
- GET /mine returns current user's submissions

### E2E Tests (Playwright)

- Click Feedback button from any page
- Fill and submit feature request
- See success confirmation
- Admin navigates to feedback queue
- Admin filters by type and status
- Admin clicks feedback and sees detail
- Admin changes status from NEW to REVIEWED
- Admin adds internal note
- User checks "My Feedback" and sees their submission with updated status

---

## Acceptance Criteria

### US-F7-1: Submit Feature Request

- [x] "Feedback" button accessible from navigation bar on every page
- [x] Form with: type (feature request / bug report / other), title, description
- [x] Submission confirmation with "we'll review this" message
- [x] Submitter's user info and current page URL auto-attached
- [ ] Optional screenshot upload (deferred to v2.1)

### US-F7-2: View Feedback Queue

- [x] Admin-only view of all feedback submissions
- [x] Sortable by date, type, status
- [x] Status workflow: new, reviewed, planned, completed, declined
- [x] Can add internal notes

---

## Deliverables Checklist

### Backend

- [] Prisma schema update with Feedback and FeedbackNote models
- [] Migration file (verified with SQL checks)
- [] `FeedbackService` with full CRUD + notes
- [] Feedback API routes with authorization
- [] Zod validation schemas
- [] Unit tests (`schemas.test.ts`, `service.test.ts`)
- [] Integration tests (`routes.test.ts`)

### Frontend

- [] `FeedbackButton.tsx` - Persistent nav button
- [] `FeedbackModal.tsx` - Submit form
- [] `FeedbackStatusBadge.tsx` - Status badge
- [] `FeedbackTypeBadge.tsx` - Type badge
- [] `FeedbackCard.tsx` - List item
- [] `FeedbackDetail.tsx` - Detail view with notes
- [] `FeedbackNoteForm.tsx` - Add note form
- [] `FeedbackPage.tsx` - Admin queue page
- [] `useFeedback.ts` - TanStack Query hooks
- [] `feedback.ts` - API client
- [] Layout integration (FeedbackButton in nav)
- [] Router + sidebar nav entry
- [] E2E tests
