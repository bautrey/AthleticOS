# Backlog Items from Truman Sync (March 14, 2026)

Items identified from the demo prep conversation that are NOT yet built.

## Pre-Demo (before March 18)

### 1. Seed Data Variety
**Priority: HIGH** — Truman noticed all conflicts were the same type during the walkthrough.
- Ensure demo seed has diverse conflict types: facility double-booking, time overlap, blocker overlap (exams), and priority-based
- At least 2-3 conflicts should have suggested resolutions (not just overrides)
- Add a weather blocker to demo rain plan scenario

### 2. Special Events / School Calendar Events
**Priority: MEDIUM** — Truman talked about banquets, Senior Night, Teacher Appreciation Night, Little Trojan Night, tailgates, community cookouts.
- These don't fit neatly as "Game" or "Practice"
- Need a generic "Event" type or expand blockers to cover school-wide events
- Could be entered as blockers for now (they block other scheduling), but feels wrong semantically

### 3. Make Conflict Summary Clickable
**Priority: LOW** — Burke noted during walkthrough that conflict counts on dashboard aren't clickable. They should link to `/schools/:schoolId/conflicts`.

## Post-Demo / Sprint 4 Candidates

### 4. Sports You Calendar Integration
- TCA uses Sports You for parent/player communication
- AthleticOS should be able to export/push calendar to Sports You
- Sports You may not have a public API — might need browser automation agent
- **Boundary decision:** AthleticOS is internal ops, Sports You is parent-facing

### 5. Master School Calendar Import
- TCA has a master school calendar (possibly in Blackbaud)
- Academic events (chapel, concerts, exams) create conflicts for athletics
- Could import as blockers from an external calendar feed (ICS import?)
- Each school division (lower/middle/upper) has a tech person who could enter them

### 6. School-Wide Text/SMS Alerts
- TCA has a school-wide texting system for emergencies (e.g., "lower school lost power")
- Athletics doesn't have its own equivalent
- AthleticOS notifications could fill this gap for athletics-specific alerts (lightning, game delays)
- Integration with school's existing text system is a longer-term goal

### 7. Game Day Logistics Expansion
- Football has extensive game-day ops: referee meals, helmet inflation, PA system, etc.
- Currently managed via spreadsheets
- Our Operations Checklists module handles this, but may need sport-specific templates
- Should create a football game day template as demo data

### 8. RSVP for Optional Events
- Sports You has RSVP for practices (coaches want to know if 10+ players will attend holiday practice)
- Out of scope for AthleticOS v1 — this stays in Sports You
- Note: if we ever add player/parent portal, RSVP would be a natural feature

### 9. Coordinator/Admin Role Workflows
- Truman mentioned delegating operational tasks to coordinators
- Current roles: ADMIN, AD, COACH, PARENT, ATHLETE, COMMUNITY
- May need to refine what COACH vs AD can delegate
- "Kathy role" — the coordinator who handles logistics so coaches can coach

### 10. Multi-School / Inter-School Scheduling
- Truman mentioned eventually "coordinating our athletics with other schools' athletics"
- Way out of scope for now, but worth noting on the roadmap
- Would require cross-school visibility into schedules
