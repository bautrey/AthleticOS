# TRD-005: Priority Rules Engine

> Status: Draft
> PRD: [PRD-002 (F1)](../prd/v2-athletic-operations.md#f1-priority-rules-engine)
> Created: 2026-02-19
> Last Updated: 2026-02-19

## Overview

### Problem

When multiple teams request the same facility at the same time, there are no codified rules for who gets priority. Decisions depend on institutional knowledge held by individuals -- knowledge that leaves when those individuals leave. TCA lost both its AD and coordinator, and the priority rules left with them.

### Solution

A configurable priority rules engine at the school level that assigns numeric priority scores to events based on team level (Varsity > JV > Freshman), season status (in-season > off-season), and event type (Game > Practice). When facility conflicts are detected, the system displays priority comparisons with human-readable explanations and suggests which event should yield. Consistent with v1's "warn, don't block" philosophy, coaches can still override.

### Relationship to Existing System

- **Leverages** existing `TeamLevel` enum (VARSITY, JV, FRESHMAN) from the Team model
- **Leverages** existing `Season` model with `startDate`/`endDate` for in-season determination
- **Leverages** existing `Game`/`Practice` models with `EventType` enum
- **Extends** existing conflict detection system (TRD-002) with priority-aware suggestions
- **Extends** existing reconciliation UI (TRD-003) with priority comparison display

## Execution Environment

- **Branch**: `feature/priority-rules-engine`
- **Working Directory**: `/Users/burkestudio/projects/AthleticOS`
- **Required Skills**: Backend (Fastify/Prisma), Frontend (React/TanStack Query)
- **Prerequisites**:
  - Docker containers running (`docker compose up`)
  - Database migrated to current state (TRD-001 through TRD-004 complete)
  - Existing conflict detection service functional

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Score model | Weighted sum of factors | Simple, transparent, easy to explain to non-technical users |
| Default weights | teamLevel: 30, seasonStatus: 25, eventType: 25, homeAway: 20 | Balanced starting point; school can customize |
| Per-facility overrides | Optional JSON on PriorityRule | Some facilities may have different rules (e.g., shared gym vs dedicated field) |
| Audit trail | PriorityRuleAudit model | PRD requires logging who changed what and when |
| Score range | 0-100 | Normalized, easy to compare and explain |
| Tie-breaking | Earlier-created event wins | Deterministic; first-come-first-served for equal priority |

---

## Data Model

### PriorityRule Entity

```prisma
model PriorityRule {
  id        String   @id @default(cuid())
  schoolId  String   @unique @map("school_id")

  // Weights (0-100, must sum to 100)
  teamLevelWeight    Int @default(30) @map("team_level_weight")
  seasonStatusWeight Int @default(25) @map("season_status_weight")
  eventTypeWeight    Int @default(25) @map("event_type_weight")
  homeAwayWeight     Int @default(20) @map("home_away_weight")

  // Per-factor scores (JSON objects mapping enum values to scores 0-100)
  // Default: { "VARSITY": 100, "JV": 60, "FRESHMAN": 30 }
  teamLevelScores    Json @default("{\"VARSITY\":100,\"JV\":60,\"FRESHMAN\":30}") @map("team_level_scores")
  // Default: { "IN_SEASON": 100, "OFF_SEASON": 30 }
  seasonStatusScores Json @default("{\"IN_SEASON\":100,\"OFF_SEASON\":30}") @map("season_status_scores")
  // Default: { "GAME": 100, "PRACTICE": 40 }
  eventTypeScores    Json @default("{\"GAME\":100,\"PRACTICE\":40}") @map("event_type_scores")
  // Default: { "HOME": 100, "AWAY": 20, "NEUTRAL": 50 }
  homeAwayScores     Json @default("{\"HOME\":100,\"AWAY\":20,\"NEUTRAL\":50}") @map("home_away_scores")

  // Facility-specific overrides (optional)
  // JSON: { "facilityId": { ...same weight/score structure } }
  facilityOverrides  Json @default("{}") @map("facility_overrides")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  school    School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  audits    PriorityRuleAudit[]

  @@map("priority_rules")
}

model PriorityRuleAudit {
  id             String   @id @default(cuid())
  priorityRuleId String   @map("priority_rule_id")
  changedBy      String   @map("changed_by")
  changedAt      DateTime @default(now()) @map("changed_at")
  fieldChanged   String   @map("field_changed")
  oldValue       Json     @map("old_value")
  newValue       Json     @map("new_value")

  priorityRule   PriorityRule @relation(fields: [priorityRuleId], references: [id], onDelete: Cascade)

  @@index([priorityRuleId])
  @@map("priority_rule_audits")
}
```

### Relationships

Add to existing models:

```prisma
model School {
  // ... existing fields
  priorityRule PriorityRule?
}
```

---

## API Endpoints

Base URL: `/api/v1`

All endpoints require authentication via JWT. School context derived from route parameter.

### Get Priority Rules

```
GET /api/v1/schools/:schoolId/priority-rules
```

Returns the school's priority rules configuration. If none exists, returns defaults.

**Response:**
```json
{
  "data": {
    "id": "clx...",
    "schoolId": "clx...",
    "teamLevelWeight": 30,
    "seasonStatusWeight": 25,
    "eventTypeWeight": 25,
    "homeAwayWeight": 20,
    "teamLevelScores": { "VARSITY": 100, "JV": 60, "FRESHMAN": 30 },
    "seasonStatusScores": { "IN_SEASON": 100, "OFF_SEASON": 30 },
    "eventTypeScores": { "GAME": 100, "PRACTICE": 40 },
    "homeAwayScores": { "HOME": 100, "AWAY": 20, "NEUTRAL": 50 },
    "facilityOverrides": {},
    "createdAt": "2026-02-19T10:00:00Z",
    "updatedAt": "2026-02-19T10:00:00Z"
  }
}
```

### Update Priority Rules

```
PUT /api/v1/schools/:schoolId/priority-rules
```

Creates or updates the school's priority rules. Creates audit entries for each changed field.

**Request body:**
```json
{
  "teamLevelWeight": 35,
  "seasonStatusWeight": 25,
  "eventTypeWeight": 25,
  "homeAwayWeight": 15,
  "teamLevelScores": { "VARSITY": 100, "JV": 50, "FRESHMAN": 20 },
  "seasonStatusScores": { "IN_SEASON": 100, "OFF_SEASON": 30 },
  "eventTypeScores": { "GAME": 100, "PRACTICE": 40 },
  "homeAwayScores": { "HOME": 100, "AWAY": 20, "NEUTRAL": 50 },
  "facilityOverrides": {}
}
```

**Validation:**
| Field | Rules |
|-------|-------|
| `*Weight` fields | Integer 0-100; all four must sum to 100 |
| `*Scores` fields | JSON objects with valid enum keys; values 0-100 |
| `facilityOverrides` | Optional JSON; facility IDs must belong to school |

**Response (200):**
```json
{
  "data": { "...updated rule..." },
  "meta": {
    "audits": [
      {
        "fieldChanged": "teamLevelWeight",
        "oldValue": 30,
        "newValue": 35
      }
    ]
  }
}
```

**Errors:**
- `400 VALIDATION_ERROR` - Weights don't sum to 100, invalid scores
- `403 FORBIDDEN` - User is not ADMIN

### Calculate Priority Score

```
POST /api/v1/schools/:schoolId/priority-rules/calculate
```

Calculates the priority score for a given event. Used internally by conflict detection and available for client-side preview.

**Request body:**
```json
{
  "teamLevel": "VARSITY",
  "seasonStatus": "IN_SEASON",
  "eventType": "GAME",
  "homeAway": "HOME",
  "facilityId": "clx..."
}
```

**Response:**
```json
{
  "data": {
    "score": 100,
    "breakdown": {
      "teamLevel": { "weight": 30, "factorScore": 100, "weighted": 30.0 },
      "seasonStatus": { "weight": 25, "factorScore": 100, "weighted": 25.0 },
      "eventType": { "weight": 25, "factorScore": 100, "weighted": 25.0 },
      "homeAway": { "weight": 20, "factorScore": 100, "weighted": 20.0 }
    },
    "explanation": "Varsity (in-season home game) -- highest priority"
  }
}
```

### Compare Event Priorities

```
POST /api/v1/schools/:schoolId/priority-rules/compare
```

Compares two events and returns priority recommendation. Used by conflict detection to enhance conflict warnings.

**Request body:**
```json
{
  "eventA": {
    "eventType": "GAME",
    "eventId": "clx...",
    "teamLevel": "VARSITY",
    "seasonStatus": "IN_SEASON",
    "homeAway": "HOME"
  },
  "eventB": {
    "eventType": "PRACTICE",
    "eventId": "clx...",
    "teamLevel": "JV",
    "seasonStatus": "OFF_SEASON",
    "homeAway": "HOME"
  },
  "facilityId": "clx..."
}
```

**Response:**
```json
{
  "data": {
    "eventA": { "score": 100, "breakdown": { "..." } },
    "eventB": { "score": 37, "breakdown": { "..." } },
    "winner": "eventA",
    "margin": 63,
    "explanation": "Varsity Basketball (in-season home game, score: 100) has priority over JV Soccer (off-season practice, score: 37)",
    "suggestion": "JV Soccer practice should find an alternative time slot"
  }
}
```

### Get Priority Rule Audit Log

```
GET /api/v1/schools/:schoolId/priority-rules/audits
```

**Query parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50, max: 100) |

**Response:**
```json
{
  "data": [
    {
      "id": "clx...",
      "changedBy": "clx...",
      "changedAt": "2026-02-19T10:00:00Z",
      "fieldChanged": "teamLevelWeight",
      "oldValue": 30,
      "newValue": 35,
      "changedByUser": { "email": "ad@tca.edu" }
    }
  ],
  "meta": { "page": 1, "limit": 50, "total": 3, "totalPages": 1 }
}
```

---

## Zod Schemas

```typescript
// backend/src/modules/priority-rules/schemas.ts

import { z } from 'zod';

const teamLevelScoresSchema = z.object({
  VARSITY: z.number().int().min(0).max(100),
  JV: z.number().int().min(0).max(100),
  FRESHMAN: z.number().int().min(0).max(100)
});

const seasonStatusScoresSchema = z.object({
  IN_SEASON: z.number().int().min(0).max(100),
  OFF_SEASON: z.number().int().min(0).max(100)
});

const eventTypeScoresSchema = z.object({
  GAME: z.number().int().min(0).max(100),
  PRACTICE: z.number().int().min(0).max(100)
});

const homeAwayScoresSchema = z.object({
  HOME: z.number().int().min(0).max(100),
  AWAY: z.number().int().min(0).max(100),
  NEUTRAL: z.number().int().min(0).max(100)
});

export const updatePriorityRulesSchema = z.object({
  teamLevelWeight: z.number().int().min(0).max(100),
  seasonStatusWeight: z.number().int().min(0).max(100),
  eventTypeWeight: z.number().int().min(0).max(100),
  homeAwayWeight: z.number().int().min(0).max(100),
  teamLevelScores: teamLevelScoresSchema,
  seasonStatusScores: seasonStatusScoresSchema,
  eventTypeScores: eventTypeScoresSchema,
  homeAwayScores: homeAwayScoresSchema,
  facilityOverrides: z.record(z.string(), z.object({
    teamLevelWeight: z.number().int().min(0).max(100).optional(),
    seasonStatusWeight: z.number().int().min(0).max(100).optional(),
    eventTypeWeight: z.number().int().min(0).max(100).optional(),
    homeAwayWeight: z.number().int().min(0).max(100).optional(),
    teamLevelScores: teamLevelScoresSchema.optional(),
    seasonStatusScores: seasonStatusScoresSchema.optional(),
    eventTypeScores: eventTypeScoresSchema.optional(),
    homeAwayScores: homeAwayScoresSchema.optional()
  })).optional().default({})
}).refine(
  data => data.teamLevelWeight + data.seasonStatusWeight + data.eventTypeWeight + data.homeAwayWeight === 100,
  { message: 'Weights must sum to 100', path: ['teamLevelWeight'] }
);

export const calculatePrioritySchema = z.object({
  teamLevel: z.enum(['VARSITY', 'JV', 'FRESHMAN']),
  seasonStatus: z.enum(['IN_SEASON', 'OFF_SEASON']),
  eventType: z.enum(['GAME', 'PRACTICE']),
  homeAway: z.enum(['HOME', 'AWAY', 'NEUTRAL']),
  facilityId: z.string().cuid().optional()
});

export const comparePrioritySchema = z.object({
  eventA: z.object({
    eventType: z.enum(['GAME', 'PRACTICE']),
    eventId: z.string().cuid(),
    teamLevel: z.enum(['VARSITY', 'JV', 'FRESHMAN']),
    seasonStatus: z.enum(['IN_SEASON', 'OFF_SEASON']),
    homeAway: z.enum(['HOME', 'AWAY', 'NEUTRAL'])
  }),
  eventB: z.object({
    eventType: z.enum(['GAME', 'PRACTICE']),
    eventId: z.string().cuid(),
    teamLevel: z.enum(['VARSITY', 'JV', 'FRESHMAN']),
    seasonStatus: z.enum(['IN_SEASON', 'OFF_SEASON']),
    homeAway: z.enum(['HOME', 'AWAY', 'NEUTRAL'])
  }),
  facilityId: z.string().cuid().optional()
});

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50)
});

export type UpdatePriorityRulesInput = z.infer<typeof updatePriorityRulesSchema>;
export type CalculatePriorityInput = z.infer<typeof calculatePrioritySchema>;
export type ComparePriorityInput = z.infer<typeof comparePrioritySchema>;
export type AuditQuery = z.infer<typeof auditQuerySchema>;
```

---

## Service Layer

```typescript
// backend/src/modules/priority-rules/service.ts

import { PriorityRule, Prisma } from '@prisma/client';
import { prisma } from '../../common/db';
import { NotFoundError } from '../../common/errors';
import {
  UpdatePriorityRulesInput,
  CalculatePriorityInput,
  ComparePriorityInput,
  AuditQuery
} from './schemas';

// Default configuration used when no PriorityRule exists for a school
const DEFAULTS = {
  teamLevelWeight: 30,
  seasonStatusWeight: 25,
  eventTypeWeight: 25,
  homeAwayWeight: 20,
  teamLevelScores: { VARSITY: 100, JV: 60, FRESHMAN: 30 },
  seasonStatusScores: { IN_SEASON: 100, OFF_SEASON: 30 },
  eventTypeScores: { GAME: 100, PRACTICE: 40 },
  homeAwayScores: { HOME: 100, AWAY: 20, NEUTRAL: 50 },
  facilityOverrides: {}
};

interface PriorityBreakdown {
  teamLevel: { weight: number; factorScore: number; weighted: number };
  seasonStatus: { weight: number; factorScore: number; weighted: number };
  eventType: { weight: number; factorScore: number; weighted: number };
  homeAway: { weight: number; factorScore: number; weighted: number };
}

interface PriorityResult {
  score: number;
  breakdown: PriorityBreakdown;
  explanation: string;
}

interface CompareResult {
  eventA: PriorityResult;
  eventB: PriorityResult;
  winner: 'eventA' | 'eventB' | 'tie';
  margin: number;
  explanation: string;
  suggestion: string;
}

export class PriorityRuleService {
  /**
   * Get priority rules for a school (returns defaults if none configured)
   */
  async get(schoolId: string): Promise<PriorityRule | typeof DEFAULTS & { id: null; schoolId: string }> {
    const rule = await prisma.priorityRule.findUnique({
      where: { schoolId }
    });

    if (!rule) {
      return { id: null, schoolId, ...DEFAULTS, createdAt: new Date(), updatedAt: new Date() } as any;
    }

    return rule;
  }

  /**
   * Create or update priority rules with audit trail
   */
  async upsert(
    schoolId: string,
    data: UpdatePriorityRulesInput,
    userId: string
  ): Promise<{ rule: PriorityRule; audits: Array<{ fieldChanged: string; oldValue: any; newValue: any }> }> {
    const existing = await prisma.priorityRule.findUnique({ where: { schoolId } });
    const audits: Array<{ fieldChanged: string; oldValue: any; newValue: any }> = [];

    // Build audit entries by comparing old vs new
    const oldValues = existing || DEFAULTS;
    const fieldsToAudit = [
      'teamLevelWeight', 'seasonStatusWeight', 'eventTypeWeight', 'homeAwayWeight',
      'teamLevelScores', 'seasonStatusScores', 'eventTypeScores', 'homeAwayScores',
      'facilityOverrides'
    ] as const;

    for (const field of fieldsToAudit) {
      const oldVal = (oldValues as any)[field];
      const newVal = (data as any)[field];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        audits.push({ fieldChanged: field, oldValue: oldVal, newValue: newVal });
      }
    }

    const rule = await prisma.priorityRule.upsert({
      where: { schoolId },
      update: { ...data },
      create: { schoolId, ...data }
    });

    // Create audit entries
    if (audits.length > 0) {
      await prisma.priorityRuleAudit.createMany({
        data: audits.map(a => ({
          priorityRuleId: rule.id,
          changedBy: userId,
          fieldChanged: a.fieldChanged,
          oldValue: a.oldValue,
          newValue: a.newValue
        }))
      });
    }

    return { rule, audits };
  }

  /**
   * Calculate priority score for an event
   */
  async calculate(schoolId: string, input: CalculatePriorityInput): Promise<PriorityResult> {
    const rule = await this.get(schoolId);

    // Check for facility-specific overrides
    let weights = {
      teamLevel: rule.teamLevelWeight,
      seasonStatus: rule.seasonStatusWeight,
      eventType: rule.eventTypeWeight,
      homeAway: rule.homeAwayWeight
    };
    let scores = {
      teamLevel: rule.teamLevelScores as Record<string, number>,
      seasonStatus: rule.seasonStatusScores as Record<string, number>,
      eventType: rule.eventTypeScores as Record<string, number>,
      homeAway: rule.homeAwayScores as Record<string, number>
    };

    if (input.facilityId) {
      const overrides = (rule.facilityOverrides as Record<string, any>)?.[input.facilityId];
      if (overrides) {
        weights = { ...weights, ...overrides };
        if (overrides.teamLevelScores) scores.teamLevel = overrides.teamLevelScores;
        if (overrides.seasonStatusScores) scores.seasonStatus = overrides.seasonStatusScores;
        if (overrides.eventTypeScores) scores.eventType = overrides.eventTypeScores;
        if (overrides.homeAwayScores) scores.homeAway = overrides.homeAwayScores;
      }
    }

    const breakdown: PriorityBreakdown = {
      teamLevel: {
        weight: weights.teamLevel,
        factorScore: scores.teamLevel[input.teamLevel] || 0,
        weighted: (weights.teamLevel / 100) * (scores.teamLevel[input.teamLevel] || 0)
      },
      seasonStatus: {
        weight: weights.seasonStatus,
        factorScore: scores.seasonStatus[input.seasonStatus] || 0,
        weighted: (weights.seasonStatus / 100) * (scores.seasonStatus[input.seasonStatus] || 0)
      },
      eventType: {
        weight: weights.eventType,
        factorScore: scores.eventType[input.eventType] || 0,
        weighted: (weights.eventType / 100) * (scores.eventType[input.eventType] || 0)
      },
      homeAway: {
        weight: weights.homeAway,
        factorScore: scores.homeAway[input.homeAway] || 0,
        weighted: (weights.homeAway / 100) * (scores.homeAway[input.homeAway] || 0)
      }
    };

    const score = Math.round(
      breakdown.teamLevel.weighted +
      breakdown.seasonStatus.weighted +
      breakdown.eventType.weighted +
      breakdown.homeAway.weighted
    );

    const explanation = this.buildExplanation(input, score);

    return { score, breakdown, explanation };
  }

  /**
   * Compare two events and recommend which has priority
   */
  async compare(schoolId: string, input: ComparePriorityInput): Promise<CompareResult> {
    const [resultA, resultB] = await Promise.all([
      this.calculate(schoolId, {
        teamLevel: input.eventA.teamLevel,
        seasonStatus: input.eventA.seasonStatus,
        eventType: input.eventA.eventType,
        homeAway: input.eventA.homeAway,
        facilityId: input.facilityId
      }),
      this.calculate(schoolId, {
        teamLevel: input.eventB.teamLevel,
        seasonStatus: input.eventB.seasonStatus,
        eventType: input.eventB.eventType,
        homeAway: input.eventB.homeAway,
        facilityId: input.facilityId
      })
    ]);

    const winner = resultA.score > resultB.score ? 'eventA' :
                   resultB.score > resultA.score ? 'eventB' : 'tie';
    const margin = Math.abs(resultA.score - resultB.score);

    const explanation = winner === 'tie'
      ? `Both events have equal priority (score: ${resultA.score})`
      : `${winner === 'eventA' ? 'Event A' : 'Event B'} has priority (${Math.max(resultA.score, resultB.score)} vs ${Math.min(resultA.score, resultB.score)})`;

    const loser = winner === 'eventA' ? 'Event B' : winner === 'eventB' ? 'Event A' : null;
    const suggestion = loser
      ? `${loser} should find an alternative time slot`
      : 'Both events have equal priority -- manual resolution recommended';

    return {
      eventA: resultA,
      eventB: resultB,
      winner,
      margin,
      explanation,
      suggestion
    };
  }

  /**
   * Get audit log for priority rule changes
   */
  async getAudits(schoolId: string, query: AuditQuery) {
    const rule = await prisma.priorityRule.findUnique({ where: { schoolId } });
    if (!rule) {
      return { data: [], meta: { page: query.page, limit: query.limit, total: 0, totalPages: 0 } };
    }

    const { page, limit } = query;
    const [audits, total] = await Promise.all([
      prisma.priorityRuleAudit.findMany({
        where: { priorityRuleId: rule.id },
        orderBy: { changedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.priorityRuleAudit.count({ where: { priorityRuleId: rule.id } })
    ]);

    return {
      data: audits,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  /**
   * Determine season status for a team at a given date
   */
  async getSeasonStatus(teamId: string, eventDate: Date): Promise<'IN_SEASON' | 'OFF_SEASON'> {
    const season = await prisma.season.findFirst({
      where: {
        teamId,
        startDate: { lte: eventDate },
        endDate: { gte: eventDate }
      }
    });
    return season ? 'IN_SEASON' : 'OFF_SEASON';
  }

  private buildExplanation(input: CalculatePriorityInput, score: number): string {
    const level = input.teamLevel.charAt(0) + input.teamLevel.slice(1).toLowerCase();
    const season = input.seasonStatus === 'IN_SEASON' ? 'in-season' : 'off-season';
    const event = input.eventType.toLowerCase();
    const home = input.homeAway.toLowerCase();
    return `${level} (${season} ${home} ${event}) -- priority score: ${score}`;
  }
}

export const priorityRuleService = new PriorityRuleService();
```

---

## Routes

```typescript
// backend/src/modules/priority-rules/routes.ts

import { FastifyInstance } from 'fastify';
import { priorityRuleService } from './service';
import {
  updatePriorityRulesSchema,
  calculatePrioritySchema,
  comparePrioritySchema,
  auditQuerySchema,
  UpdatePriorityRulesInput,
  CalculatePriorityInput,
  ComparePriorityInput,
  AuditQuery
} from './schemas';
import { authenticate, authorize } from '../../common/middleware/auth';

interface SchoolParams {
  schoolId: string;
}

export async function priorityRuleRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  // Get priority rules
  fastify.get<{ Params: SchoolParams }>(
    '/schools/:schoolId/priority-rules',
    {
      preHandler: [authorize(['ADMIN', 'COACH', 'VIEWER'])]
    },
    async (request) => {
      const rule = await priorityRuleService.get(request.params.schoolId);
      return { data: rule };
    }
  );

  // Update priority rules (ADMIN only)
  fastify.put<{ Params: SchoolParams; Body: UpdatePriorityRulesInput }>(
    '/schools/:schoolId/priority-rules',
    {
      preHandler: [authorize(['ADMIN'])]
    },
    async (request) => {
      const data = updatePriorityRulesSchema.parse(request.body);
      const result = await priorityRuleService.upsert(
        request.params.schoolId,
        data,
        request.user!.id
      );
      return { data: result.rule, meta: { audits: result.audits } };
    }
  );

  // Calculate priority score
  fastify.post<{ Params: SchoolParams; Body: CalculatePriorityInput }>(
    '/schools/:schoolId/priority-rules/calculate',
    {
      preHandler: [authorize(['ADMIN', 'COACH'])]
    },
    async (request) => {
      const input = calculatePrioritySchema.parse(request.body);
      const result = await priorityRuleService.calculate(request.params.schoolId, input);
      return { data: result };
    }
  );

  // Compare two events
  fastify.post<{ Params: SchoolParams; Body: ComparePriorityInput }>(
    '/schools/:schoolId/priority-rules/compare',
    {
      preHandler: [authorize(['ADMIN', 'COACH'])]
    },
    async (request) => {
      const input = comparePrioritySchema.parse(request.body);
      const result = await priorityRuleService.compare(request.params.schoolId, input);
      return { data: result };
    }
  );

  // Audit log
  fastify.get<{ Params: SchoolParams; Querystring: AuditQuery }>(
    '/schools/:schoolId/priority-rules/audits',
    {
      preHandler: [authorize(['ADMIN'])]
    },
    async (request) => {
      const query = auditQuerySchema.parse(request.query);
      return await priorityRuleService.getAudits(request.params.schoolId, query);
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
│   └── priority-rules/
│       ├── PriorityRulesForm.tsx        # Weight and score configuration form
│       ├── PriorityScoreBreakdown.tsx   # Visual breakdown of a priority score
│       ├── PriorityComparisonCard.tsx   # Side-by-side comparison of two events
│       └── PriorityAuditLog.tsx         # Table of rule changes
├── pages/
│   └── PriorityRulesPage.tsx            # Main settings page for priority rules
├── hooks/
│   └── usePriorityRules.ts             # TanStack Query hooks
└── api/
    └── priorityRules.ts                # API client functions
```

### Hooks

```typescript
// frontend/src/hooks/usePriorityRules.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { priorityRulesApi } from '../api/priorityRules';

export function usePriorityRules(schoolId: string) {
  return useQuery({
    queryKey: ['priority-rules', schoolId],
    queryFn: () => priorityRulesApi.get(schoolId)
  });
}

export function useUpdatePriorityRules(schoolId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePriorityRulesInput) => priorityRulesApi.update(schoolId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priority-rules', schoolId] });
    }
  });
}

export function useCalculatePriority(schoolId: string) {
  return useMutation({
    mutationFn: (data: CalculatePriorityInput) => priorityRulesApi.calculate(schoolId, data)
  });
}

export function useComparePriority(schoolId: string) {
  return useMutation({
    mutationFn: (data: ComparePriorityInput) => priorityRulesApi.compare(schoolId, data)
  });
}

export function usePriorityAudits(schoolId: string, query?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['priority-rules', schoolId, 'audits', query],
    queryFn: () => priorityRulesApi.getAudits(schoolId, query)
  });
}
```

### PriorityRulesPage

Route: `/schools/:schoolId/settings/priority-rules`

Features:
- Four weight sliders (must sum to 100; auto-adjust last slider)
- Per-factor score configuration tables
- Live preview: sample score calculation as user adjusts weights
- Save button with confirmation dialog showing changes
- Audit log tab showing history of changes
- Facility override section (expandable, per facility)

### PriorityScoreBreakdown

Used in conflict detection UI (extends TRD-003 reconciliation):
- Horizontal stacked bar showing contribution of each factor
- Color-coded segments: team level (blue), season (green), event type (orange), home/away (purple)
- Numeric score displayed prominently
- Human-readable explanation text

### PriorityComparisonCard

Displayed when a facility conflict is detected:
- Side-by-side layout: Event A vs Event B
- Each side shows PriorityScoreBreakdown
- Winner highlighted with checkmark icon
- Recommendation text at bottom: "Varsity Basketball (in-season game) has priority over JV Soccer (off-season practice)"
- "Override" button consistent with v1 warn-don't-block philosophy

### Integration with Existing Conflict Detection

The priority comparison is injected into the existing conflict warning flow:
1. When conflict is detected (TRD-002), system also calls `priorityRuleService.compare()`
2. Conflict warning modal (TRD-003) is enhanced with PriorityComparisonCard
3. The suggestion text helps users decide which event should move
4. No blocking -- user can still override with reason

---

## Migration

```sql
-- CreateTable
CREATE TABLE "priority_rules" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "team_level_weight" INTEGER NOT NULL DEFAULT 30,
    "season_status_weight" INTEGER NOT NULL DEFAULT 25,
    "event_type_weight" INTEGER NOT NULL DEFAULT 25,
    "home_away_weight" INTEGER NOT NULL DEFAULT 20,
    "team_level_scores" JSONB NOT NULL DEFAULT '{"VARSITY":100,"JV":60,"FRESHMAN":30}',
    "season_status_scores" JSONB NOT NULL DEFAULT '{"IN_SEASON":100,"OFF_SEASON":30}',
    "event_type_scores" JSONB NOT NULL DEFAULT '{"GAME":100,"PRACTICE":40}',
    "home_away_scores" JSONB NOT NULL DEFAULT '{"HOME":100,"AWAY":20,"NEUTRAL":50}',
    "facility_overrides" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "priority_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (one rule per school)
CREATE UNIQUE INDEX "priority_rules_school_id_key" ON "priority_rules"("school_id");

-- AddForeignKey
ALTER TABLE "priority_rules" ADD CONSTRAINT "priority_rules_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "priority_rule_audits" (
    "id" TEXT NOT NULL,
    "priority_rule_id" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "field_changed" TEXT NOT NULL,
    "old_value" JSONB NOT NULL,
    "new_value" JSONB NOT NULL,

    CONSTRAINT "priority_rule_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "priority_rule_audits_priority_rule_id_idx" ON "priority_rule_audits"("priority_rule_id");

-- AddForeignKey
ALTER TABLE "priority_rule_audits" ADD CONSTRAINT "priority_rule_audits_priority_rule_id_fkey"
  FOREIGN KEY ("priority_rule_id") REFERENCES "priority_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

---

## Master Task List

### Sprint 1 Tasks

| # | Task | Estimate | Dependencies | Status |
|---|------|----------|-------------|--------|
| 1 | Prisma schema: add PriorityRule and PriorityRuleAudit models | 1h | None | [] |
| 2 | Run migration, verify tables and indexes | 0.5h | Task 1 | [] |
| 3 | Zod schemas: updatePriorityRules, calculatePriority, comparePriority, auditQuery | 1.5h | None | [] |
| 4 | PriorityRuleService: get, upsert with audit trail | 2h | Tasks 1, 3 | [] |
| 5 | PriorityRuleService: calculate (priority score computation) | 2h | Task 4 | [] |
| 6 | PriorityRuleService: compare (two-event comparison with explanation) | 1.5h | Task 5 | [] |
| 7 | PriorityRuleService: getSeasonStatus helper | 0.5h | Task 4 | [] |
| 8 | PriorityRuleService: getAudits with pagination | 1h | Task 4 | [] |
| 9 | Unit tests: schema validation (schemas.test.ts) | 1h | Task 3 | [] |
| 10 | Unit tests: service logic (service.test.ts) | 2h | Tasks 4-8 | [] |
| 11 | API routes: GET/PUT priority-rules, POST calculate, POST compare, GET audits | 2h | Tasks 4-8 | [] |
| 12 | Integration tests: route tests (routes.test.ts) | 2h | Task 11 | [] |
| 13 | API client: priorityRules.ts | 1h | Task 11 | [] |
| 14 | TanStack Query hooks: usePriorityRules.ts | 1h | Task 13 | [] |
| 15 | PriorityRulesForm component (weight sliders, score tables) | 3h | Task 14 | [] |
| 16 | PriorityScoreBreakdown component (visual bar breakdown) | 2h | Task 14 | [] |
| 17 | PriorityComparisonCard component (side-by-side comparison) | 2h | Task 16 | [] |
| 18 | PriorityAuditLog component (audit table) | 1.5h | Task 14 | [] |
| 19 | PriorityRulesPage (settings page with tabs) | 2h | Tasks 15, 18 | [] |
| 20 | Integrate PriorityComparisonCard into existing conflict warning modal | 2h | Task 17 | [] |
| 21 | Add navigation link to priority rules in settings/sidebar | 0.5h | Task 19 | [] |
| 22 | E2E tests: priority rules configuration and conflict comparison | 2h | Tasks 19, 20 | [] |

**Total Estimate: ~31 hours (approx. 4 person-days)**

---

## Sprint Planning

### Phase 1: Backend Foundation (Tasks 1-12) -- Days 1-2

**Day 1:**
- Task 1: Schema + Task 2: Migration (1.5h)
- Task 3: Zod schemas (1.5h)
- Task 4: Service get/upsert (2h)
- Task 5: Service calculate (2h)

**Day 2:**
- Task 6: Service compare (1.5h)
- Task 7: Season status helper (0.5h)
- Task 8: Audits (1h)
- Task 9: Schema tests (1h)
- Task 10: Service tests (2h)
- Task 11: Routes (2h)
- Task 12: Route tests (2h)

### Phase 2: Frontend (Tasks 13-22) -- Days 3-4

**Day 3:**
- Task 13: API client (1h)
- Task 14: Hooks (1h)
- Task 15: PriorityRulesForm (3h)
- Task 16: PriorityScoreBreakdown (2h)

**Day 4:**
- Task 17: PriorityComparisonCard (2h)
- Task 18: AuditLog (1.5h)
- Task 19: PriorityRulesPage (2h)
- Task 20: Conflict modal integration (2h)
- Task 21: Navigation (0.5h)
- Task 22: E2E tests (2h)

---

## Testing Strategy

### Unit Tests (Vitest)

**Schema Validation (schemas.test.ts)**
- Accepts valid weights summing to 100
- Rejects weights not summing to 100
- Accepts valid score objects
- Rejects scores outside 0-100 range
- Accepts valid calculate/compare inputs
- Rejects invalid enum values

**Service Logic (service.test.ts)**
- Returns default rules when none configured
- Creates new rule and generates audit entries
- Updates existing rule and generates audits only for changed fields
- Calculates correct priority score with default weights
- Calculates correct priority score with custom weights
- Applies facility-specific overrides when present
- Comparison correctly identifies winner
- Comparison handles ties
- Season status determination (in-season vs off-season)

### Integration Tests (routes.test.ts)

- GET returns defaults when no rule exists
- PUT creates rule with 200 status (ADMIN)
- PUT returns 403 for COACH role
- PUT returns 400 when weights don't sum to 100
- POST calculate returns correct score
- POST compare returns correct winner
- GET audits returns paginated history
- Tenant isolation: cannot access other school's rules

### E2E Tests (Playwright)

- Navigate to priority rules settings page
- Adjust weight sliders and see preview update
- Save configuration and verify success toast
- View audit log showing changes
- Navigate to conflict and see priority comparison card
- Override a lower-priority event with reason

---

## Acceptance Criteria

### US-F1-1: Configure Facility Priority Rules

- [x] Can set priority weights for team level (varsity/JV/freshman)
- [x] Can set priority weights for season status (in-season/off-season)
- [x] Can set priority weights for event type (game/practice)
- [x] Rules are school-wide with optional per-facility overrides
- [x] Changes to rules are logged with who changed what and when

### US-F1-2: See Priority-Based Conflict Resolution

- [x] Conflict warnings include priority comparison with human-readable explanation
- [x] Lower-priority event is flagged with suggestion to find alternative
- [x] Coach can still override (consistent with v1 warn-don't-block philosophy)
- [x] Priority explanation is human-readable, not just a number

### US-F1-3: Automatic Priority Suggestions on Conflict

- [x] On conflict, system identifies which event has lower priority
- [x] Suggests alternative time slots for the lower-priority event (future enhancement -- for now, text suggestion)
- [x] Coordinator or coach makes final decision

---

## Deliverables Checklist

### Backend

- [] Prisma schema update with PriorityRule and PriorityRuleAudit models
- [] Migration file (verified with SQL checks)
- [] `PriorityRuleService` with get, upsert, calculate, compare, getAudits
- [] Priority rule API routes with authorization
- [] Zod validation schemas
- [] Unit tests (`schemas.test.ts`, `service.test.ts`)
- [] Integration tests (`routes.test.ts`)

### Frontend

- [] `PriorityRulesForm.tsx` - Weight/score configuration
- [] `PriorityScoreBreakdown.tsx` - Visual score breakdown
- [] `PriorityComparisonCard.tsx` - Side-by-side comparison
- [] `PriorityAuditLog.tsx` - Audit history table
- [] `PriorityRulesPage.tsx` - Main settings page
- [] `usePriorityRules.ts` - TanStack Query hooks
- [] `priorityRules.ts` - API client
- [] Integration with conflict warning modal (TRD-003)
- [] E2E tests
