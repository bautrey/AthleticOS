// backend/src/modules/import/schedule-transform.ts
//
// Transforms a coach-supplied season schedule (the JSON under docs/schedules/)
// into the flat row shapes importService already understands.
//
// These schedules arrive as pasted email text: no start times, levels written
// inline as free text ("Ursuline JV + V @ TCA"), placeholder rows for open
// dates and tournaments that have no opponent yet. importService requires a
// non-empty opponent and a parseable time, so nothing here can be handed over
// untouched. Everything this module cannot turn into a real row is returned in
// `skipped` with a reason rather than dropped silently.

import type { GameRow, PracticeRow } from './schemas.js';

export type Level = 'JV' | 'VARSITY';

export interface CoachScheduleEvent {
  date: string;
  stated_day: string;
  calendar_day: string;
  start_time: string | null;
  source_text: string;
  kind: 'game' | 'district_game' | 'tournament' | 'open_date';
  home_away: 'Home' | 'Away' | null;
  opponent: string | null;
  tentative: boolean;
}

export interface CoachScheduleFile {
  source: Record<string, unknown>;
  team: {
    school: string;
    program: string;
    levels: string[];
    season: string;
    gender: string;
  };
  offseason_training: {
    starts: string;
    days: string[];
    start_time: string;
    end_time: string;
    through: string;
    end_date_exact: string | null;
    source_text: string;
  } | null;
  blackouts: Array<{
    name: string;
    start: string;
    end: string;
    source_text: string;
  }>;
  events: CoachScheduleEvent[];
}

export interface SkippedEvent {
  date: string;
  kind: string;
  sourceText: string;
  reason: string;
}

export interface GameRowResult {
  rows: GameRow[];
  skipped: SkippedEvent[];
}

export interface PracticeRowResult {
  rows: PracticeRow[];
  /** True when the training window's end date was assumed rather than stated. */
  endDateInferred: boolean;
}

export interface BlockerInput {
  type: 'CUSTOM';
  name: string;
  description: string;
  scope: 'TEAM';
  startDatetime: Date;
  endDatetime: Date;
}

const DAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Read squad levels out of a coach's free-text line.
 *
 * "Ursuline JV + V @ TCA"           -> both, stated
 * "Prestonwood @ TCA (JV vs. Storm)" -> JV, stated
 * "Covenant (JV?) @ TCA"             -> JV, stated (the ? is about the opponent's squad)
 * "DISTRICT GAME 1 - TCA @ NOLAN"    -> none stated
 *
 * An unstated level is not a guess waiting to happen: the caller decides what
 * to do with it, and `stated` says which case it is.
 */
export function detectLevels(sourceText: string): { levels: Level[]; stated: boolean } {
  const text = sourceText.toUpperCase();

  const hasJv = /\bJV\b/.test(text);
  // "V" as its own token, so "JV + V" matches while "VARSITY" and "AVAILABLE"
  // don't. The lookbehind is what keeps the V inside "JV" from counting.
  const hasVarsity = /(?<![A-Z])V(?![A-Z])/.test(text) || /\bVARSITY\b/.test(text);

  const levels: Level[] = [];
  if (hasJv) levels.push('JV');
  if (hasVarsity) levels.push('VARSITY');

  return { levels, stated: levels.length > 0 };
}

function homeAwayFor(event: CoachScheduleEvent): GameRow['homeAway'] {
  if (event.home_away === 'Home') return 'HOME';
  if (event.home_away === 'Away') return 'AWAY';
  return 'NEUTRAL';
}

function noteFor(event: CoachScheduleEvent, timeAssumed: boolean, levelAssumed: boolean): string {
  const flags: string[] = [];
  if (timeAssumed) flags.push('start time not in source');
  if (levelAssumed) flags.push('level not stated in source');
  if (event.home_away === null) flags.push('home/away not stated in source');
  if (event.tentative) flags.push('tentative');

  const suffix = flags.length > 0 ? ` [${flags.join('; ')}]` : '';
  return `${event.source_text}${suffix}`;
}

/**
 * Build game rows for one squad.
 *
 * Events with no opponent (open dates, tournament placeholders) cannot become
 * Games — importService rejects an empty opponent — so they come back in
 * `skipped` instead of being padded with invented text.
 */
export function toGameRows(
  file: CoachScheduleFile,
  options: { level: Level; defaultGameTime: string }
): GameRowResult {
  const rows: GameRow[] = [];
  const skipped: SkippedEvent[] = [];

  for (const event of file.events) {
    if (!event.opponent || !event.opponent.trim()) {
      skipped.push({
        date: event.date,
        kind: event.kind,
        sourceText: event.source_text,
        reason:
          event.kind === 'open_date'
            ? 'Open date with no opponent scheduled yet'
            : 'No opponent named in the source',
      });
      continue;
    }

    const { levels, stated } = detectLevels(event.source_text);
    if (stated && !levels.includes(options.level)) {
      skipped.push({
        date: event.date,
        kind: event.kind,
        sourceText: event.source_text,
        reason: `Source names ${levels.join(' + ')} only, not ${options.level}`,
      });
      continue;
    }

    const timeAssumed = event.start_time === null;

    rows.push({
      row: rows.length + 1,
      date: event.date,
      time: event.start_time ?? options.defaultGameTime,
      opponent: event.opponent.trim(),
      homeAway: homeAwayFor(event),
      facility: null,
      notes: noteFor(event, timeAssumed, !stated),
    });
  }

  return { rows, skipped };
}

/**
 * Expand an offseason training block into one practice row per training day.
 *
 * The source says "Monday through Thursday for September and October" with no
 * closing date, so the caller supplies one. `endDateInferred` reports whether
 * that date came from the file or from the caller's assumption.
 */
export function toPracticeRows(
  file: CoachScheduleFile,
  options: { assumedEndDate: string }
): PracticeRowResult {
  const training = file.offseason_training;
  if (!training) {
    return { rows: [], endDateInferred: false };
  }

  const endDateInferred = training.end_date_exact === null;
  const endDate = training.end_date_exact ?? options.assumedEndDate;

  const wanted = new Set(training.days.map((d) => DAY_INDEX[d]));
  const durationMinutes = minutesBetween(training.start_time, training.end_time);

  const rows: PracticeRow[] = [];
  const cursor = new Date(`${training.starts}T00:00:00Z`);
  const last = new Date(`${endDate}T00:00:00Z`);

  while (cursor.getTime() <= last.getTime()) {
    if (wanted.has(cursor.getUTCDay())) {
      rows.push({
        row: rows.length + 1,
        date: cursor.toISOString().slice(0, 10),
        time: training.start_time,
        duration: durationMinutes,
        facility: null,
        notes: endDateInferred
          ? `Offseason training [end date assumed: ${endDate}]`
          : 'Offseason training',
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { rows, endDateInferred };
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

/**
 * Turn declared blackout windows into Blocker create-inputs.
 *
 * There is no BLACKOUT type in the schema, so these land as CUSTOM. The window
 * is inclusive of its closing day: "February 1st thru 5th" blocks all of the
 * 5th, not up to midnight on it.
 */
export function toBlockerInputs(file: CoachScheduleFile): BlockerInput[] {
  return file.blackouts.map((blackout) => ({
    type: 'CUSTOM' as const,
    name: blackout.name,
    description: blackout.source_text,
    scope: 'TEAM' as const,
    startDatetime: new Date(`${blackout.start}T00:00:00Z`),
    endDatetime: new Date(`${blackout.end}T23:59:59Z`),
  }));
}
