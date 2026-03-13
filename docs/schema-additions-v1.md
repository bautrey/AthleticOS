# Schema Additions — Sports Scheduling v1

> These additions extend the existing AthleticOS Prisma schema.
> Migration: `20260313000000_add_resources_participants_notifications_calendar`

## Overview of Changes

### Modified Tables
- **users** — Added `phone` column (nullable TEXT) for SMS notifications

### New Enums
| Enum | Values |
|------|--------|
| `ResourceType` | BUS, REFEREE, EQUIPMENT, OTHER |
| `NotificationChannel` | EMAIL, SMS |
| `NotificationStatus` | PENDING, SENT, FAILED |
| `CalendarFeedScope` | TEAM, USER |

### New Tables

#### `resources`
Shared school resources (buses, referees, equipment).

| Column | Type | Notes |
|--------|------|-------|
| id | cuid PK | |
| school_id | FK → schools | CASCADE delete |
| name | TEXT | e.g., "Bus-12", "Ref-Johnson" |
| type | ResourceType | |
| metadata | JSONB | Flexible: license plate, phone, etc. |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### `event_resources`
Many-to-many: resources ↔ games/practices.

| Column | Type | Notes |
|--------|------|-------|
| id | cuid PK | |
| resource_id | FK → resources | CASCADE delete |
| event_type | EventType | GAME or PRACTICE |
| game_id | FK → games (nullable) | CASCADE delete |
| practice_id | FK → practices (nullable) | CASCADE delete |
| created_at | TIMESTAMP | |

#### `event_participants`
Tracks user-to-event assignments for multi-sport conflict detection.

| Column | Type | Notes |
|--------|------|-------|
| id | cuid PK | |
| user_id | FK → users | CASCADE delete |
| event_type | EventType | |
| game_id | FK → games (nullable) | CASCADE delete |
| practice_id | FK → practices (nullable) | CASCADE delete |
| created_at | TIMESTAMP | |

**Unique constraints:** (user_id, game_id) and (user_id, practice_id)

#### `notifications`
Audit trail of all sent notifications.

| Column | Type | Notes |
|--------|------|-------|
| id | cuid PK | |
| school_id | FK → schools | |
| user_id | FK → users | Recipient |
| channel | NotificationChannel | EMAIL or SMS |
| subject | TEXT (nullable) | Email subject line |
| body | TEXT | Message content |
| event_type | EventType (nullable) | If related to an event |
| event_id | TEXT (nullable) | Game or practice ID |
| status | NotificationStatus | PENDING → SENT/FAILED |
| sent_at | TIMESTAMP (nullable) | |
| fail_reason | TEXT (nullable) | Error message on failure |
| created_at | TIMESTAMP | |

**Indexes:** school_id, user_id, status (for background worker polling)

#### `notification_preferences`
Per-user, per-school notification configuration.

| Column | Type | Notes |
|--------|------|-------|
| id | cuid PK | |
| user_id | FK → users | |
| school_id | FK → schools | |
| email_enabled | BOOLEAN (default true) | |
| sms_enabled | BOOLEAN (default false) | |
| quiet_start | TEXT (nullable) | HH:MM format |
| quiet_end | TEXT (nullable) | HH:MM format |
| digest_enabled | BOOLEAN (default false) | Nightly digest mode |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**Unique constraint:** (user_id, school_id)

#### `calendar_feeds`
iCal subscription tokens.

| Column | Type | Notes |
|--------|------|-------|
| id | cuid PK | |
| token | TEXT UNIQUE | URL-safe token for feed |
| user_id | FK → users | Feed owner |
| scope | CalendarFeedScope | TEAM = one team, USER = all user's teams |
| team_id | FK → teams (nullable) | Required when scope=TEAM |
| is_active | BOOLEAN (default true) | Deactivate without deleting |
| created_at | TIMESTAMP | |

---

## Entity Relationship Additions

```
User ──1:N──> EventParticipant ──N:1──> Game/Practice
User ──1:N──> Notification
User ──1:N──> NotificationPreference ──N:1──> School
User ──1:N──> CalendarFeed ──N:1──> Team (optional)

School ──1:N──> Resource ──1:N──> EventResource ──N:1──> Game/Practice
School ──1:N──> Notification
School ──1:N──> NotificationPreference

Team ──1:N──> CalendarFeed
```

## iCal Feed Format

Each `GET /cal/:token.ics` returns:

```ical
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//AthleticOS//Sports Scheduling//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Varsity Soccer Schedule
X-WR-TIMEZONE:America/New_York

BEGIN:VEVENT
UID:game-clxxxxxxxxx@athleticos
DTSTART:20260317T163000Z
DTEND:20260317T183000Z
SUMMARY:Game vs Oak Ridge (HOME)
LOCATION:Field A
DESCRIPTION:Varsity Soccer - Home Game
STATUS:CONFIRMED
END:VEVENT

BEGIN:VEVENT
UID:practice-clxxxxxxxxx@athleticos
DTSTART:20260318T193000Z
DTEND:20260318T210000Z
SUMMARY:Practice - Varsity Soccer
LOCATION:Gym A
STATUS:CONFIRMED
END:VEVENT

END:VCALENDAR
```

### Feed Scopes

- **TEAM feed:** All games + practices for a specific team/season
- **USER feed:** All games + practices across all the user's teams (athlete sees all their sports)
- **Parent view:** Automatically includes all teams their child is on
