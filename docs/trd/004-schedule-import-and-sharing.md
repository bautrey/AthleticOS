# TRD-004: Schedule Import & Shareable Links

> Status: Complete
> PRD: [PRD-001](../prd/001-constraint-aware-scheduling.md) (Phases 4 & 5)
> Created: 2026-01-16
> Last Updated: 2026-01-16

## Overview

Implement two capabilities that complete the constraint-aware scheduling MVP:

1. **CSV Import**: Allow coaches to import existing season schedules from spreadsheets instead of manual entry
2. **Shareable Schedule Links**: Generate public URLs and embeddable widgets so parents/players can view schedules without logging in

---

## Execution Environment

- **Branch**: `feature/schedule-import-sharing`
- **Working Directory**: `/Users/burke/projects/AthleticOS`
- **Workflow Command**: `/implement-trd`
- **Required Skills**: Backend (Fastify/Prisma), Frontend (React/TanStack Query), `frontend-design` plugin

### Prerequisites

- Docker containers running (`docker compose up`)
- Database migrated to current state
- Existing CRUD for Seasons, Games, Practices functional
- Conflict detection service (TRD-002) operational

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CSV parser | Papa Parse (frontend) | Client-side parsing, preview before upload, no server memory issues |
| Shareable link format | `/s/:shareToken` | Short URLs, token-based (not guessable season IDs) |
| Token generation | cuid2 (24 chars) | URL-safe, non-sequential, sufficient entropy |
| Widget delivery | Server-rendered HTML | No separate JS bundle needed; simpler deployment |
| Bulk conflict check | Single API call post-import | Check all imported events at once, return summary |
| Import atomicity | All-or-nothing | Either entire CSV imports successfully or none do; no partial imports |
| Facility matching | Fuzzy match with confirmation | Case-insensitive Levenshtein match; user confirms suggestions |
| Timezone handling | School timezone | CSV times interpreted in school's configured timezone, stored as UTC |
| QR code library | qrcode.react | Well-maintained, React-native, small bundle |
| View count | Atomic increment | Uses Prisma `increment` operation to prevent lost updates |
| Share deletion | Restrict + app cleanup | No CASCADE; explicit service-layer deletion with audit trail |

---

## Part 1: CSV Schedule Import

### 1.1 Supported CSV Formats

**Timezone Note**: All times in CSV files are interpreted in the school's configured timezone and converted to UTC for storage.

#### Games CSV

| Column | Required | Format | Example |
|--------|----------|--------|---------|
| `date` | Yes | YYYY-MM-DD or MM/DD/YYYY | `2026-03-15` |
| `time` | Yes | HH:MM (24h) or h:mm AM/PM | `15:30` or `3:30 PM` |
| `opponent` | Yes | String | `Lincoln High` |
| `home_away` | Yes | HOME, AWAY, or NEUTRAL | `HOME` |
| `facility` | No | String (fuzzy matched) | `Main Gym` |
| `notes` | No | String | `Senior night` |

#### Practices CSV

| Column | Required | Format | Example |
|--------|----------|--------|---------|
| `date` | Yes | YYYY-MM-DD or MM/DD/YYYY | `2026-03-15` |
| `time` | Yes | HH:MM (24h) or h:mm AM/PM | `16:00` |
| `duration` | No | Minutes (default: 90) | `120` |
| `facility` | No | String (fuzzy matched) | `Practice Field` |
| `notes` | No | String | `Film session` |

### 1.2 Facility Matching Algorithm

Facility names from CSV are matched against existing facilities using:

1. **Exact match** (case-insensitive): `"Main Gym"` → `"main gym"` ✓
2. **Fuzzy match** (Levenshtein distance ≤ 2): `"Main Gimnasium"` → suggest `"Main Gymnasium"`
3. **No match**: Include in preview with warning, let user assign manually or leave blank

Preview response includes `facilityMatch` field:
```json
{
  "row": 1,
  "facilityInput": "Main Gimnasium",
  "facilityMatch": {
    "type": "fuzzy",
    "suggestion": { "id": "clx...", "name": "Main Gymnasium" },
    "distance": 2
  }
}
```

### 1.3 API Endpoints

#### Preview Import (Validate & Show Conflicts)

```
POST /api/v1/seasons/:seasonId/import/preview
Content-Type: application/json
```

**Request:**
```json
{
  "type": "games",
  "rows": [
    {
      "date": "2026-03-15",
      "time": "15:30",
      "opponent": "Lincoln High",
      "homeAway": "HOME",
      "facility": "Main Gym",
      "notes": null
    }
  ]
}
```

**Response:**
```json
{
  "data": {
    "valid": false,
    "canImport": true,
    "totalRows": 15,
    "validRows": 14,
    "invalidRows": 1,
    "rowsWithConflicts": 3,
    "errors": [
      {
        "row": 7,
        "field": "date",
        "message": "Invalid date format: 'March 15'"
      }
    ],
    "conflicts": [
      {
        "row": 2,
        "datetime": "2026-03-15T15:30:00Z",
        "conflicts": [
          {
            "blockerId": "clx...",
            "blockerName": "Gym Maintenance",
            "reason": "Facility unavailable"
          }
        ]
      }
    ],
    "preview": [
      {
        "row": 1,
        "status": "valid",
        "parsed": {
          "datetime": "2026-03-15T15:30:00Z",
          "opponent": "Lincoln High",
          "homeAway": "HOME",
          "facilityId": "clx...",
          "facilityName": "Main Gym"
        },
        "facilityMatch": { "type": "exact" }
      }
    ]
  }
}
```

**Note**: `canImport` is `false` if ANY row has validation errors (all-or-nothing). Conflicts don't block import but require override reason.

#### Execute Import

```
POST /api/v1/seasons/:seasonId/import/execute
Content-Type: application/json
```

**Request:**
```json
{
  "type": "games",
  "rows": [...],
  "facilityAssignments": {
    "3": "clx-facility-id"
  },
  "overrideConflicts": true,
  "overrideReason": "League schedule is fixed"
}
```

**Response:**
```json
{
  "data": {
    "imported": 15,
    "conflictsOverridden": 3,
    "games": [
      { "id": "clx...", "opponent": "Lincoln High", ... }
    ]
  }
}
```

**Error (validation failures)**:
```json
{
  "error": {
    "code": "VALIDATION_ERRORS",
    "message": "Cannot import: 1 row has validation errors. Fix all errors and retry.",
    "details": { "invalidRows": 1 }
  }
}
```

### 1.4 Frontend Components

#### ImportScheduleModal

- Upload zone (drag & drop or click to select)
- Auto-detect type (games vs practices) from column headers
- Preview table showing parsed rows
- Validation errors highlighted in red (blocks import)
- Facility suggestions with dropdown to confirm/override
- Conflicts highlighted in amber with expandable details
- Override reason input (required if conflicts exist and proceeding)
- **No partial import option** - all rows must be valid

#### Import Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Upload CSV                                           │
│    [Drag CSV here or click to upload]                   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Preview & Validate                                   │
│    ┌─────────────────────────────────────────────────┐  │
│    │ ✅ Row 1: Mar 15 vs Lincoln High (Home)         │  │
│    │ ⚠️ Row 2: Mar 17 vs Central - CONFLICT: Exams   │  │
│    │ ❌ Row 3: Invalid date format (BLOCKS IMPORT)   │  │
│    │ 🔍 Row 4: "Main Gimnasium" → Main Gymnasium?    │  │
│    └─────────────────────────────────────────────────┘  │
│    ❌ 1 error (must fix) · ⚠️ 1 conflict · 🔍 1 to confirm │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Confirm Import (only if no errors)                   │
│    Override reason: [League schedule is fixed     ]     │
│    [Cancel] [Import 15 Games]                           │
└─────────────────────────────────────────────────────────┘
```

---

## Part 2: Shareable Schedule Links

### 2.1 Data Model

```prisma
model ScheduleShare {
  id          String   @id @default(cuid())
  seasonId    String   @map("season_id")

  // Share token (used in URL)
  token       String   @unique @default(cuid())

  // Display settings
  title       String?              // Custom title (default: "{Team} {Sport} Schedule")
  showNotes   Boolean  @default(false) @map("show_notes")
  showFacility Boolean @default(true) @map("show_facility")

  // Access control
  isActive    Boolean  @default(true) @map("is_active")
  expiresAt   DateTime? @map("expires_at")

  // Tracking (incremented atomically via Prisma increment)
  viewCount   Int      @default(0) @map("view_count")
  createdAt   DateTime @default(now()) @map("created_at")
  createdBy   String   @map("created_by")

  // Relations - Restrict deletion, handle in service layer
  season      Season   @relation(fields: [seasonId], references: [id], onDelete: Restrict)

  @@index([token])
  @@index([seasonId])
  @@map("schedule_shares")
}
```

Add to Season model:
```prisma
model Season {
  // ... existing fields
  shares      ScheduleShare[]
}
```

**Note**: `onDelete: Restrict` requires explicit deletion of shares before deleting a season. The SeasonService.delete() method must delete all shares first.

### 2.2 API Endpoints

#### Create Share Link

```
POST /api/v1/seasons/:seasonId/shares
```

**Request:**
```json
{
  "title": "Varsity Basketball 2026",
  "showNotes": false,
  "showFacility": true,
  "expiresAt": null
}
```

**Response:**
```json
{
  "data": {
    "id": "clx...",
    "token": "abc123def456ghij789klmno",
    "url": "https://app.athleticos.com/s/abc123def456ghij789klmno",
    "embedCode": "<iframe src=\"https://app.athleticos.com/s/abc123def456ghij789klmno/embed\" width=\"100%\" height=\"600\" frameborder=\"0\" style=\"border:1px solid #e5e7eb;border-radius:8px;\"></iframe>",
    "title": "Varsity Basketball 2026",
    "showNotes": false,
    "showFacility": true,
    "isActive": true,
    "expiresAt": null,
    "viewCount": 0
  }
}
```

#### List Share Links

```
GET /api/v1/seasons/:seasonId/shares
```

#### Get Public Schedule (No Auth Required)

```
GET /s/:token
```

Returns HTML page with schedule (server-rendered).

```
GET /s/:token/embed
```

Returns embeddable version (minimal chrome, designed for iframe). Supports query param `?theme=dark`.

```
GET /api/v1/public/schedules/:token
```

Returns JSON for programmatic access. Increments view count atomically.

**Response:**
```json
{
  "data": {
    "title": "Varsity Basketball 2026",
    "team": {
      "name": "Varsity",
      "sport": "Basketball"
    },
    "school": {
      "name": "Jefferson High School"
    },
    "games": [
      {
        "datetime": "2026-03-15T15:30:00Z",
        "opponent": "Lincoln High",
        "homeAway": "HOME",
        "facility": "Main Gym",
        "status": "SCHEDULED"
      }
    ],
    "practices": [
      {
        "datetime": "2026-03-14T16:00:00Z",
        "duration": 90,
        "facility": "Practice Gym"
      }
    ]
  }
}
```

#### Update/Deactivate Share

```
PATCH /api/v1/seasons/:seasonId/shares/:shareId
```

```
DELETE /api/v1/seasons/:seasonId/shares/:shareId
```

### 2.3 Frontend Components

#### ShareScheduleModal

- Toggle to enable/disable public link
- Copyable URL with "Copy Link" button
- Embed code textarea with "Copy Code" button
- QR code for easy mobile sharing (using `qrcode.react`)
- Settings: title, show notes, show facility, expiration
- View count display

#### Public Schedule Page (`/s/:token`)

- Clean, mobile-responsive design (breakpoints: 640px mobile, 768px tablet, 1024px desktop)
- School branding (logo, colors if available)
- Calendar view (month) + list view toggle
- Games and practices combined, color-coded
- "Add to Calendar" button (generates .ics file)
- No login required
- Footer: "Powered by AthleticOS"
- WCAG 2.1 AA compliant: proper heading structure, color contrast, keyboard navigation

#### Embed Widget (`/s/:token/embed`)

- Server-rendered HTML (no separate JS bundle)
- Minimal styling (no header/footer)
- Responsive to container width
- Light/dark mode via `?theme=dark` query param
- Compact list view

---

## Task Summary

| Task ID | Description | Agent | Dependencies | Est. Hours |
|---------|-------------|-------|--------------|------------|
| T-001 | Create ScheduleShare Prisma model + migration + verify | `backend-developer` | None | 1 |
| T-002 | Implement CSV parsing service with Papa Parse | `frontend-developer` | None | 2 |
| T-003 | Implement import preview API (service + routes + schemas) | `backend-developer` | T-001 | 2.5 |
| T-004 | Implement import execute API (service + routes) | `backend-developer` | T-003 | 2 |
| T-005 | Create ImportScheduleModal component | `frontend-developer` | T-002, T-003 | 3 |
| T-006 | Implement share CRUD API (service + routes + schemas) | `backend-developer` | T-001 | 2 |
| T-007 | Implement public schedule API + rate limiting middleware | `backend-developer` | T-006 | 1.5 |
| T-008 | Create ShareScheduleModal component with QR code | `frontend-developer` | T-006 | 2 |
| T-009 | Create public schedule page (/s/:token) | `frontend-developer` | T-007 | 3 |
| T-010 | Create embed widget (/s/:token/embed) - server rendered | `backend-developer` | T-007 | 1.5 |
| T-011 | Generate .ics calendar file for download | `backend-developer` | T-007 | 1 |
| T-012 | Write integration tests (import flow) | `backend-developer` | T-004 | 2 |
| T-013 | Write integration tests (share flow) | `backend-developer` | T-007 | 1.5 |
| T-014 | UI tests with Playwright | `playwright-tester` | T-005, T-008, T-009 | 2 |

**Total Estimated: ~27 hours**

### Parallel Execution Groups

```
Group 1 (No dependencies):
  T-001: ScheduleShare model (backend)
  T-002: CSV parsing service (frontend)

Group 2 (After T-001):
  T-003: Import preview API (backend)
  T-006: Share CRUD API (backend)

Group 3 (After T-003):
  T-004: Import execute API (backend)
  T-005: ImportScheduleModal (frontend, also needs T-002)

Group 4 (After T-006):
  T-007: Public schedule API + rate limiting (backend)
  T-008: ShareScheduleModal (frontend)

Group 5 (After T-007):
  T-009: Public schedule page (frontend)
  T-010: Embed widget (backend - server rendered)
  T-011: .ics file generation (backend)

Group 6 (After all features):
  T-012, T-013, T-014: Tests (can run in parallel)
```

---

## Testing Strategy

**NO MOCKS POLICY**: All tests use real database connections and real API calls. No mocks, stubs, or fakes. The only exception is HTTP client edge cases that cannot be triggered with real APIs (timeouts, 429s, malformed responses).

### Test Data Strategy

Tests follow the pattern established in `conflicts/service.test.ts`:
- Each test file creates its own test data in `beforeAll` hooks
- Tests use real Prisma client connected to test database
- Cleanup in `afterAll` deletes all created test data
- No reliance on seed data or pre-existing records

### Integration Tests (Real Database)

**Import Tests:**
- [ ] Valid games CSV imports all rows
- [ ] Valid practices CSV imports all rows
- [ ] Invalid date format returns validation error
- [ ] Missing required column returns error
- [ ] Single invalid row blocks entire import (atomicity)
- [ ] Conflicting events detected and reported
- [ ] Override reason logged when proceeding with conflicts
- [ ] Duplicate detection (same datetime + opponent)
- [ ] Facility fuzzy matching returns suggestions
- [ ] Unknown facility left as null with warning

**Share Tests:**
- [ ] Create share returns valid token and URLs
- [ ] Public endpoint returns schedule without auth
- [ ] Expired share returns 404 with friendly message
- [ ] Deactivated share returns 404
- [ ] View count increments atomically on access
- [ ] Embed endpoint returns minimal HTML
- [ ] Dark theme query param works
- [ ] .ics file downloads valid calendar format
- [ ] Rate limiting blocks after 100 req/min

### UI Tests (Playwright)

- [ ] Drag & drop CSV triggers parsing
- [ ] Preview table shows parsed rows
- [ ] Validation errors highlighted and block import
- [ ] Facility suggestions shown with confirm/change options
- [ ] Conflict warnings displayed
- [ ] Import success refreshes games list
- [ ] Share modal shows copyable URL
- [ ] Copy button copies to clipboard
- [ ] QR code renders
- [ ] Public page renders schedule correctly
- [ ] Mobile responsive layout works (test at 375px, 768px, 1024px)
- [ ] Embed widget renders in iframe

### Test Fixtures

Create sample CSV files in `/backend/src/test/fixtures/`:
- `valid-games.csv` - 10 games, no conflicts
- `valid-practices.csv` - 10 practices, no conflicts
- `games-with-conflicts.csv` - 10 games, 3 conflict with exam blocker
- `invalid-games.csv` - Various validation errors (bad dates, missing columns)
- `fuzzy-facilities.csv` - Games with misspelled facility names

---

## Migration & Verification

### Migration Steps

| Step | Action | Verification |
|------|--------|--------------|
| 1 | Run Prisma migration | `npx prisma migrate dev --name add_schedule_shares` |
| 2 | **VERIFY** | Query: `SELECT column_name FROM information_schema.columns WHERE table_name = 'schedule_shares';` - confirm all columns exist |
| 3 | Generate Prisma client | `npx prisma generate` |
| 4 | **GATE** | Do NOT proceed until step 2 verification passes |

### SQL Reference

```sql
-- Migration: add_schedule_shares
CREATE TABLE schedule_shares (
  id VARCHAR(30) PRIMARY KEY,
  season_id VARCHAR(30) NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
  token VARCHAR(30) UNIQUE NOT NULL,
  title VARCHAR(255),
  show_notes BOOLEAN DEFAULT false,
  show_facility BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(30) NOT NULL
);

CREATE INDEX idx_schedule_shares_token ON schedule_shares(token);
CREATE INDEX idx_schedule_shares_season ON schedule_shares(season_id);
```

---

## Error Handling

| Error | HTTP Code | Response |
|-------|-----------|----------|
| Invalid CSV format | 400 | `{ error: { code: "INVALID_CSV", message: "..." } }` |
| Validation errors (blocks import) | 400 | `{ error: { code: "VALIDATION_ERRORS", message: "...", details: {...} } }` |
| Share not found | 404 | `{ error: { code: "SHARE_NOT_FOUND", message: "Schedule not found" } }` |
| Share expired | 404 | `{ error: { code: "SHARE_EXPIRED", message: "This schedule link has expired" } }` |
| Share inactive | 404 | `{ error: { code: "SHARE_INACTIVE", message: "This schedule link is no longer active" } }` |
| Rate limited | 429 | `{ error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } }` |

---

## Security Considerations

1. **CSV Injection**: Sanitize values that start with `=`, `+`, `-`, `@` (Excel formula injection)
2. **Share Token Guessing**: 24-char cuid2 provides ~128 bits entropy
3. **Rate Limiting**: Public endpoints limited to 100 req/min per IP (implemented in T-007)
4. **XSS in Public Pages**: Sanitize all user-provided content (team names, notes) using DOMPurify
5. **Embed Clickjacking**: `X-Frame-Options` NOT set for embed endpoint (intentionally frameable)

---

## Out of Scope

- Google Calendar integration (deferred to future PRD)
- Import from other scheduling apps (MaxPreps, Arbiter, etc.)
- Recurring practice imports (RRULE format)
- Multi-season import
- Share analytics beyond view count
- Custom branding/themes for public pages
- Email notifications when schedule changes

---

## Acceptance Criteria

### CSV Import
- [ ] Coach can upload games CSV and see preview before import
- [ ] Coach can upload practices CSV and see preview before import
- [ ] Validation errors shown inline with specific row/field
- [ ] Validation errors block import (all-or-nothing)
- [ ] Fuzzy facility matches shown with confirmation UI
- [ ] Conflicts detected and displayed before import
- [ ] Coach can proceed with conflicts (with required reason)
- [ ] Imported events appear in season schedule immediately
- [ ] Conflict count shown in season summary after import

### Shareable Links
- [ ] Coach can generate shareable link for season schedule
- [ ] Link works without login
- [ ] Public page shows games and practices in calendar/list view
- [ ] Public page is mobile responsive
- [ ] Embed code works in iframe
- [ ] Coach can deactivate link
- [ ] View count tracked (atomically)
- [ ] "Add to Calendar" generates downloadable .ics file
- [ ] QR code displayed for easy mobile sharing

---

## Linear Integration

> **Note**: Create Linear issue before starting implementation. Update placeholder below.

- [ ] Move [TBD - create issue] to "In Progress" when starting
- [ ] Move [TBD - create issue] to "Review" when code complete
- [ ] Move [TBD - create issue] to "Done" when merged

---

## Recommended Tools

| Tool | Type | Why |
|------|------|-----|
| `frontend-design` | Plugin | Public schedule page needs polished UI |
| `playwright-tester` | Agent | E2E tests for import and share flows |
| `test-driven-development` | Skill | Ensures CSV validation logic thoroughly tested |
| `database-expert` | Agent | Migration creation and verification |
| `context7` | Plugin | Papa Parse and qrcode.react documentation |
