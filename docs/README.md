# AthleticOS Documentation

This directory contains all project documentation for AthleticOS.

## Structure

```
docs/
├── README.md           # This file
├── ROADMAP.md          # Future features and enhancements
├── prd/                # Product Requirements Documents
│   └── 001-constraint-aware-scheduling.md
└── trd/                # Technical Requirements Documents
    ├── 001-blockers-and-constraints.md
    ├── 002-conflict-detection-service.md
    ├── 003-reconciliation-ui.md
    └── 004-schedule-import-and-sharing.md
```

## Document Types

### PRD (Product Requirements Documents)
Located in `/prd/`. Define **what** we're building and **why**.

- Problem statement and target user
- User stories and acceptance criteria
- Success metrics
- Scope boundaries (in-scope vs out-of-scope)

### TRD (Technical Requirements Documents)
Located in `/trd/`. Define **how** we're building it.

- Data models and API specifications
- Component designs
- Test strategies
- Implementation tasks

## Current Status

| Document | Status | Description |
|----------|--------|-------------|
| PRD-001 | Complete | Constraint-aware schedule reconciliation |
| TRD-001 | Complete | Blockers & constraints data model |
| TRD-002 | Complete | Conflict detection service |
| TRD-003 | Complete | Reconciliation UI |
| TRD-004 | Complete | Schedule import & shareable links |

## Naming Conventions

- PRDs: `NNN-short-description.md` (e.g., `001-constraint-aware-scheduling.md`)
- TRDs: `NNN-short-description.md` (e.g., `001-blockers-and-constraints.md`)

PRD and TRD numbers are independent sequences. A single PRD may spawn multiple TRDs.

## See Also

- [ROADMAP.md](./ROADMAP.md) - Future features and enhancements
- [Project CLAUDE.md](/CLAUDE.md) - Development guidelines
