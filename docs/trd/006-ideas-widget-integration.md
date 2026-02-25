# TRD-006: Integrate Fortium Ideas Widget

> Status: Draft
> PRD: [PRD-002 (F7)](../prd/v2-athletic-operations.md#f7-in-app-feature-request-and-bug-report-system)
> Created: 2026-02-19
> Last Updated: 2026-02-25
> Replaces: 006-feedback-system.md (deleted)

## Overview

### Problem

Coaches are the primary users of AthleticOS and will encounter bugs and have ideas for improvements. Without a structured feedback channel, these go to text messages, get mentioned in passing, or get forgotten entirely.

### Solution

Instead of building a custom in-app feedback system (original TRD-006), we integrate the existing **Fortium Ideas** product -- a mature feedback system with GitHub Issues integration, webhook-driven status sync, and an embeddable Preact widget. Pipeline already integrates it via UMD bundle + CSS in its base template.

AthleticOS backend acts as a **proxy** to the Ideas API, avoiding Fortium Identity JWT dependency. The widget's `apiUrl` points to AthleticOS's own API (`/api/v1/ideas`), and the backend attaches a service-level API key when forwarding to the Ideas API. User identity is extracted from the AthleticOS JWT and passed as context.

### Relationship to Existing System

- **Leverages** Fortium Ideas product (`../ideas`) -- no new feedback models needed
- **Follows** Pipeline's integration pattern (UMD bundle + CSS)
- **Leverages** existing AthleticOS authentication for user identity context
- **No new Prisma models** -- all data lives in the Ideas service

## Execution Environment

- **Branch**: `feature/priority-rules-engine` (current sprint branch)
- **Working Directory**: `/Users/burkestudio/projects/AthleticOS`
- **Required Skills**: Backend (Fastify proxy), Frontend (React wrapper for Preact widget)
- **Prerequisites**:
  - Ideas widget built (`../ideas/widget/dist/`)
  - Docker containers running (`docker compose up`)

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Integration approach | Embed Ideas widget via UMD bundle | Proven pattern from Pipeline; no custom UI needed |
| Auth approach | Backend proxy with service API key | Avoids Fortium Identity JWT dependency; simpler integration |
| Widget placement | Floating button on every page via Layout | Consistent with Pipeline; always accessible |
| Data storage | Ideas service (not AthleticOS DB) | Feedback lives with the Ideas product; no schema changes |
| GitHub integration | Handled by Ideas service | Auto-creates GitHub Issues; no custom integration needed |

---

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   AthleticOS        │     │   AthleticOS        │     │   Fortium Ideas     │
│   Frontend          │────>│   Backend           │────>│   API               │
│                     │     │   (proxy)           │     │                     │
│ IdeasWidget.tsx     │     │ /api/v1/ideas/*     │     │ /api/submissions    │
│ fortium-ideas.umd  │     │ + JWT user context  │     │ + GitHub Issues     │
└─────────────────────┘     │ + service API key   │     └─────────────────────┘
                            └─────────────────────┘
```

## API Endpoints

### Submit Feedback (Proxy)

```
POST /api/v1/ideas/submissions
```

Any authenticated user. Proxies to Ideas API.

**Request body (from widget):**
```json
{
  "type": "BUG_REPORT",
  "title": "Calendar shows wrong date for away games",
  "description": "...",
  "metadata": {
    "pageUrl": "/schools/clx.../seasons/clx.../calendar"
  }
}
```

Backend enriches with user context before forwarding:
```json
{
  "appId": "athleticos",
  "repo": "FortiumPartners/AthleticOS",
  "type": "BUG_REPORT",
  "title": "Calendar shows wrong date for away games",
  "description": "...",
  "submittedBy": { "email": "coach@tca.edu", "id": "clx..." },
  "metadata": {
    "pageUrl": "/schools/clx.../seasons/clx.../calendar"
  }
}
```

### List Submissions (Proxy)

```
GET /api/v1/ideas/submissions?appId=athleticos
```

Any authenticated user. Returns their own submissions from Ideas API.

---

## Backend Module

### Config

Add to `backend/src/config.ts`:
```typescript
IDEAS_API_URL: z.string().default('https://ideas.fortiumsoftware.com'),
IDEAS_API_KEY: z.string().default(''),
```

### Service

```typescript
// backend/src/modules/ideas/service.ts
// Proxies requests to Fortium Ideas API with service-level authentication
```

### Routes

```typescript
// backend/src/modules/ideas/routes.ts
// POST /ideas/submissions - forward to Ideas API
// GET /ideas/submissions - list user's submissions
```

---

## Frontend Components

### Files

```
frontend/
├── public/
│   ├── js/fortium-ideas.umd.js   (copied from ideas widget dist)
│   └── css/fortium-ideas.css     (copied from ideas widget dist)
├── src/
│   └── components/
│       ├── IdeasWidget.tsx        (React wrapper)
│       └── Layout.tsx             (updated to include widget)
```

### IdeasWidget.tsx

React component that:
1. Loads the UMD bundle script on mount
2. Loads the CSS stylesheet on mount
3. Calls `FortiumIdeas.init()` with config
4. Calls `FortiumIdeas.destroy()` on unmount

Config:
```typescript
{
  appId: 'athleticos',
  repo: 'FortiumPartners/AthleticOS',
  apiUrl: '/api/v1/ideas',
  getContext: () => ({
    pageUrl: window.location.pathname,
    schoolId: getCurrentSchoolId()
  })
}
```

---

## Master Task List

| # | Task | Estimate | Status |
|---|------|----------|--------|
| 1 | Copy widget dist files to frontend/public | 0.5h | [] |
| 2 | Add IDEAS_API_URL and IDEAS_API_KEY to backend config | 0.5h | [] |
| 3 | Create ideas service (proxy logic) | 1h | [] |
| 4 | Create ideas routes (POST + GET submissions) | 1h | [] |
| 5 | Register ideas routes in server.ts | 0.5h | [] |
| 6 | Create IdeasWidget.tsx React wrapper | 1.5h | [] |
| 7 | Integrate IdeasWidget into Layout.tsx | 0.5h | [] |
| 8 | Manual test: submit feedback, verify proxy | 1h | [] |
| 9 | Update TRD document | 0.5h | [x] |

**Total Estimate: ~8 hours (down from 21)**

---

## Testing Strategy

### Manual Testing

1. Load AthleticOS frontend, verify floating feedback button appears
2. Click button, fill out and submit a feature request
3. Verify submission proxies through AthleticOS backend to Ideas API
4. Verify GitHub issue is created in FortiumPartners/AthleticOS repo
5. Verify user context (email, page URL) is included in submission

### Integration Testing

- POST /ideas/submissions with valid body returns 201
- POST /ideas/submissions without auth returns 401
- GET /ideas/submissions returns array of submissions
- Backend correctly enriches request with user context

---

## Acceptance Criteria

- [x] Fortium Ideas widget floating button visible on every page
- [x] Clicking button opens feedback form (feature request, bug report, other)
- [x] Submissions proxy through AthleticOS backend to Ideas API
- [x] User identity (email) auto-attached from AthleticOS JWT
- [x] Page URL auto-captured as context
- [x] GitHub Issue created on submission (handled by Ideas service)
