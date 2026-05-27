import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

export interface Config {
  search: {
    origin: string;
    destination: string;
    departDate: string;
    passengers: { adults: number; children?: number };
    /** If set, the checker navigates straight here instead of filling the search form. */
    directUrl: string | null;
  };
  selectors: {
    originInput: string;
    destinationInput: string;
    autocompleteOption: string;
    departDateInput: string;
    searchButton: string;
    resultsContainer: string;
    trainItem: string;
    soldOutText: string;
  };
  availability: {
    requireResultsContainer: boolean;
    minTrainItems: number;
    availableIfTextPresent: string[];
    unavailableIfTextPresent: string[];
  };
  notify: {
    console: boolean;
    logFile: string | null;
    webhookUrl: string | null;
    webhookFormat: "slack" | "json";
  };
  intervalMinutes: number;
  headless: boolean;
  timeoutMs: number;
  stateFile: string;
  screenshotOnCheck: boolean;
  screenshotDir: string;
}

export const BOOKING_URL =
  "https://biglietti.italotreno.com/en/booking/selezione-treno-andata";
export const HOMEPAGE_URL = "https://www.italotreno.com/en";

/** Resolve a config-relative path against the config file's own directory. */
export function loadConfig(path: string): { config: Config; baseDir: string } {
  const abs = resolve(path);
  const raw = readFileSync(abs, "utf-8");
  const config = JSON.parse(raw) as Config;
  return { config, baseDir: dirname(abs) };
}
