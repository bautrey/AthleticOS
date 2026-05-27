import { existsSync, readFileSync, writeFileSync } from "node:fs";

export interface CheckState {
  lastStatus: "available" | "unavailable" | "error" | "unknown";
  lastChangedAt: string | null;
  lastCheckedAt: string | null;
}

const EMPTY: CheckState = {
  lastStatus: "unknown",
  lastChangedAt: null,
  lastCheckedAt: null,
};

export function readState(file: string): CheckState {
  if (!existsSync(file)) return { ...EMPTY };
  try {
    return { ...EMPTY, ...JSON.parse(readFileSync(file, "utf-8")) };
  } catch {
    return { ...EMPTY };
  }
}

export function writeState(file: string, state: CheckState): void {
  writeFileSync(file, JSON.stringify(state, null, 2));
}
