# Blackbaud SKY API -- App Registration & Permissions Request

For Lisa Wong / Melissa Neatherlin -- everything you'll need to approve the AthleticOS SKY API integration.

## Application identity

| Field | Value |
|-------|-------|
| App name | AthleticOS |
| Application ID (OAuth client_id) | `e060cf3f-d079-469b-824b-43e2f0b0dfca` |
| Principals | Burke Autrey, Truman Blocker |
| Production website | https://app.athleticos.co |
| API base URL | https://api.athleticos.co |
| Technical contact | Burke Autrey -- burke@autreymail.com |
| Privacy contact | Burke Autrey -- burke@autreymail.com |
| Hosting | Render (US-East), SOC 2 Type II certified provider |
| Source code | Private repository |

## OAuth 2.0 redirect URI(s)

Authorization-code flow. **Registered by AthleticOS on 2026-05-08 -- no action required from TCA.** Redirect URIs are app-level settings controlled by the app owner in the SKY developer portal; the school has no role in configuring them. Listed here for transparency only:

- Production: `https://api.athleticos.co/auth/blackbaud/callback`
- Local dev: `http://localhost:8003/auth/blackbaud/callback`

Both are necessary -- production for the live integration, local for development and testing.

## Scoped permissions request

We're following least-privilege. Below is exactly what AthleticOS will read and write, and why.

### Read access (start here)

| Data | Endpoint(s) (SKY) | Why we need it |
|------|------------------|----------------|
| Master school calendar | `/school/v1/calendars/...` | Pull non-athletic events (exams, assemblies, fine arts, in-service days) so AthleticOS can flag conflicts. This is one of Beck's top-4 priorities. |
| Athletic teams | `/school/v1/athletics/teams` | Sync TCA's existing teams instead of re-creating them in AthleticOS. |
| Team schedules | `/school/v1/athletics/teams/{id}/schedule` | Read existing scheduled games/practices to detect cross-system disconnects. |
| Roster | `/school/v1/athletics/teams/{id}/roster` | Required for the early-release workflow (which students leave campus, when). |

### Write access (Phase 2, with explicit go-ahead)

We will not enable write until you've reviewed Phase 1 and approved.

| Action | Endpoint | Why |
|--------|----------|-----|
| Create game | `POST /school/v1/athletics/teams/{id}/schedule` | When a coach creates a game in AthleticOS, push it into Blackbaud Athletics so the master calendar reflects it. |
| Create practice | `POST /school/v1/athletics/teams/{id}/practice` | Same pattern, practices. |
| Create opponent | `POST /school/v1/athletics/opponents` | Needed when scheduling against a school not yet in Blackbaud. |
| Create location | `POST /school/v1/athletics/locations` | For non-TCA venues. |
| Update game/practice | `PATCH .../schedule/{id}` | Reschedules push through. |
| Post game result | `POST .../result` | If TCA wants results synced back to Blackbaud. |

### What we are NOT requesting

- Any access to financial / advancement data
- Any access to the LMS academic / grading data
- Student PII beyond what's on athletic rosters (name, grade, team)
- Faculty / staff records beyond athletic coaches

## Data sync role

Per Melissa's confirmation (May 2026), TCA allows "SKY API Data Sync" for approved apps. Once we have this role assigned to the AthleticOS app's `client_id`, Burke will run the OAuth flow with a Blackbaud admin account to get the initial access + refresh tokens.

## Handshake -- what's needed from each side

**TCA / Blackbaud admin (Lisa or Melissa's team):**
1. Activate AthleticOS in the Applications area of the admin portal (Application ID `e060cf3f-d079-469b-824b-43e2f0b0dfca`). Admin-only action -- this is TCA's consent gate for third-party apps and cannot be delegated to AthleticOS.
2. Create a service account for the integration with these three security groups: **SKY API Basic**, **SKY API Data Sync**, **Sky Reporting** -- plus read-only permissions on athletics and calendar, and nothing else. Hand the credentials to Burke.

**Note on "scopes":** SKY API does *not* use per-API scopes. Their OIDC discovery document omits `scopes_supported`, and a token inherits the permissions of whoever authorizes it. So read-only is enforced by the authorizing account's permissions, not by anything AthleticOS requests. This is why the service account above must be read-only -- it is the actual guarantee.

**AthleticOS (Burke):**
1. ✅ Register the app at developer.blackbaud.com -- DONE 2026-05-08. Application ID: `e060cf3f-d079-469b-824b-43e2f0b0dfca`. Both redirect URIs registered.
2. Implement `/auth/blackbaud/callback` endpoint (small task -- token storage in Render secrets)
3. ✅ Obtain a SKY API subscription key -- DONE 2026-07-01 via SKY API free developer tier (1,000 calls/day). Primary + secondary keys verified live against `/school/v1/years` and stored in macOS keychain (`blackbaud-sky-subscription-key`, `blackbaud-sky-subscription-key-secondary`, account `burkestudio`). Sent in the `Bb-Api-Subscription-Key` header on every request.
4. Run OAuth flow with TCA admin account, store refresh token securely
5. Build read-only sync first; demo to Beck/Truman before any write goes live

## TCA environment (connected 2026-09-03)

Blackbaud's "App connected notification" confirms AthleticOS is connected to TCA's live environment. Connected by Melissa Neatherlin.

| Field | Value |
|-------|-------|
| Organization | Trinity Christian Academy |
| Organization ID | `p-RnDtb5EC80CCFG6vCgEAQA` |
| Environment | Trinity Christian Academy Environment |
| Environment ID | `p-r2Qa2p0UVEy9WQc4d1ZaBA` |

Use the Environment ID to confirm which tenant an access token belongs to -- the token response carries `environment_id`.

Connected is NOT authorized. The app is trusted by the environment, but no token exists until a TCA user completes the OAuth sign-in. Which account does that is the open question with Melissa (see `blackbaud-access-model-onepager.pdf`).

App environments page: https://developer.blackbaud.com/apps/appdetail/e060cf3f-d079-469b-824b-43e2f0b0dfca/environments

## Sandbox vs production

**Verified 2026-08-27:** Burke's own Blackbaud developer account has **no environment attached**. Running the authorization-code flow against the registered app returns *"You don't have access to any SKY API enabled Blackbaud products."* The app registration, subscription key, and scopes are all confirmed good -- the only missing piece is an environment to authorize against. `client_credentials` grant is not enabled for this app, so authorization-code is the only flow available.

Consequence: we cannot build against our own sandbox today. Request pending with skyapi@blackbaud.com (draft: `email-blackbaud-sandbox-request.txt`) asking whether the SKY Developer Cohort covers Education Management (K-12), or whether a separate K-12 partner sandbox is required.

Open question for Lisa/Melissa: does TCA have a Blackbaud sandbox environment, or do we go straight at production with a single test team? We'll respect whichever path you prefer. This is now the fallback if Blackbaud can't provide a K-12 developer environment.

## Audit + revocation

- Every Blackbaud API call from AthleticOS is logged with timestamp, user, scope, endpoint, response code -- queryable on request.
- Access and refresh tokens are encrypted at the application layer with AES-256-GCM (key derived from `JWT_SECRET` via HKDF) before being written to Postgres -- defense in depth above Render's at-rest disk encryption.
- AthleticOS app can be revoked at any time from the Blackbaud admin portal -- no AthleticOS code change required.
