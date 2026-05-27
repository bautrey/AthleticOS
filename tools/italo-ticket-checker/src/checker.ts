import { chromium, type Browser, type Page } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { type Config, BOOKING_URL, HOMEPAGE_URL } from "./config.js";
import { log } from "./notify.js";

export interface CheckResult {
  status: "available" | "unavailable" | "error";
  trainCount: number;
  url: string;
  detail: string;
}

/**
 * Loads the Italo booking flow for the configured search and decides whether
 * tickets are available. Uses a real Chromium instance so the SPA renders.
 */
export async function checkAvailability(config: Config): Promise<CheckResult> {
  let browser: Browser | null = null;
  const targetUrl = config.search.directUrl ?? HOMEPAGE_URL;

  try {
    browser = await chromium.launch({ headless: config.headless });
    const context = await browser.newContext({
      locale: "en-US",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(config.timeoutMs);

    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    if (!config.search.directUrl) {
      await performSearch(config, page);
    }

    // Wait for either the results container or a known "no results" marker.
    await page
      .waitForSelector(config.selectors.resultsContainer, {
        timeout: config.timeoutMs,
      })
      .catch(() => {
        /* fall through to text-based evaluation below */
      });

    if (config.screenshotOnCheck) {
      mkdirSync(config.screenshotDir, { recursive: true });
      const file = join(
        config.screenshotDir,
        `check-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
      );
      await page.screenshot({ path: file, fullPage: true });
    }

    const result = await evaluatePage(config, page);
    await browser.close();
    return result;
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return {
      status: "error",
      trainCount: 0,
      url: targetUrl,
      detail: (err as Error).message,
    };
  }
}

async function dismissCookieBanner(page: Page): Promise<void> {
  const candidates = [
    "#onetrust-accept-btn-handler",
    "button:has-text('Accept')",
    "button:has-text('Accetta')",
    "button:has-text('Agree')",
  ];
  for (const sel of candidates) {
    const btn = page.locator(sel).first();
    if (await btn.count().catch(() => 0)) {
      await btn.click({ timeout: 3000 }).catch(() => {});
      return;
    }
  }
}

/** Best-effort fill of the homepage search form using configured selectors. */
async function performSearch(config: Config, page: Page): Promise<void> {
  const s = config.selectors;
  const { origin, destination, departDate } = config.search;

  await fillAutocomplete(page, s.originInput, s.autocompleteOption, origin);
  await fillAutocomplete(
    page,
    s.destinationInput,
    s.autocompleteOption,
    destination,
  );

  const dateInput = page.locator(s.departDateInput).first();
  if (await dateInput.count()) {
    await dateInput.fill(departDate).catch(async () => {
      // Some date pickers ignore fill(); fall back to typing.
      await dateInput.click();
      await page.keyboard.type(departDate);
    });
  }

  await page.locator(s.searchButton).first().click();
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function fillAutocomplete(
  page: Page,
  inputSel: string,
  optionSel: string,
  value: string,
): Promise<void> {
  const input = page.locator(inputSel).first();
  if (!(await input.count())) return;
  await input.click();
  await input.fill(value);
  const option = page.locator(optionSel).first();
  await option
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => option.click())
    .catch(() => {
      // No dropdown appeared; leave the typed value as-is.
    });
}

async function evaluatePage(
  config: Config,
  page: Page,
): Promise<CheckResult> {
  const a = config.availability;
  const url = page.url();
  const bodyText = (await page.locator("body").innerText().catch(() => "")) || "";

  for (const t of a.unavailableIfTextPresent) {
    if (t && bodyText.includes(t)) {
      return {
        status: "unavailable",
        trainCount: 0,
        url,
        detail: `Matched unavailable marker: "${t}"`,
      };
    }
  }

  const hasContainer = a.requireResultsContainer
    ? (await page.locator(config.selectors.resultsContainer).count()) > 0
    : true;
  const trainCount = await page
    .locator(config.selectors.trainItem)
    .count()
    .catch(() => 0);

  const textSaysAvailable =
    a.availableIfTextPresent.length === 0
      ? true
      : a.availableIfTextPresent.some((t) => t && bodyText.includes(t));

  const available =
    hasContainer && trainCount >= a.minTrainItems && textSaysAvailable;

  return {
    status: available ? "available" : "unavailable",
    trainCount,
    url,
    detail: available
      ? `Found ${trainCount} train option(s)`
      : `container=${hasContainer} trains=${trainCount} textOk=${textSaysAvailable}`,
  };
}
