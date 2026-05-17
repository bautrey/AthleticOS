# AthleticOS Backlog

Items identified from the Truman sync (March 14), coaches demo meeting (March 18, 2026), stakeholder meeting with Beck/Lisa/Melissa (April 15, 2026), and Truman's brainstorm list with Beck's prioritization (April 18 / May 7, 2026).

## Beck's Prioritization (May 7, 2026 email)

> "This is a great list Truman. The first four are most important, for sure. Most of the rest are bonus functions in my opinion." — Beck Brydon, May 7, 2026

Truman sent Beck a 17-item brainstorm list on April 18. Beck's reply confirms the **top 4 = focus, rest = bonus**. This is the clearest prioritization signal we've gotten from TCA leadership.

### The Four That Matter (Beck-confirmed)

1. **Accurate calendar with all teams and training facilities** (in-season AND offseason)
   - Maps to: P0 #1 (Read-Only Facility Calendar) — but **expand scope** to include offseason and the Athletic Training Center, not just in-season game/practice
2. **Accurate school calendar with exams, assemblies, fine arts performances, in-service dates**
   - Maps to: P0 #3 (Academic Calendar Integration / Blocker Import) — non-athletic events that create conflicts
3. **System that identifies conflicts and alerts the appropriate leadership**
   - Already core to AthleticOS. Reinforces #15 (Cross-System Disconnect Detection) and #4 (Automatic Notifications on Schedule Changes)
4. **Coaches can enter game schedule requests and see open dates and conflicts**
   - Self-service scheduling with real-time conflict visibility. Touches P0 #1, P1 #6 (Game Marketplace), and the request/approval flow. **Not yet a single backlog item — needs to be carved out.**

### Truman's Full List (April 18 brainstorm)

Reproduced verbatim for context. Items 1-4 are Beck's priorities; items 5-17 are "bonus" per Beck.

1. accurate calendar with all teams and training facilities (both in season and offseason)
2. accurate school calendar with exams, assembly dates, fine arts performances, in-service dates
3. system that identifies conflicts and alerts the appropriate leadership
4. ability for coaches to enter game schedule requests and see open dates and conflicts
5. Coach onboarding checklists and automated reminders for compliance and CE *(P1 #5)*
6. connectivity between athletic website and Sportsyou (or whatever is used for parent communication). Master calendar that can be trusted. *(P2 #9, P2 #17)*
7. ability to invite other schools to MS game scheduling system *(P1 #6 game marketplace)*
8. ability to connect coaches who share dual sport athletes to see conflicts and work together *(new — not previously captured)*
9. calendar system for the Athletic Training Center to get athletes into in-season and offseason development programs *(rolled into #1)*
10. checklist of alerts for away game management — vans, buses, early release alerts to MS and US administration *(P0-NEW #16, P2 #8 transportation)*
11. checklist of alerts and reminders for special events — senior night, Little Trojan night, teacher appreciation *(P1 #7 special events)*
12. checklist for volunteer planning for football games and track meets *(new — volunteer roster + assignment)*
13. calendar system for lower school teams to reserve space on TCA facilities *(extension of P0 #1)*
14. calendar component to request space in the US for kickoff parent meetings and post-season banquets *(P1 #7 special events)*
15. place to register all game volunteers so TCA staff/admin know who is running the clock, etc. *(extends #12)*
16. auto reminder sent to each opponent TCA is hosting the day before the match/game *(P0 #4 notifications, opponent channel)*
17. connection to Arbiter to request and confirm referees *(P2 #10)*

### Newly-surfaced items not previously in backlog

- **Dual-sport athlete conflict visibility for coaches** (Truman #8) — Coaches who share an athlete should see each other's practice/game schedule and resolve conflicts together. Not just a parent-facing calendar — a coach-collaboration tool. Suggested as a P1.
- **Volunteer roster + game-day assignment** (Truman #12, #15) — Who's running the clock, scoreboard, gate, concessions for football/track? Today this is tribal knowledge. Suggested as a P1.
- **Opponent-school day-before reminders** (Truman #16) — Auto-DM/email the visiting school the day before a home match. Small feature, low risk, high "did this just save a coach a phone call?" value. Suggested as a P1 add-on to the notifications system.
- **Lower school facility reservations** (Truman #13) — Lower school teams reserving TCA facilities. Extends the same facility calendar but with a different requester role.


## Strategic Direction (April 15 Meeting)

> **"Traffic cop, not operating system."** — Beck Bryden
>
> AthleticOS should detect inconsistencies across existing systems and flag where balls are dropping, NOT try to replace all systems. Simple is best. Do the minimum to execute at a higher level.

### Current System Landscape (to be mapped by Beck + Truman)

| System | Purpose | Integration Path | Researched |
|--------|---------|-----------------|------------|
| Blackbaud | SIS, master school calendar, athletics scheduling | SKY API (OAuth2). Master calendar read-only, BUT **athletics module has write APIs**: `POST /athletics/teams/{id}/schedule` + practice/opponent/location/result endpoints. Requires "Data Sync" role at TCA. **CONFIRMED by Melissa Neatherlin (2026-04-15): TCA has the athletics scheduling module and allows SKY API Data Sync for approved apps.** | Yes — CONFIRMED |
| SchoolDude | Facility scheduling | Replace for athletics use case | No |
| Sports You | Parent/player communication | **No API.** ICS feed subscription only (Sprint 3 feeds work here) | Yes |
| FinalSite | TCA website hosting | Has limited API — check if it bridges to Sidearm | Partial |
| Sidearm Sports | Athletics website (Learfield-owned, via FinalSite) | **No API.** ICS import or scrape public pages for disconnect detection | Yes |
| TAPPS TMS | Compliance/eligibility (replacing RankOne) | **No API.** Proprietary closed portal (tms.tapps.biz). Manual CSV only. | Yes |
| Arbiter | Referee scheduling | Walled off — manual bridge initially | No |
| Exchange/O365 | Teacher calendars | ICS subscription + Graph API if needed. Mixed adoption. | Yes |

**Key insight:** ICS calendar feeds (already built in Sprint 3) are the universal connector. Sports You, Sidearm, Blackbaud, and Exchange can all subscribe to ICS. This makes AthleticOS the source of truth that feeds all downstream systems.

### Next Steps (from April 15)
- [ ] Beck + Truman: Map all systems — what they do, what they don't, send to Burke
- [ ] Beck: Compile global AD pain points
- [ ] Reconnect ~April 29 to review mapping and pick focused first step
- [ ] Beck visit to Sherman for half-day working session (after house sells)

## Completed (Pre-Demo)

- [x] Seed data variety — diverse conflict types, weather blocker, facility double-bookings
- [x] Apply Slot button — resolve conflicts by rescheduling, not just overriding
- [x] Real TCA facility names — Tom Landry Stadium, MCB Gym, Field House, etc.
- [x] Favicon and page title branding

## Sprint 4 Candidates (Post-Demo Priority)

### P0 — High Impact, Validated by Coaches

#### 1. Read-Only Facility Calendar for Coaches
**Source:** Jim — "I get asked 10 times a day if the MCB Gym is available at 4:30. They can't see SchoolDude."
- Coaches can VIEW facility availability calendar without editing rights
- Shows games, practices, approved facility requests, and blockers on a per-facility timeline
- Role-based: coaches can view + request, only AD/admin can approve
- **This is the SchoolDude killer feature**

#### 2. Single-Source Calendar Publish (ICS + Website Push)
**Source:** Jim — "12 schedule changes to 12 different calendars." Sam — wrong game times on the board.
- ICS feeds already built (Sprint 3) — need UI to discover/copy feed URLs
- Per-team and per-facility calendar feeds
- Parent-friendly: "Print out on Sunday night and hand it to the nanny"
- Future: push to Sports You, school website, Blackbaud

#### 3. Academic Calendar Integration (Blocker Import)
**Source:** Truman, multiple coaches — "We didn't know each other had that."
- Upper school rep (Craig Wilson / Camille) enters academic events: exams, concerts, choir, plays
- These become blockers that create conflicts automatically
- Could be manual entry (COMMUNITY role) or ICS import from Blackbaud
- Key dates: exam weeks, early releases, school plays, choir concerts, band events
- **Political note:** Need buy-in from Lisa Wong + Melissa Neer (tech side)

#### 4. Automatic Notifications on Schedule Changes
**Source:** Jim — "12 different calendars to update." Multiple coaches — "human error in the punch list."
- When a game/practice is created, moved, or canceled: auto-notify affected parties
- Notification targets: coaches, team parents (future), referees (future)
- Channels: email (built), SMS (built), push to calendar feeds (built)
- Need a "subscribe to team" or "subscribe to facility" concept
- **This eliminates the punch list**

### P1 — Medium Impact, Strong Interest

#### 5. Coach Onboarding Checklist
**Source:** Truman — "automate coach orientation." Jim — "100-page handbook."
- Seasonal coach joins → auto-generated checklist: compliance, CMS clearance, facility access, handbook acknowledgment
- Orientation video links embedded in checklist items
- Track completion status per coach per season
- Separate from game-day Operations checklists — this is HR/compliance
- Dual-sport athlete policy distribution

#### 6. PSA-Style Game Marketplace
**Source:** Rodney, middle school coaches — "I'm available these dates, who wants to play?"
- Schools post available dates/times
- Other schools browse and request matchups
- Auto-detects conflicts before confirming
- Middle school priority: "volume over strategy — just get 12 on the schedule"
- **TAPPS expansion feature** — every private school needs this

#### 7. Special Events Model
**Source:** Truman (original sync) — Senior Night, banquets, Little Trojan Night, tailgates.
- Events that aren't games or practices but need facilities and coordination
- Types: ceremony, banquet, community event, fundraiser
- Tie to Operations checklists (setup/teardown)
- Could block facilities like a game does

#### 8. Transportation / Van Tracking
**Source:** Speaker 5 — "transportation stuff on it too"
- School has X vans available
- Away games need transportation scheduled
- Coaches shouldn't have to call to check van availability
- Similar pattern to facility booking: view availability, submit request, get approved

### P2 — Future / Requires External Buy-In

#### 9. Sports You Calendar Integration
- TCA uses Sports You for parent/player communication (free app, COPPA compliant, Dallas-based)
- **Confirmed April 15:** No public API, no webhooks, no dev docs, no partner program
- **Integration path:** Coaches subscribe to AthleticOS ICS team feeds within Sports You app (ICS subscription supported)
- Already built: Sprint 3 F5 generates per-team and per-facility ICS feeds
- **Action needed:** Make ICS feed URLs easy to discover in the UI (copy-to-clipboard, QR code for mobile)
- **Boundary:** AthleticOS = internal ops, Sports You = parent-facing comms

#### 10. Arbiter (Referee) Integration
**Source:** Truman — "If a game gets canceled, that's another step — make sure referees don't show up."
- When game is canceled/rescheduled, auto-notify Arbiter or flag for AD
- Referee payment tracking → auto-generate payment sheets for business office
- Arbiter is likely a walled-off system — may need manual bridge initially

#### 11. Blackbaud Integration
- Master school calendar lives in Blackbaud
- **Confirmed April 15:** Lisa Wong: "It's one way out — we can't push it in." — This is true for the **master school calendar**, but...
- **DISCOVERED:** Blackbaud SKY API has **full write access for athletics scheduling**: `POST /school/v1/athletics/teams/{team_id}/schedule` creates games. Also: practice create, opponent create, location create, result POST. Blackbaud internally propagates athletics events to the master calendar.
- **This means two-way sync is possible** — AthleticOS pushes games/practices to Blackbaud Athletics via API, Blackbaud handles putting them on the master calendar.
- Requires: TCA enables "SKY API Data Sync" role for AthleticOS app. Lisa's team would do this.
- ON API (legacy) also has `PUT GameCreate` and `PUT GameUpdate` endpoints.
- [bbapi_toolkit](https://github.com/Lugal-PCZ/bbapi_toolkit) — Python SKY API wrapper (open source)
- Athletic early-release lists need to flow to front office (Jennifer Poole → Jennifer Tristan → teachers)
- **✅ Athletics module CONFIRMED** (2026-04-15): Melissa Neatherlin confirmed TCA's Blackbaud includes athletics scheduling and allows SKY API Data Sync for approved apps. Module has been set up before; room to improve utilization. More features may be available.
- **Political blocker:** Lisa wants full system mapping before committing to integration scope
- **Data privacy:** Lisa raised concerns about student data storage — needs secure hosting discussion
- **No off-the-shelf product** pushes athletics INTO Blackbaud — AthleticOS would be first

#### 12. Multi-School / Inter-School Scheduling
- Cross-school visibility into schedules
- District-level conflict detection
- TAPPS integration for league scheduling
- **Way out of scope for now** — but the coaches brought it up independently

#### 13. CMS / Compliance Clearance Tracking
**Source:** Sam — tennis coach CMS clearance issue, two emails didn't sync.
- Track coach compliance status (background check, CMS clearance, certifications)
- Alert AD when clearance expires or is incomplete
- Connect to existing school compliance systems if possible

#### 14. Referee/Trainer Resource Scheduling
**Source:** Rodney — "Russ and Bailey need to know how many games today to schedule trainers."
- Athletic trainers need visibility into game count per day
- Auto-calculate staffing needs based on event count and type
- Request additional trainers when threshold exceeded

### P0-NEW — Disconnect Detector (April 15 Priority)

#### 15. Cross-System Disconnect Detection
**Source:** Beck Bryden (April 15) — "If we had a system that recognized the disconnects in all the places, that in and of itself would be [amazing]."
- AthleticOS monitors calendars across systems (Blackbaud, Sports You, Sidearm, ICS feeds)
- Flags when event data is inconsistent between systems
- Dashboard showing: "These 5 events don't match across your systems"
- **This is Beck's #1 excitement** — the thing that got him "really excited and fired up"
- Requires: Blackbaud SKY API read access, Sports You scraping, Sidearm scraping

#### 16. Early Release Workflow Automation
**Source:** Truman (April 15) — described the manual chain: coach → AD → Craig → student list → Jennifer Poole → Jennifer Tristan → teachers
- When away game is scheduled, auto-generate early release list
- Push notification to front office and relevant teachers
- Teachers see which students are leaving and when, automatically
- **Highest-impact single workflow** — eliminates multi-person email chain
- Requires: student roster (manual or Blackbaud import), teacher notification channel

#### 17. Sidearm Sports / Website Calendar Sync
**Source:** Melissa Neer (April 15) — "there's a whole other part which is Sidearm"
- FinalSite hosts TCA website, Sidearm Sports handles athletics section
- Athletic calendar on website needs to stay in sync with AthleticOS
- Explore Sidearm API or ICS feed push
- Currently another manual sync point that causes errors

## Political / Organizational Notes

- **Key stakeholders for school-wide buy-in:** Dr. Jeff Williams (head of school), Pat Beach (exec board, TAPPS connection), Lisa Wong + Melissa Neer (tech), Craig Wilson (upper school)
- **Beck Bryden is now actively engaged** — executive AD, still in Houston, moving to Dallas. Wants half-day working session with Burke in Sherman once house sells.
- **Athletics is physically isolated** — different building from main campus, "red-headed stepchild" dynamic
- **Kathy Denny departed** — 31-year veteran coordinator. Her institutional knowledge is at risk. Beck's new admin assistant lacks this history.
- **Budget angle:** "What is TCA spending on SchoolDude? What if this costs less?" + coach salary hours on admin vs. coaching
- **Fall target:** Have something testable by fall sports season start
- **Melissa's team (Jennifer Moore)** will help train coaches and establish workflows — need to include them once processes are defined
- **Student involvement idea** — Truman floated engineering/entrepreneurship students contributing PRs to AthleticOS. Burke enthusiastic.
- **Data privacy** — Lisa Wong raised concerns about student data. Needs secure hosting discussion (AWS/GCP/Azure, not just Render).
- **Beck's philosophy:** "Better clarification on expectations + accountability between me and coaches will fix some gaps." He's setting a higher bar for coaches even though many are part-time.
