To: Truman (to forward to Beck, Lisa, Melissa)

Subject: AthleticOS -- April 15 Meeting Summary + Next Steps

---

Hey Truman,

Great calls today -- both the group meeting and our follow-up. Here's a full summary so everyone's on the same page. Feel free to forward this to Beck, Lisa, and Melissa.


WHAT WE AGREED ON

Strategic direction: AthleticOS should be the "traffic cop" -- it sits above all the existing systems, detects when things are out of sync, and flags where balls are being dropped. We're not trying to replace everything at once. Simple is best. Get really good at one thing and build momentum.

Before we build anything new, we need to map out what every system does and where the gaps are.


ACTION ITEMS

Beck + Truman:
  - Fill in the system mapping template (attached) -- just what you know from using these systems day-to-day. Don't worry about the technical integration stuff, I'll handle that separately. (Before next meeting)

Beck:
  - Rank the pain points from a global AD perspective -- which ones hurt the most day-to-day (Before next meeting)

Truman:
  - Check with Melissa/Lisa on summer availability (Next week)

Burke:
  - Research all external systems for integration capabilities (Done -- see below)
  - Work with Lisa and Melissa directly on the technical integration questions (Before next meeting)

Lisa:
  - DONE -- Melissa confirmed that TCA's Blackbaud subscription includes the athletics scheduling module, and they allow SKY API Data Sync for approved apps. Next step: enable Data Sync role for AthleticOS app in Blackbaud admin portal.

Melissa:
  - DONE (Blackbaud) -- Melissa confirmed TCA has the athletics scheduling module and allows SKY API Data Sync. She also noted the module has been set up in the past but there's room to improve how it's utilized, and more features may be available.
  - STILL NEEDED -- I'd like to set up a quick call to understand how Sidearm Sports and FinalSite are configured for TCA -- specifically what options exist for getting schedule data in and out. (Before next meeting)

All:
  - Reconnect in ~2 weeks (~April 29) to review mapping and pick the first focused thing to build. Truman to confirm timing.


SYSTEM RESEARCH RESULTS

I did a deep dive on every system TCA uses to understand what's possible. Here's what I found:

Blackbaud -- SIS, master school calendar, athletics scheduling
  Lisa is right that the master school calendar is read-only -- you can't push events into it via their API. However, I discovered that Blackbaud has a separate athletics scheduling module with official write access. More on that below.
  Status: Verified.

Sports You -- Parent/player communication, team messaging
  No public API or developer program. I need to look at the app directly to understand what import/sync options it has, if any.
  Status: Need to investigate further.

Sidearm Sports -- Athletics section of TCA website (via FinalSite)
  No public API. Closed platform owned by Learfield. I need to talk to Melissa about what options exist for getting data into it.
  Status: Need to investigate with Melissa.

TAPPS TMS -- Compliance, eligibility, physicals (replacing RankOne)
  No API. Proprietary system built internally by TAPPS. No known way to get data in or out programmatically.
  Status: Verified -- dead end for automation.

SchoolDude -- Facility scheduling
  AthleticOS would replace this for athletics use cases.
  Status: Not yet researched.

Arbiter -- Referee scheduling
  Not yet researched.
  Status: Need to investigate.

Exchange / O365 -- Teacher/staff calendars
  Full integration possible. Outlook and Exchange natively support subscribing to external calendar feeds (ICS). Teachers could subscribe to team or facility calendars from AthleticOS and see schedule changes automatically.
  Status: Verified.


THE BIG DISCOVERY: BLACKBAUD HAS ATHLETICS WRITE APIs

Lisa said "it's one way out -- we can't push it in," and she's right about the master school calendar. But here's what I found:

Blackbaud has a separate athletics scheduling module with full write access via their official API (SKY API):
  - Create games
  - Create practices, opponents, locations, and results
  - All via officially supported endpoints

What this means: AthleticOS could push games and practices directly into Blackbaud's athletics system via API. Blackbaud then internally handles how those athletics events appear elsewhere in the system (including potentially the master school calendar). No scraping, no workarounds -- this is the officially supported path.

What TCA would need to do: Enable "SKY API Data Sync" for AthleticOS in the Blackbaud admin portal. Lisa's team would handle this.

This is a big deal because no off-the-shelf product currently pushes athletics data INTO Blackbaud -- tools like FMX and SchoolCal only pull data out. We'd be the first to close this loop.

UPDATE: Melissa Neatherlin (Director of Technology) confirmed that TCA's Blackbaud subscription DOES include the athletics scheduling module, and they allow SKY API Data Sync for approved apps. She noted the module has been set up before but there's room to improve utilization, and more features may be available. This path is confirmed and ready to build.


ICS CALENDAR FEEDS -- WHAT WE KNOW AND DON'T KNOW

We already built ICS calendar feeds in AthleticOS -- one for every team and facility. ICS is a standard calendar format.

What I can confirm works:
  - Outlook / Exchange -- Teachers and staff can subscribe to feeds. This is a standard, verified feature of Outlook.
  - Google Calendar / Apple Calendar -- Any parent or coach can subscribe on their personal calendar. Standard, verified.

What I still need to verify:
  - Sports You -- I need to look at it myself to see if it supports external calendar subscriptions.
  - Sidearm / TCA Website -- I need to talk to Melissa about what's possible.
  - Blackbaud -- May be unnecessary if the athletics API write path works.


BIGGEST PAIN POINTS WE'VE IDENTIFIED

1. Early release chain -- Coach changes a game -> emails AD -> AD emails Craig -> Craig needs student list -> list goes to Jennifer Poole -> then Jennifer Tristan -> then teachers. All manual. Any break = teachers don't know kids are leaving.

2. Calendar sync across systems -- A schedule change in one place doesn't propagate. "12 schedule changes to 12 different calendars."

3. Part-time coach admin burden -- Coaches with full-time jobs can't handle the admin. Technology should remove that friction.

4. No institutional knowledge capture -- Kathy's 30 years of history walked out the door. New staff will drop balls without a system to catch them.

5. Cross-system disconnects -- Nobody knows when the website says one thing, Sports You says another, and the actual schedule is something else.


WHAT WE'RE THINKING FOR THE FIRST BUILD

Based on Beck's "what's the first thing we can get really good at?" question:

Option A -- Blackbaud Athletics Sync (CONFIRMED FEASIBLE)
Connect AthleticOS directly to Blackbaud via their athletics API. When a coach enters a game in AthleticOS, it automatically appears in Blackbaud. This solves pain point #2 at the most important integration point and proves the concept with a real two-way connection. Melissa confirmed TCA has the athletics module and allows API Data Sync -- this path is green-lit.

Option B -- Disconnect Detector
A dashboard that reads from every system we can access and flags when event data doesn't match. "These 5 events are different across your systems." This is the thing that got Beck fired up.

Option C -- Early Release Automation
When an away game is scheduled, auto-generate the early release list and push it to the front office and teachers. Eliminates the 6-person email chain.

Option D -- ICS Feed Discovery UI
Simplest win: make it easy for coaches to find and subscribe to their team's calendar feed for personal calendars (Outlook, Google, Apple). Solves "I didn't know about the schedule change" for anyone willing to subscribe.

We don't have to pick just one -- but we should pick one to get really good at first.


TIMELINE

Now -> April 29: System mapping, pain point prioritization, Burke investigating integration capabilities with Lisa and Melissa
~April 29: Reconvene same group, review mapping, pick first build target
May -> Summer: Build the first thing. Beck and Melissa's team available for testing and training.
Fall 2026: Something usable for fall sports season start.

---

Let me know if I missed anything. Happy to adjust before you send.

Burke
