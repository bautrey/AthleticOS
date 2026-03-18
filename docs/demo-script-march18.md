# AthleticOS Demo Script — March 18, 2026

**Event:** TCA Athletic Staff Demo | 11:30am - 12:30pm | In-person at TCA
**Audience:** Sam Blackman (Boys' AD), Rodney Belcher (Girls' AD), Andrew Riverrez, possibly Mike Yanoff
**URL:** https://athleticos.co | Login: `burke@athleticos.dev` / `AthleticOS2026`

---

## Act 1: Setting the Stage (Truman leads, ~10 min)

*Truman handles this — cast the vision, Dr. Williams' blessing, why we're here.*

Key points for Truman:
- We're not buying off-the-shelf software — we're building something custom for TCA
- You have a voice in this. What you tell us matters.
- If it's on a spreadsheet, an email chain, or a whiteboard right now — that's what we're replacing

---

## Act 2: The Demo (~10 min)

### Scene 1: The Dashboard (2 min)
> "This is your command center. At a glance: how many teams, active seasons, what's happening today."

- Show the **hero header** with school stats
- Point out **today's schedule** (games and practices)
- Point out **conflict donut** — "Right now you have X conflicts across all sports"
- **Key message:** "Every AD in the room would see this same view. One source of truth."

### Scene 2: School Setup — "The Foundation" (1 min)
> "Before we get to the fun stuff, here's the backbone."

- Quick scroll through **Teams** (12 teams — all sports, not just soccer)
- Quick look at **Facilities** (7 facilities — fields, gym, track, etc.)
- Quick look at **Members** — "This is who has access and what role they play"

### Scene 3: A Season in Action (3 min)
> "Let's look at what a real season looks like. Baseball 2026."

- Click **Seasons > Baseball 2026**
- Show the **calendar view** — blue = games, green = practices
- Click into a **game** — show opponent, home/away, facility, date/time
- Click into a **practice** — show facility, duration
- **Recurring practices:** "Instead of entering 40 practices one by one, you pick the days and times, and it generates the whole season. It even skips exam weeks automatically."

### Scene 4: The Conflict Problem (3 min)
> "Here's where it gets real. How many of you have had a scheduling conflict this season?"

- Navigate to **Conflicts page**
- Show a conflict: "Baseball and Track are both scheduled at West Field on the same day"
- Show the **detail panel** — what's conflicting, why, severity
- Show **priority rules**: "Varsity trumps JV. Football trumps everyone on Friday nights. You set these rules once, and the system suggests who should move."
- **Override** a conflict — "Sometimes it's fine. You just say 'I know, it's okay' and override it"
- Show **suggested resolution** — "Or the system says: Track should move to the turf field at 4pm. One click."
- **Key message:** "No more 15 texts and emails to figure out if your banquet conflicts with softball."

### Scene 5: Facility Requests — "Goodbye SchoolDude" (1 min)
> "Anyone here use SchoolDude? This replaces that."

- Show **Facility Requests** page
- "Community groups, coaches, anyone can request a facility. You approve or deny it right here."
- Show the **availability calendar** — "Before you request, you can see what's open"

---

## Act 3: The Conversation (~30 min)

### Opening Questions
> "Now that you've seen what we've built, let's talk about what matters most to YOU."

1. **"What's the biggest time sink in your week that's scheduling-related?"**
   - Listen for: email chains, phone calls, spreadsheet management, manual calendar updates

2. **"When a schedule changes — weather, a facility issue, whatever — how does that information get to everyone who needs it?"**
   - Listen for: Sports You, group texts, word of mouth
   - If relevant, mention: "We have a notification system built. When a game moves, the system can email or text everyone automatically."

3. **"What's on a spreadsheet or whiteboard right now that you wish wasn't?"**
   - Listen for: game day logistics, equipment checklists, referee schedules, banquet planning
   - If relevant: Show **Operations/Checklists** — "We built something for that. You create a template for game day — who brings the Gatorade, who sets up the PA system — and it auto-generates a checklist for every home game."

4. **"How do you currently deal with weather delays or cancellations?"**
   - Listen for: scrambling, texting around, losing field time
   - If relevant: "We have a rain plan feature — you set a fallback facility for each outdoor field, and with one click, all affected events move indoors."

### Features to Pull Out If the Conversation Goes There

| If they mention... | Show them... |
|---|---|
| "We need a weekly view" | Weekly Board (`/schools/:id/weekly-board`) |
| "Parents need to know" | "That stays in Sports You. This feeds that." |
| "Game day logistics" | Operations Readiness (`/schools/:id/operations`) |
| "I need to see what's open" | Facility Availability calendar |
| "Can I print this?" | Print button on season view |
| "Can I subscribe in my calendar?" | Calendar Feeds (ICS export) |
| "What about the master school calendar?" | Blockers — "Enter exam weeks, chapel, concerts as blockers. They auto-flag conflicts." |
| "Can multiple people use it?" | Members + Roles — show AD vs Coach permissions |

### Closing (Truman leads)
> "What would make you want to use this every day? What's missing?"

- Capture their top 3 requests
- "We're going to send a follow-up email. You can reply with anything you think of later."
- "Our goal: something you can start using next school year."

---

## Things NOT to Demo (Keep in Pocket)

These are built but may overwhelm or distract:
- Quick-add natural language parsing (cool but confusing)
- Bulk operations (auto-resolve, bulk move) — too advanced for first look
- SMS opt-out page
- Community portal / community registration
- Notification admin log
- Calendar feed setup (show concept only if asked)

## Pre-Demo Checklist

- [ ] Verify https://athleticos.co loads and login works
- [ ] Verify seed data looks good (12 teams, reasonable conflicts)
- [ ] Verify conflicts page has multiple different conflict types (not all the same)
- [ ] Verify at least one conflict has a suggested resolution
- [ ] Check Weekly Board has events for the current week
- [ ] Test on Truman's laptop/TV setup (55" TV via HDMI, full-screen browser)
- [ ] Prepare 1-2 slides from the Jeff PowerPoint for Truman's intro (optional)

## Post-Demo Action Items

- [ ] Send follow-up email to attendees with feedback form
- [ ] Schedule individual 30-min Zoom calls with each AD (per Burke's suggestion)
- [ ] Document feature requests and prioritize for Sprint 4
- [ ] Schedule meeting with Beck Bryden (new exec AD) — Truman doing this next Saturday
