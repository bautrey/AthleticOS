---
title: "Request for Evaluation Data Access — AthleticOS Pilot"
---

# Request for Evaluation Data Access — AthleticOS Pilot

**To:** Trinity Christian Academy — Office of the Head of School / Legal Counsel *[confirm recipient name & title]*
**Cc:** Lisa Wong; Melissa Neatherlin
**From:** Burke Autrey and Truman Blocker (individually)
**Date:** *[date]*
**Re:** Request to approve a limited, no-cost evaluation pilot of AthleticOS using a defined subset of TCA athletic data, under a mutual non-disclosure agreement

---

## 1. What we are asking for

We, **Burke Autrey and Truman Blocker**, respectfully request Trinity Christian Academy's ("TCA") approval to access a **limited, clearly defined subset of TCA's athletic data** for a **no-cost, non-production evaluation pilot** of AthleticOS.

The pilot lets us build and demonstrate AthleticOS against TCA's real athletic workflows (scheduling, calendar-conflict detection, roster-driven early-release) rather than against synthetic data. Access would be:

- **Scoped** — a single sport/team for the pilot, read-only, least-privilege;
- **Governed** — under a mutual NDA (and a FERPA/data-processing addendum, if TCA requires one);
- **Revocable** — TCA can cut off access instantly at any time, with no cost or obligation to TCA.

This document is a **request**, not a binding agreement. The binding instruments would be the NDA and any FERPA/data-processing addendum, which we are ready to sign on TCA's standard forms.

---

## 2. Who we are

AthleticOS is an early-stage athletic-operations tool being built by two individuals:

| Principal | Role | Contact |
|-----------|------|---------|
| Burke Autrey | Technical lead, data steward | burke@autreymail.com |
| Truman Blocker | Product / athletics domain | *[Truman's email]* |

In the interest of full transparency: **AthleticOS is not yet incorporated and does not operate under a DBA.** We are presenting to TCA as two named individuals, and we will sign the NDA and any related agreement **personally**. We would rather be candid about our stage than overstate a corporate structure that does not yet exist.

---

## 3. How we address the "no entity yet" question

We understand that a school's counsel needs to know **exactly whom it is dealing with** before sharing any student data. Here is how we make TCA whole on that concern despite being pre-incorporation:

1. **A real, accountable counterparty today.** Both principals will execute the NDA and any data-sharing terms **personally and jointly**, so TCA has two named individuals who are directly, personally bound — not a shell.
2. **Entity formation before any production use.** We will form a Texas LLC (AthleticOS) **before AthleticOS is used on live TCA data outside the evaluation pilot**. Upon formation, and with TCA's written consent, we would assign the agreement to that entity; until then, the personal obligations remain fully in force.
3. **Evaluation is deliberately low-risk.** During the pilot, access is limited, non-production, single-team, and revocable — chosen so that TCA's exposure is minimal while the entity is being formed.

In short: TCA is not asked to wait on our paperwork, and TCA is not asked to trust a nonexistent company. Two accountable people sign now; the company steps in before anything goes live.

---

## 4. What data we are requesting (and what we are not)

Access would be **read-only** via the Blackbaud SKY API, following least-privilege. For the pilot we propose limiting even this to a **single sport/team**.

| Data | Fields | Why it is needed |
|------|--------|------------------|
| Master school calendar | Event titles, dates/times | Detect conflicts between athletic events and school events (exams, assemblies, fine arts) |
| Athletic teams | Team name, sport, season | Sync existing teams rather than recreate them |
| Team schedules | Games/practices, dates/times, locations | Detect cross-system scheduling disconnects |
| Roster (pilot team only) | Student name, grade, team membership | Required for the early-release workflow |

**We are explicitly NOT requesting:**

- Financial or advancement data
- LMS / academic / grading data
- Medical records, SSNs, addresses, parent contact info, photos, or biometric data
- Student PII beyond what appears on an athletic roster (name, grade, team)
- Faculty/staff records beyond athletic coaches

No **write** access is requested for the evaluation. Any future write capability would be a separate, explicit approval.

---

## 5. FERPA and student-data handling

We recognize that the roster fields above (student name, grade, team) are **"education records"** under the Family Educational Rights and Privacy Act (FERPA), and that TCA is responsible for their disclosure. We want to make the compliant path easy to approve. We can work under **any** of the following, at TCA's election:

- **(Preferred for the pilot) De-identified or test data.** We can run the evaluation against a single test team, scrubbed roster, or synthetic names — so **no live student PII is exposed** during evaluation. This is often the fastest path to a "yes."
- **FERPA "school official" designation.** TCA designates AthleticOS (via its named principals) as a *school official with a legitimate educational interest* under the outsourcing exception (34 CFR § 99.31(a)(1)(i)(B)), subject to TCA's **direct control** over use and maintenance, and a prohibition on re-disclosure or use for any other purpose.
- **Consent-scoped access.** Access limited to students for whom TCA already holds parental/eligible-student consent.

Under all options, we commit to:

- Use the data **solely** to provide and evaluate AthleticOS for TCA;
- **Not re-disclose** the data to any third party except the subprocessors listed in §6, as required to run the service;
- **Return or destroy** the data at TCA's direction, and in any case within 30 days of the pilot's end.

We will execute TCA's **standard FERPA / data-processing addendum (DPA)**. If TCA does not have one, we can provide a draft for TCA's counsel to review.

---

## 6. How the data is protected during the pilot

A fuller *Data Handling & Security Brief* is available (and already shared with Lisa Wong). In summary:

- **Hosting:** Render (US-East), a SOC 2 Type II certified provider. **No data leaves the US.**
- **Encryption:** AES-256 at rest, TLS 1.2+ in transit. Blackbaud OAuth tokens are additionally encrypted at the application layer (AES-256-GCM) before storage — defense in depth.
- **Access control:** Role-based access enforced on every route; multi-tenant isolation by `school_id`; no public endpoint exposes roster data.
- **No third-party AI/analytics.** Data is never sent to any AI or analytics service.
- **Audit logging:** Every data write and every Blackbaud API call is logged (who, what, when, scope) and is queryable on request.
- **Subprocessors:** Render (hosting/database), Twilio (SMS to opted-in users only), an SMTP provider (email to opted-in users only). No others.
- **Revocation:** TCA can revoke the AthleticOS app instantly from the Blackbaud admin portal — no code change on our side required.

---

## 7. Scope, term, and off-ramp

| Item | Commitment |
|------|-----------|
| Cost to TCA | **$0** — no fee, no purchase obligation |
| Term | **90 days** *[adjust]* from access grant, renewable only by mutual agreement |
| Scope | Single sport/team, read-only |
| Revocation | Instant, at TCA's sole discretion, via Blackbaud admin portal |
| Data return/deletion | Full export (CSV/JSON) and deletion within 30 days of request or pilot end |
| Governing law | State of Texas *[confirm]* |

---

## 8. What we are asking TCA to do

1. **Approve** the mutual NDA (and FERPA/DPA addendum, if required) — signed by Burke and Truman personally.
2. **Confirm** the read-only scopes in §4 are acceptable, and **designate the pilot team** (and whether to use de-identified/test data).
3. **Approve** the AthleticOS app in TCA's Blackbaud admin portal and assign the "SKY API Data Sync" role to our registered application (`client_id: e060cf3f-d079-469b-824b-43e2f0b0dfca`).

Once the NDA is in place, the technical handshake (OAuth authorization with a TCA admin account, read-only sync, demo to Truman/AD) follows the plan already documented in our *Blackbaud SKY API — App Registration & Permissions Request*.

---

## 9. Signatures

**Requested by (each signing individually and jointly):**

<br>

_________________________________
Burke Autrey — Date: ____________

<br>

_________________________________
Truman Blocker — Date: ____________

<br>

**Acknowledged / approved by Trinity Christian Academy:**

<br>

_________________________________
Name / Title — Date: ____________

<br>

---

*This request is provided for TCA's review. It does not by itself grant or obligate any data access; access is governed solely by the executed NDA and any FERPA/data-processing addendum.*
