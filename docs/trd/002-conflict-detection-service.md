# TRD-002: Conflict Detection Service

> Status: Complete
> PRD: [PRD-001](../prd/001-constraint-aware-scheduling.md)
> Depends on: [TRD-001](./001-blockers-and-constraints.md)
> Created: 2026-01-12
> Last Updated: 2026-01-16

## Overview

The Conflict Detection Service checks whether a Game or Practice conflicts with any applicable blockers. It returns a list of violations with human-readable explanations. The service **warns but does not block** — coaches can override any conflict.

## Core Concept

When a coach creates or modifies an event (Game or Practice), the system checks:

1. **Time overlap** — Does the event's datetime fall within a blocker's period?
2. **Scope match** — Does the blocker apply to this event?
   - SCHOOL_WIDE → applies to all events
   - TEAM → applies to events for that team (via season.teamId)
   - FACILITY → applies to events at that facility

## Data Structures

### Conflict

```typescript
interface Conflict {
  blockerId: string;
  blockerName: string;
  blockerType: BlockerType;
  blockerScope: BlockerScope;
  reason: string;  // Human-readable explanation
  startDatetime: Date;
  endDatetime: Date;
}
```

### ConflictCheckResult

```typescript
interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: Conflict[];
}
```

## Service Implementation

```typescript
// backend/src/modules/conflicts/service.ts

import { prisma } from '../../common/db';
import { BlockerScope, BlockerType } from '@prisma/client';

interface EventContext {
  datetime: Date;
  durationMinutes?: number;  // For practices
  seasonId: string;
  facilityId?: string | null;
}

interface Conflict {
  blockerId: string;
  blockerName: string;
  blockerType: BlockerType;
  blockerScope: BlockerScope;
  reason: string;
  startDatetime: Date;
  endDatetime: Date;
}

interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: Conflict[];
}

export class ConflictService {

  /**
   * Check if an event conflicts with any blockers
   */
  async checkEventConflicts(event: EventContext): Promise<ConflictCheckResult> {
    // Get the team and school from the season
    const season = await prisma.season.findUnique({
      where: { id: event.seasonId },
      include: { team: true }
    });

    if (!season) {
      throw new NotFoundError('Season not found');
    }

    const schoolId = season.team.schoolId;
    const teamId = season.teamId;
    const facilityId = event.facilityId;

    // Calculate event end time
    const eventStart = event.datetime;
    const eventEnd = event.durationMinutes
      ? new Date(eventStart.getTime() + event.durationMinutes * 60000)
      : new Date(eventStart.getTime() + 120 * 60000); // Default 2 hours for games

    // Find all applicable blockers that overlap with the event time
    const blockers = await prisma.blocker.findMany({
      where: {
        schoolId,
        // Time overlap: blocker overlaps with event [eventStart, eventEnd]
        startDatetime: { lt: eventEnd },
        endDatetime: { gt: eventStart },
        // Scope match
        OR: [
          { scope: 'SCHOOL_WIDE' },
          { scope: 'TEAM', teamId: teamId },
          ...(facilityId ? [{ scope: 'FACILITY' as const, facilityId }] : [])
        ]
      }
    });

    const conflicts: Conflict[] = blockers.map(blocker => ({
      blockerId: blocker.id,
      blockerName: blocker.name,
      blockerType: blocker.type,
      blockerScope: blocker.scope,
      reason: this.buildConflictReason(blocker),
      startDatetime: blocker.startDatetime,
      endDatetime: blocker.endDatetime
    }));

    return {
      hasConflicts: conflicts.length > 0,
      conflicts
    };
  }

  /**
   * Check conflicts for multiple events (batch operation)
   */
  async checkBatchConflicts(
    events: EventContext[]
  ): Promise<Map<string, ConflictCheckResult>> {
    const results = new Map<string, ConflictCheckResult>();

    // Could optimize with single query, but keeping simple for now
    for (const event of events) {
      const key = `${event.seasonId}-${event.datetime.toISOString()}`;
      results.set(key, await this.checkEventConflicts(event));
    }

    return results;
  }

  /**
   * Find all events that conflict with a given blocker
   * Used when creating a new blocker to show retroactive conflicts
   */
  async findConflictingEvents(blockerId: string): Promise<{
    games: { id: string; opponent: string; datetime: Date }[];
    practices: { id: string; datetime: Date }[];
    totalCount: number;
  }> {
    const blocker = await prisma.blocker.findUnique({
      where: { id: blockerId }
    });

    if (!blocker) {
      throw new NotFoundError('Blocker not found');
    }

    // Build the event query based on blocker scope
    const eventWhere = this.buildEventWhereClause(blocker);

    const [games, practices] = await Promise.all([
      prisma.game.findMany({
        where: {
          ...eventWhere,
          datetime: {
            gte: blocker.startDatetime,
            lt: blocker.endDatetime
          }
        },
        select: { id: true, opponent: true, datetime: true }
      }),
      prisma.practice.findMany({
        where: {
          ...eventWhere,
          datetime: {
            gte: blocker.startDatetime,
            lt: blocker.endDatetime
          }
        },
        select: { id: true, datetime: true }
      })
    ]);

    return {
      games,
      practices,
      totalCount: games.length + practices.length
    };
  }

  /**
   * Get conflict summary for a season
   */
  async getSeasonConflictSummary(seasonId: string): Promise<{
    gamesWithConflicts: number;
    practicesWithConflicts: number;
    totalConflicts: number;
  }> {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: {
        games: { select: { id: true, datetime: true, facilityId: true } },
        practices: { select: { id: true, datetime: true, facilityId: true, durationMinutes: true } }
      }
    });

    if (!season) {
      throw new NotFoundError('Season not found');
    }

    let gamesWithConflicts = 0;
    let practicesWithConflicts = 0;

    for (const game of season.games) {
      const result = await this.checkEventConflicts({
        datetime: game.datetime,
        seasonId,
        facilityId: game.facilityId
      });
      if (result.hasConflicts) gamesWithConflicts++;
    }

    for (const practice of season.practices) {
      const result = await this.checkEventConflicts({
        datetime: practice.datetime,
        durationMinutes: practice.durationMinutes,
        seasonId,
        facilityId: practice.facilityId
      });
      if (result.hasConflicts) practicesWithConflicts++;
    }

    return {
      gamesWithConflicts,
      practicesWithConflicts,
      totalConflicts: gamesWithConflicts + practicesWithConflicts
    };
  }

  private buildConflictReason(blocker: {
    name: string;
    type: BlockerType;
    scope: BlockerScope;
  }): string {
    const typeLabels: Record<BlockerType, string> = {
      EXAM: 'exam period',
      MAINTENANCE: 'facility maintenance',
      EVENT: 'school event',
      TRAVEL: 'travel blackout',
      HOLIDAY: 'school holiday',
      WEATHER: 'weather closure',
      CUSTOM: 'blocked period'
    };

    const scopePrefix = blocker.scope === 'SCHOOL_WIDE'
      ? 'School-wide'
      : blocker.scope === 'FACILITY'
        ? 'Facility'
        : 'Team';

    return `${scopePrefix} ${typeLabels[blocker.type]}: ${blocker.name}`;
  }

  private buildEventWhereClause(blocker: {
    schoolId: string;
    scope: BlockerScope;
    teamId: string | null;
    facilityId: string | null;
  }): any {
    switch (blocker.scope) {
      case 'SCHOOL_WIDE':
        // All events in the school
        return {
          season: { team: { schoolId: blocker.schoolId } }
        };
      case 'TEAM':
        // Events for this team only
        return {
          season: { teamId: blocker.teamId }
        };
      case 'FACILITY':
        // Events at this facility only
        return {
          facilityId: blocker.facilityId
        };
    }
  }
}
```

## API Integration

### Game/Practice Create/Update Response

When creating or updating a Game or Practice, include conflict information in the response:

```typescript
// In games/routes.ts

fastify.post('/seasons/:seasonId/games', async (request, reply) => {
  const game = await gameService.create(seasonId, data, userId);

  // Check for conflicts
  const conflictResult = await conflictService.checkEventConflicts({
    datetime: game.datetime,
    seasonId: game.seasonId,
    facilityId: game.facilityId
  });

  return {
    data: game,
    meta: {
      conflicts: conflictResult.conflicts,
      hasConflicts: conflictResult.hasConflicts
    }
  };
});
```

### Dedicated Conflict Endpoints

```
GET /api/v1/games/:id/conflicts
GET /api/v1/practices/:id/conflicts
```

Returns conflicts for a specific event.

```
GET /api/v1/seasons/:seasonId/conflicts
```

Returns conflict summary for a season:
```json
{
  "data": {
    "gamesWithConflicts": 2,
    "practicesWithConflicts": 5,
    "totalConflicts": 7,
    "conflictingEvents": [
      {
        "type": "game",
        "id": "clx...",
        "datetime": "2026-12-16T18:00:00Z",
        "opponent": "Lincoln High",
        "conflicts": [
          {
            "blockerId": "clx...",
            "blockerName": "Final Exams",
            "reason": "School-wide exam period: Final Exams"
          }
        ]
      }
    ]
  }
}
```

```
GET /api/v1/blockers/:id/affected-events
```

Returns events that conflict with a specific blocker (for retroactive conflict display).

## Override Tracking

When a coach saves an event despite conflicts, log the override:

```prisma
model ConflictOverride {
  id        String   @id @default(cuid())
  schoolId  String   @map("school_id")

  // What was overridden
  eventType EventType  // GAME or PRACTICE
  eventId   String     @map("event_id")
  blockerId String     @map("blocker_id")

  // Who and when
  overriddenBy String   @map("overridden_by")
  overriddenAt DateTime @default(now()) @map("overridden_at")

  // Context
  reason    String?    // Optional: why they overrode

  school    School     @relation(fields: [schoolId], references: [id], onDelete: Cascade)

  @@index([schoolId])
  @@index([eventId])
  @@map("conflict_overrides")
}

enum EventType {
  GAME
  PRACTICE
}
```

API for creating override:
```
POST /api/v1/conflicts/override
```
```json
{
  "eventType": "GAME",
  "eventId": "clx...",
  "blockerId": "clx...",
  "reason": "League-mandated game, cannot reschedule"
}
```

## Dashboard Integration

For the "X events now conflict" notification (per PRD decision #4):

```
GET /api/v1/schools/:schoolId/conflict-summary
```

Returns:
```json
{
  "data": {
    "totalConflicts": 12,
    "byType": {
      "EXAM": 5,
      "MAINTENANCE": 3,
      "EVENT": 4
    },
    "recentlyCreated": [
      {
        "blockerId": "clx...",
        "blockerName": "Final Exams",
        "affectedEventsCount": 5,
        "createdAt": "2026-01-12T10:00:00Z"
      }
    ]
  }
}
```

## Performance Considerations

1. **Index on datetime ranges** - Blocker queries filter by datetime overlap
2. **Batch operations** - `checkBatchConflicts` for import scenarios
3. **Cache season context** - Season → Team → School lookup is repeated; consider caching
4. **Lazy loading** - Don't compute conflicts until needed (on save, not on form load)

## Test Cases

### Unit Tests

1. **Time overlap detection**
   - Event fully inside blocker → conflict
   - Event overlaps blocker start → conflict
   - Event overlaps blocker end → conflict
   - Event fully outside blocker → no conflict
   - Event exactly at blocker boundary → test edge case

2. **Scope matching**
   - SCHOOL_WIDE blocker matches all events in school
   - TEAM blocker only matches events for that team
   - FACILITY blocker only matches events at that facility
   - Different school's blocker doesn't match

3. **Reason generation**
   - Each blocker type produces correct human-readable reason

### Integration Tests

1. **Create game with conflict**
   - Create blocker, then create conflicting game
   - Response includes conflict information
   - Game is still created (warn, don't block)

2. **Retroactive conflicts**
   - Create games, then create blocker
   - `/blockers/:id/affected-events` returns correct games

3. **Override tracking**
   - Create game with conflict, save with override
   - Override logged in conflict_overrides table

## Dependencies

- TRD-001 (Blockers) must be implemented first
- Existing Game and Practice models
- Existing Season → Team → School relationships

## Deliverables

- [ ] ConflictService implementation
- [ ] Conflict checking integrated into Game/Practice create/update
- [ ] `/conflicts` API endpoints
- [ ] ConflictOverride model and tracking
- [ ] Dashboard conflict summary endpoint
- [ ] Unit and integration tests
