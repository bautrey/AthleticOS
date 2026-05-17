To: Melissa Neatherlin, Lisa Wong
Cc: Truman Blocker, Beck Brydon

Subject: AthleticOS -- ready to start integrating; access requests + security brief attached

---

Hi Melissa, Hi Lisa,

Thanks for the Blackbaud confirmation, Melissa -- that's the green light I was hoping for. The athletics module being already set up at TCA means we can plug in rather than start from scratch.

Beck and Truman have been talking through priorities, and Beck flagged the top four needs as: (1) an accurate calendar across all teams and training facilities (in-season AND offseason), (2) an accurate school calendar with exams, assemblies, and fine-arts events, (3) automatic conflict detection with alerts, and (4) self-service game scheduling for coaches that shows open dates and conflicts. AthleticOS already has a working scheduling engine, conflict detection, and ICS feeds built -- the missing piece is connecting it to the systems TCA already runs on.

Rather than make you wait, I've put together two documents to start the approval process now. Both are attached:

  1. BLACKBAUD SKY API PREP -- everything you'll need to approve the AthleticOS app: vendor identity, OAuth redirect URIs, the full scoped permissions list (read access first, write access only after you approve), the data sync role we're requesting, and exactly which endpoints we'll hit and why.

  2. DATA HANDLING BRIEF -- Lisa, this addresses the student data hosting concern you raised on April 15. Short and concrete: what we hold, what we explicitly don't hold, where it lives, encryption, access control, retention, off-boarding, subprocessors, and the open items I want your input on (sandbox vs prod, custom domain, DPA, optional pen test).

What I'm asking for, by system:

1. BLACKBAUD (SKY API) -- see attached prep doc
   - Approve the AthleticOS app in TCA's Blackbaud admin portal. App is registered; **Application ID (OAuth client_id) is `e060cf3f-d079-469b-824b-43e2f0b0dfca`** -- also baked into the attached prep doc.
   - Assign the "SKY API Data Sync" role to that client_id.
   - Confirm whether a sandbox is available, or we go at production with a scoped pilot.
   - Flag any scope concerns from the attached permissions list before I run the OAuth flow.
   - For context on velocity: the AthleticOS-side integration is already built and tested against the verified SKY endpoint shapes (athletics teams, schedules, rosters, master calendar events). It's running in mock mode against TCA-shaped fixtures right now. The moment the Data Sync role is assigned, the OAuth handshake gives us read-only sync the same day.

2. SCHOOLDUDE
   - Read-only access (or an export feed) for facility schedule data, so AthleticOS can detect conflicts between athletics requests and existing facility bookings. Not replacing SchoolDude -- this is the "traffic cop" view from April 15.
   - Who is SchoolDude's account owner at TCA? Happy to coordinate directly with whoever owns the contract.
   - Does your subscription include API access? If not, what export options exist (CSV, ICS, scheduled report)?

3. SIDEARM SPORTS / FINALSITE
   - Sidearm has no public API, but I want to understand the actual TCA configuration before assuming we have to scrape. Could we set up 30 minutes where you walk me through how the athletics calendar gets onto the website today? CMS import, CSV upload, scheduled feed pull -- whatever the path is.
   - On FinalSite specifically: any CMS-side path to push schedule data in, or is it all driven through Sidearm?

4. EXCHANGE / O365
   - For ICS calendar subscriptions to "just work" for staff, I don't believe we need anything special -- Outlook subscribes to public ICS URLs natively. If TCA has a policy requiring registered apps for external calendar feeds, let me know and I'll handle Azure AD registration.

5. ARBITER (referees)
   - Lower priority -- who at TCA owns the Arbiter relationship? I want to start a parallel conversation about referee notifications for canceled/rescheduled games.

6. SPORTS YOU
   - No action needed from you. ICS feed subscriptions inside the app are likely the path for parents; I'll do that homework.

Two questions back to you:
- Lisa: please review the data handling brief and tell me what else you need to clear the security path. I've listed the open items at the bottom of that doc.
- Melissa: can we get 30 minutes this or next week, just on Sidearm/FinalSite? That's the one piece I can't research from the outside.

Thanks again -- this unblocks a lot. Let me know what's missing from either doc.

Burke
