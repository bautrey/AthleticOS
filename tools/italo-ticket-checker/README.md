# Italo Ticket Checker

Polls the Italo booking site for a given route/date and notifies you when
tickets become available. Drives a real Chromium browser (via Playwright) so
the JavaScript booking app renders properly, and only alerts on the
**transition** into "available" — so you won't get pinged every interval.

Pre-configured for: **Firenze Santa Maria Novella → Roma Termini, 2026-08-10.**

---

## ⚠️ Where this can run

The checker needs normal internet access to reach `italotreno.com`. It will
**not** work inside the Claude Code web sandbox — that environment's network
policy blocks all non-developer hosts (the Italo site returns HTTP 403 there).

Run it on a machine with open internet:

- Your laptop/desktop (cron or the built-in `--watch` loop)
- A Linux server / VPS (cron or systemd timer)
- A GitHub Actions scheduled workflow (see "Persistence" below)

---

## Setup

```bash
cd tools/italo-ticket-checker
npm install                       # installs Playwright + downloads Chromium
cp config.example.json config.json
```

`npm install` runs `playwright install chromium` to fetch the browser binary.
If your network blocks the Playwright CDN, run `npx playwright install chromium`
separately from an unrestricted network.

## Run it

```bash
npm run check          # one-shot check (good for cron)
npm run watch          # long-running loop, checks every intervalMinutes
```

Or directly, with an explicit config path:

```bash
npx tsx src/index.ts --once --config /path/to/config.json
```

## Configure

Edit `config.json`:

| Field | Meaning |
|-------|---------|
| `search.origin` / `destination` | Station names typed into the search form |
| `search.departDate` | `YYYY-MM-DD` |
| `search.directUrl` | If you paste a results-page URL here, the form-fill step is skipped and it loads that URL directly |
| `notify.webhookUrl` | Slack/Discord/generic webhook to POST to when available (optional) |
| `notify.logFile` | Appends every check + alerts here |
| `intervalMinutes` | Watch-mode interval (default 30) |
| `headless` | `false` to watch the browser while tuning selectors |

### Verifying the selectors (do this once)

The Italo site is a single-page app whose markup changes over time, so the CSS
selectors live in `config.json` rather than being hardcoded. The defaults are
reasonable starting points but **must be verified against the live site**,
which couldn't be done from the build sandbox:

1. Set `"headless": false` and `"screenshotOnCheck": true`.
2. Run `npm run check` and watch the browser drive the search.
3. Open the real site, do the search by hand, and use your browser's DevTools
   (right-click → Inspect) to confirm the selectors for:
   - the origin/destination inputs and their autocomplete dropdown options
   - the date field
   - the search button
   - the results list container and individual train rows
   - the exact "sold out" / "no trains" wording
4. Update `selectors` and `availability.*` in `config.json` to match.

A faster, more robust alternative: do the search once in your browser, copy the
URL of the results page, paste it into `search.directUrl`, and the checker will
just reload that page and evaluate availability — no form-filling needed.

## How "available" is decided

In `config.json → availability`:
- `unavailableIfTextPresent` — if any of these strings appear, status is
  `unavailable` (e.g. "Sold out", "Esaurito", "Nessun treno").
- `requireResultsContainer` — the results container must be present.
- `minTrainItems` — at least this many train rows must render.
- `availableIfTextPresent` — optional positive markers (leave `[]` to skip).

State is tracked in `.checker-state.json` so separate cron runs can detect the
unavailable → available transition and alert only once.

---

## Persistence

### Option A — cron (your machine or a server)

Check every 30 minutes:

```cron
*/30 * * * * cd /abs/path/to/tools/italo-ticket-checker && /usr/bin/npm run check >> cron.log 2>&1
```

### Option B — built-in loop

```bash
npm run watch        # keeps running, checks every intervalMinutes
```

Keep it alive across logout/reboot with `pm2`, `systemd`, `tmux`, or `nohup`.

### Option C — GitHub Actions (no machine to keep on)

A scheduled workflow runs on GitHub's runners, which have open internet. Add a
file like `.github/workflows/italo-check.yml`:

```yaml
name: Italo ticket check
on:
  schedule:
    - cron: "*/30 * * * *"   # every 30 min (UTC; GitHub may delay under load)
  workflow_dispatch:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - working-directory: tools/italo-ticket-checker
        run: npm ci && npx playwright install --with-deps chromium
      - working-directory: tools/italo-ticket-checker
        env:
          WEBHOOK_URL: ${{ secrets.ITALO_WEBHOOK_URL }}
        run: npm run check
```

For Actions, set `notify.webhookUrl` (or wire it from the `WEBHOOK_URL` secret)
to a Slack/Discord webhook so the alert reaches you — and note the state file
doesn't persist between runs unless you cache or commit it, so you may get an
alert on each run while tickets remain available.

> Adding a scheduled workflow consumes GitHub Actions minutes and starts running
> on a timer. I haven't committed one — ask if you'd like me to add it.
