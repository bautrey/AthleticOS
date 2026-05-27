#!/usr/bin/env -S npx tsx
import { resolve } from "node:path";
import { loadConfig, type Config } from "./config.js";
import { checkAvailability } from "./checker.js";
import { log, notifyAvailable } from "./notify.js";
import { readState, writeState } from "./state.js";

interface Cli {
  configPath: string;
  mode: "once" | "watch";
}

function parseArgs(argv: string[]): Cli {
  let configPath = "config.json";
  let mode: Cli["mode"] = "once";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--watch") mode = "watch";
    else if (arg === "--once") mode = "once";
    else if (arg === "--config") configPath = argv[++i];
  }
  return { configPath, mode };
}

/** Resolve config-relative paths so cron can run from any cwd. */
function resolvePaths(config: Config, baseDir: string): void {
  if (config.notify.logFile)
    config.notify.logFile = resolve(baseDir, config.notify.logFile);
  config.stateFile = resolve(baseDir, config.stateFile);
  config.screenshotDir = resolve(baseDir, config.screenshotDir);
}

async function runOnce(config: Config): Promise<void> {
  const prev = readState(config.stateFile);
  const result = await checkAvailability(config);
  const now = new Date().toISOString();

  log(
    config,
    `Check: ${result.status} (${result.detail}) [${config.search.origin} → ${config.search.destination} ${config.search.departDate}]`,
  );

  const changed = result.status !== prev.lastStatus;

  // Notify on transition into "available" (avoids repeat spam each interval).
  if (result.status === "available" && changed) {
    await notifyAvailable(config, result);
  }

  writeState(config.stateFile, {
    lastStatus: result.status,
    lastChangedAt: changed ? now : prev.lastChangedAt,
    lastCheckedAt: now,
  });
}

async function main(): Promise<void> {
  const cli = parseArgs(process.argv.slice(2));
  const { config, baseDir } = loadConfig(cli.configPath);
  resolvePaths(config, baseDir);

  if (cli.mode === "once") {
    await runOnce(config);
    return;
  }

  const intervalMs = Math.max(1, config.intervalMinutes) * 60_000;
  log(config, `Watch mode: checking every ${config.intervalMinutes} min. Ctrl+C to stop.`);
  // Run immediately, then on the interval.
  await runOnce(config).catch((e) => log(config, `Run error: ${e.message}`));
  setInterval(() => {
    runOnce(config).catch((e) => log(config, `Run error: ${e.message}`));
  }, intervalMs);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
