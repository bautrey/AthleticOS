To: Truman
From: Burke
Subject: TCA athletics ops call — May 21 recap + next steps

---

Truman,

Recap of Thursday's call with Beck, Melissa, and the team. Pulling out what's actionable for us.

## System landscape — clarified

Spent the first ~30 minutes mapping how data actually moves at TCA today. Useful baseline:

| System | Role | How data gets in | Owner today |
|---|---|---|---|
| FinalSite | Public TCA website shell (TrinityChristian.org). **Holds no athletics data.** | n/a | Marketing/IT |
| Sidearm | Public athletics site. Renders all team schedules, news, rosters externally. The "/athletics" link on TCA.org goes here. | **100% manual entry by Andrew today** (Kathy did it until she left in January) | Andrew → Allison Pierce starting Mon May 25 |
| Blackbaud | SIS — student records, rosters, parent login, master calendar. Roster has to be entered here first. | Roster from coach → upper school → Blackbaud (manual) | Multiple touchpoints |
| SportsU | Parent communication app. Replaced Blackbaud for group email because Blackbaud's group email is painful. Calendar entries here also manual. | Manual by coaches | Coaches |
| SchoolDude | Facility scheduling. Tied to game scheduling because games need a facility reservation. | Manual | Facilities |
| TAPPS TMS | Compliance / eligibility | Manual | Athletics admin |

Sidearm and Blackbaud may talk to each other, but Melissa wasn't 100% sure how — that's part of what they need to map.

## The thesis everyone aligned on

- **Calendar is the thing.** Beck was emphatic: "calendar is everything in this." Roster matters less, communication is a fast-follow, but the calendar — and the conflict/blocker handling around it — is the core problem.
- **One coach-facing entry point** that either pushes to the other systems or replaces them. Coaches today fill out a fillable Word doc → Kathy/Andrew → manual entry in 3 places. That chain is the failure mode.
- **Pilot small.** Start with one sport (varsity football was floated — only 10 games, predictable cadence) and map outward: schedule → facility → concessions → master calendar → comms.
- **Map first, then build.** Multiple people said this — they need to nail down "who touches what" before we start pushing data anywhere.

## Things I didn't know that changed my mental model

- **Schedules are finalized BEFORE rosters.** Schedule is the first thing on the season timeline.
- **Football is the only sport with multi-year contracts** (2-year home/home). Every other sport is year-to-year via coach-to-coach email — exactly the unstructured negotiation our marketplace idea is for.
- **No real deadline for non-district games.** Even mid-season a school can cancel and you're back to email-hunting. Schedule volatility is a feature, not a bug, of how this works.
- **Kathy was getting ~120 SchoolDude notifications a day to approve.** SchoolDude is "a significant problem" and is already on Lisa's list to replace. Tens of thousands of dollars a year. We may be solving more than scheduling here.
- **Beck has lived this at a previous school using Blackbaud-only.** He had weekly "from the bench" emails through Blackbaud group email tied to the team roster, and it worked when rosters were 100% accurate. He sees the pattern.

## Risk Beck raised — directly

Verbatim, from him: *"We wouldn't even be sitting here talking to this today if all these systems weren't proprietary and living in the 1980s of not wanting to talk to each other."* And then: *"Are we sure we want to do this?"*

The concern is adding another silo. Worth holding onto. Our pitch needs to keep being "we replace pieces or we sync; we don't add a 5th place to enter data."

## Concrete next steps (with owners)

| # | Action | Owner | Status |
|---|---|---|---|
| 1 | Lisa to take SKY API access request through TCA legal (Julie) | Lisa | In progress — she said "we have to go through our legal counsel" |
| 2 | Melissa to connect Burke to the different system owners (Sidearm/Andrew, SchoolDude, etc.) so I can get login or API access for research | Melissa | Confirmed on call |
| 3 | **Burke to draft a development engagement agreement** — what we do/don't do with TCA data, scope, 90-day window, "development partnership now, paid later" framing | **Burke** | **Not started — biggest near-term blocker** |
| 4 | Truman/Beck to do a process map — who touches what, in what order, for a single sport | Truman + Beck | Mentioned but undated |
| 5 | No sandbox available at TCA — confirmed we go straight at production with a scoped pilot | n/a | Decided |
| 6 | Allison Pierce starts Mon May 25 as the new sports info coordinator — she'll be a key user/contact | Melissa onboarding her | In progress |

## What I'd suggest we focus on this week

1. **I'll draft the engagement agreement** (item #3) and send it to you for review before it goes to Melissa/Lisa. That's the unblock for everything else.
2. **You and Beck do the process map** (item #4) — even just one sport, one season, on a whiteboard. Photo of the whiteboard is enough. That gives us the integration sequence to build against and de-risks the "are we sure we want to do this" concern by showing we understand the existing flow before we touch it.
3. **I'll loop with Melissa on Sidearm/SchoolDude access** (item #2) so I can prototype the integrations against real data instead of guesses.

The Blackbaud SKY app is already registered and the integration is built in mock mode (per my May 17 note to Lisa/Melissa) — so the moment legal clears item #1, we can run the OAuth handshake and start reading real data.

Anything I missed or got wrong from your view of the call?

Burke
