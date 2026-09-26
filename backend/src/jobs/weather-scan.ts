// backend/src/jobs/weather-scan.ts
//
// Entry point for the daily weather scan. Run by a Render cron service against the
// same image the API runs from:
//
//   node dist/jobs/weather-scan.js
//
// A cron service talking to the database directly, rather than a cron hitting an
// HTTP endpoint. There is no service-to-service auth scheme in this codebase, and
// an endpoint that runs a scan would need one - either a shared secret to keep in
// sync across two services, or an endpoint left open. Neither is worth inventing
// for a job that already has database credentials.
//
// Exit codes: 0 when every school was scanned, 1 when any school failed. The
// per-school failure does not stop the others, so a single school with bad settings
// cannot silence the whole scan.

import { prisma } from '../common/db.js';
import { weatherScanService } from '../modules/weather/scan.js';

async function main(): Promise<number> {
  const startedAt = Date.now();
  const { results, failures } = await weatherScanService.scanAll();

  const raised = results.reduce((n, r) => n + r.blockersCreated, 0);
  const updated = results.reduce((n, r) => n + r.blockersUpdated, 0);
  const withdrawn = results.reduce((n, r) => n + r.blockersWithdrawn, 0);
  const notified = results.reduce((n, r) => n + r.notificationsSent, 0);

  // One line per school that had something to say, so a quiet day is a quiet log.
  for (const result of results) {
    if (result.skipped) {
      console.log(`[weather-scan] ${result.schoolName}: skipped (${result.skipped})`);
      continue;
    }
    if (result.settingsError) {
      console.warn(
        `[weather-scan] ${result.schoolName}: weather settings did not parse ` +
          `(${result.settingsError}); reporting conditions only`
      );
    }
    if (result.blockersCreated || result.blockersUpdated || result.blockersWithdrawn) {
      console.log(
        `[weather-scan] ${result.schoolName}: ${result.blockersCreated} raised, ` +
          `${result.blockersUpdated} updated, ${result.blockersWithdrawn} withdrawn, ` +
          `${result.notificationsSent} alerts`
      );
    }
  }

  for (const failure of failures) {
    console.error(`[weather-scan] school ${failure.schoolId} failed: ${failure.errorKind}`);
  }

  console.log(
    `[weather-scan] ${results.length} schools in ${Date.now() - startedAt}ms: ` +
      `${raised} raised, ${updated} updated, ${withdrawn} withdrawn, ${notified} alerts, ` +
      `${failures.length} failed`
  );

  return failures.length > 0 ? 1 : 0;
}

main()
  .then(async (code) => {
    await prisma.$disconnect();
    process.exit(code);
  })
  .catch(async (err) => {
    // Reaching here means the scan could not run at all - no database, say - rather
    // than one school failing, which scanAll already absorbs.
    console.error('[weather-scan] failed to run:', err instanceof Error ? err.message : err);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
