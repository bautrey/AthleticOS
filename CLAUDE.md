# AthleticOS - Claude Code Instructions

> Unified athletic operations platform for schools
> Last Updated: 2025-01-12

## Quick Start

```bash
docker compose up
```

- API: http://localhost:8003
- Frontend: http://localhost:3005
- API Docs: http://localhost:8003/docs

## Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | Fastify + TypeScript, Prisma, Zod, Vitest |
| Frontend | React 18 + Vite, Tailwind, TanStack Query |
| Database | PostgreSQL 16 (Render - existing instance) |
| Infrastructure | Docker Compose (local), Render (prod) |

## Port Allocation

| Service | Internal | External |
|---------|----------|----------|
| Database | 5432 | 5434 |
| API | 8000 | 8003 |
| Frontend | 3000 | 3005 |

## Database

Uses existing Render PostgreSQL instance with new `athleticos` database.

```bash
# Local: Run migrations
cd backend && npm run db:migrate

# Generate Prisma client
npm run db:generate
```

## API Conventions

- All routes prefixed with `/api/v1`
- JWT auth via `Authorization: Bearer <token>`
- Response format: `{ data: {...} }` or `{ error: { code, message } }`
- Multi-tenancy: `school_id` on tenant-scoped tables

## Module Structure

```
backend/src/modules/<name>/
├── schemas.ts   # Zod validation
├── service.ts   # Business logic
└── routes.ts    # Fastify routes
```

## Commands

```bash
# Backend
cd backend
npm run dev          # Start dev server
npm run test         # Run tests
npm run db:migrate   # Run migrations

# Frontend
cd frontend
npm run dev          # Start dev server
npm run build        # Production build
```
