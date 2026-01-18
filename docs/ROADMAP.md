# AthleticOS Roadmap

> Last Updated: 2026-01-16

This document outlines future features and enhancements planned for AthleticOS beyond the current implementation.

---

## Completed

### PRD-001: Constraint-Aware Schedule Reconciliation
**Status**: Complete (2026-01-16)

Implemented the core scheduling reconciliation engine:
- Blockers as first-class entities (TRD-001)
- Conflict detection service (TRD-002)
- Reconciliation UI with warnings and overrides (TRD-003)
- CSV schedule import and shareable links (TRD-004)

---

## Future Features

### Google Calendar Integration
**Priority**: High
**Estimated PRD**: PRD-002

Read-only import from Google Calendar to sync external schedules.

**Scope**:
- OAuth2 integration with Google Calendar API
- One-way sync (Google -> AthleticOS)
- Automatic conflict detection on imported events
- Periodic refresh (configurable interval)

**Why deferred**: Adds complexity with OAuth flows and external API dependencies. The current CSV import covers most use cases for initial launch.

---

### SportsYou Export/Sync
**Priority**: Medium
**Estimated PRD**: PRD-003

Integration with SportsYou for communication sync.

**Scope**:
- Export schedule changes to SportsYou
- Sync team rosters
- Push notifications on schedule updates

**Dependencies**: SportsYou API access and partnership

---

### Weather-Based Rescheduling Suggestions
**Priority**: Medium
**Estimated PRD**: PRD-004

Proactive rescheduling suggestions based on weather forecasts.

**Scope**:
- Weather API integration (e.g., OpenWeatherMap)
- Automatic weather blockers for severe conditions
- Suggested alternative dates based on forecast
- Notification system for weather alerts

---

### Cross-School / League Coordination
**Priority**: Low
**Estimated PRD**: PRD-005

Multi-school scheduling coordination for leagues.

**Scope**:
- League-level blocker sharing
- Cross-school facility availability
- Referee/official assignment integration
- League-wide schedule views

**Why deferred**: Requires significant multi-tenancy changes and partnership agreements.

---

### Advanced Role Permissions
**Priority**: Low
**Estimated PRD**: PRD-006

Granular permission system beyond current admin/coach/viewer roles.

**Scope**:
- Custom role creation
- Per-team permission assignments
- Audit logging for permission changes
- Parent role with limited access

---

### Full Schedule Generation / Optimization
**Priority**: Low
**Estimated PRD**: PRD-007

Automatic schedule generation for round-robin tournaments.

**Scope**:
- Tournament bracket generation
- Constraint-based schedule optimization
- Home/away game balancing
- Travel distance minimization

**Why out of scope**: This is an NP-hard problem requiring specialized algorithms. AthleticOS focuses on reconciliation, not optimization.

---

### Import from Other Scheduling Apps
**Priority**: Low
**Estimated PRD**: PRD-008

Import support for popular scheduling platforms.

**Scope**:
- MaxPreps import
- Arbiter Sports import
- Schedule Star import
- Custom field mapping

---

## Prioritization Criteria

Features are prioritized based on:

1. **User Impact**: How many users benefit and how significantly
2. **Implementation Complexity**: Development effort and technical risk
3. **Dependencies**: External API/partnership requirements
4. **Strategic Alignment**: Fit with core product vision (reconciliation over optimization)

---

## Contributing

To propose new features:
1. Create a PRD following the template in `/docs/prd/`
2. Include user stories, success metrics, and scope boundaries
3. Submit for review before TRD development
