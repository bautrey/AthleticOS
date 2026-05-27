import { appendFileSync } from "node:fs";
import type { Config } from "./config.js";
import type { CheckResult } from "./checker.js";

function line(msg: string): string {
  return `[${new Date().toISOString()}] ${msg}`;
}

export function log(config: Config, msg: string): void {
  const out = line(msg);
  if (config.notify.console) console.log(out);
  if (config.notify.logFile) {
    try {
      appendFileSync(config.notify.logFile, out + "\n");
    } catch (err) {
      console.error("Failed to write log file:", (err as Error).message);
    }
  }
}

/** Fire the configured webhook. Slack format wraps the message in { text }. */
export async function notifyAvailable(
  config: Config,
  result: CheckResult,
): Promise<void> {
  const { origin, destination, departDate } = config.search;
  const msg =
    `🎟️ Italo tickets AVAILABLE: ${origin} → ${destination} on ${departDate}. ` +
    `Found ${result.trainCount} option(s). Book: ${result.url}`;

  log(config, msg);

  const url = config.notify.webhookUrl;
  if (!url) return;

  const body =
    config.notify.webhookFormat === "slack"
      ? { text: msg }
      : { event: "available", message: msg, result };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      log(config, `Webhook returned HTTP ${res.status}`);
    }
  } catch (err) {
    log(config, `Webhook failed: ${(err as Error).message}`);
  }
}
