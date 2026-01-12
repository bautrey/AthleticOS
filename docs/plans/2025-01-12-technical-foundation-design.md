# AthleticOS Technical Foundation Design

> Validated: 2025-01-12
> Status: Ready for implementation

## Overview

Technical foundation for AthleticOS.school — a unified athletic operations platform for schools. This design establishes the project structure, tech stack, database schema, and API patterns that the offshore team will build upon.

## Architecture

### Stack (Canonical Pattern)

| Layer | Technology |
|-------|------------|
| **Backend** | Fastify + TypeScript, Prisma ORM, Zod validation, Vitest |
| **Frontend** | React 18 + Vite, Tailwind CSS / shadcn/ui, TanStack Query |
| **Database** | PostgreSQL 16 on Render (existing instance, new `athleticos` database) |
| **Infrastructure** | Docker Compose (local), Render (prod) |

### Multi-Tenancy

- Row-level isolation with `school_id` on all tenant-scoped tables
- Middleware extracts tenant context from JWT claims
- No cross-tenant data leakage by design

### Authentication

- Email/password with JWT (access + refresh tokens)
- Users can belong to multiple schools with different roles
- Roles: `admin`, `coach`, `viewer`

## Project Structure

```
athleticos/
├── backend/
│   ├── src/
│   │   ├── modules/           # Feature modules
│   │   │   ├── auth/          # Register, login, JWT
│   │   │   ├── schools/       # School CRUD
│   │   │   ├── teams/         # Team CRUD
│   │   │   ├── seasons/       # Season CRUD
│   │   │   ├── facilities/    # Facility CRUD
│   │   │   ├── games/         # Game CRUD
│   │   │   └── practices/     # Practice CRUD
│   │   ├── common/            # Shared utilities
│   │   │   ├── middleware/    # Auth, tenant, validation
│   │   │   ├── errors/        # Error handling
│   │   │   └── utils/         # Helpers
│   │   └── server.ts          # Fastify app setup
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── migrations/        # Migration files
│   ├── tests/
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/        # Shared UI components
│   │   ├── pages/             # Route pages
│   │   ├── hooks/             # Custom hooks
│   │   ├── api/               # API client
│   │   └── App.tsx
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
├── render.yaml
└── CLAUDE.md
```

## Database Schema

### Entity Relationship

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   School    │────<│    Team     │────<│   Season    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │            ┌──────┴──────┐
       │            │             │
       ▼            ▼             ▼
┌─────────────┐  ┌──────┐    ┌──────────┐
│  Facility   │  │ Game │    │ Practice │
└─────────────┘  └──────┘    └──────────┘
       │              │            │
       ▼              └─────┬──────┘
┌─────────────┐             ▼
│  TimeSlot   │←───── (facility booking)
└─────────────┘
```

### Core Tables

| Entity | Key Fields |
|--------|------------|
| `School` | id, name, timezone, settings (jsonb), created_at, updated_at |
| `User` | id, email, password_hash, created_at, updated_at |
| `SchoolUser` | id, school_id, user_id, role (enum), created_at |
| `Team` | id, school_id, name, sport, level (varsity/jv/freshman), created_at, updated_at |
| `Season` | id, team_id, name, start_date, end_date, year, created_at, updated_at |
| `Facility` | id, school_id, name, type (gym/field/pool/court), capacity, created_at, updated_at |
| `TimeSlot` | id, facility_id, day_of_week, start_time, end_time, created_at |
| `Game` | id, season_id, facility_id, opponent, datetime, home_away, status, notes, created_at, updated_at |
| `Practice` | id, season_id, facility_id, datetime, duration_minutes, notes, created_at, updated_at |

### Indexes

- All `school_id` foreign keys indexed for tenant queries
- `User.email` unique index
- `SchoolUser(school_id, user_id)` unique composite
- `Game(season_id, datetime)` for schedule queries
- `Practice(season_id, datetime)` for schedule queries

## API Design

### Base URL

`/api/v1`

### Authentication Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get access + refresh tokens |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Current user with schools/roles |

### Resource Endpoints

All resource endpoints require authentication. Tenant context derived from JWT or route.

| Resource | Endpoints |
|----------|-----------|
| Schools | `GET/POST /schools`, `GET/PATCH/DELETE /schools/:id` |
| Teams | `GET/POST /schools/:schoolId/teams`, `GET/PATCH/DELETE /teams/:id` |
| Seasons | `GET/POST /teams/:teamId/seasons`, `GET/PATCH/DELETE /seasons/:id` |
| Facilities | `GET/POST /schools/:schoolId/facilities`, `GET/PATCH/DELETE /facilities/:id` |
| Games | `GET/POST /seasons/:seasonId/games`, `GET/PATCH/DELETE /games/:id` |
| Practices | `GET/POST /seasons/:seasonId/practices`, `GET/PATCH/DELETE /practices/:id` |

### Middleware Chain

1. **authenticate** — Verify JWT, attach user to request
2. **tenantContext** — Extract school_id, attach to request
3. **authorize** — Check user role for operation
4. **validate** — Zod schema validation for request body

### Response Format

```json
// Success
{
  "data": { ... },
  "meta": {
    "timestamp": "2025-01-12T10:00:00Z"
  }
}

// Error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": { ... }
  }
}
```

## Infrastructure

### Local Development (Docker Compose)

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: athleticos
      POSTGRES_USER: athleticos
      POSTGRES_PASSWORD: athleticos
    ports:
      - "5434:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://athleticos:athleticos@db:5432/athleticos
      JWT_SECRET: dev-secret-change-in-prod
    ports:
      - "8003:8000"
    depends_on:
      - db
    volumes:
      - ./backend:/app
      - /app/node_modules

  web:
    build: ./frontend
    environment:
      VITE_API_URL: http://localhost:8003
    ports:
      - "3005:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules

volumes:
  postgres_data:
```

### Port Allocation

| Service | Internal | External |
|---------|----------|----------|
| Database | 5432 | 5434 |
| API | 8000 | 8003 |
| Frontend | 3000 | 3005 |

### Production (Render)

- **Database**: New `athleticos` database on existing Render PostgreSQL instance
- **API**: Render Web Service (Docker)
- **Frontend**: Render Static Site

## Deliverables

### Included in Foundation

1. Project structure (backend/, frontend/, docker-compose.yml)
2. Prisma schema with all core entities
3. Auth module (register, login, JWT, middleware)
4. CRUD scaffolding for Schools, Teams, Seasons, Facilities, Games, Practices
5. Tenant isolation middleware
6. Basic frontend with auth flow and dashboard shell
7. CLAUDE.md with project conventions
8. render.yaml for deployment

### Not Included (Future Sprints)

- Scheduling engine / conflict detection
- Notifications and workflow triggers
- SportsYou export / sync
- Weather & exam-week rescheduling
- Advanced role permissions

## Success Criteria

- [ ] `docker compose up` starts all services
- [ ] Can register user, login, get JWT
- [ ] Can create school, team, season, facility
- [ ] Can create game and practice
- [ ] Tenant isolation prevents cross-school data access
- [ ] Frontend shows login and basic dashboard
- [ ] Deploys to Render successfully
