// backend/src/modules/import/schedule-transform.test.ts
//
// Runs against the real girls-soccer schedule Truman sent on 2026-09-04, not a
// hand-written fixture. The point of these tests is that a coach's emailed
// schedule survives the trip into importService's row shape without anything
// being invented to satisfy a required field.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { gameRowSchema, practiceRowSchema } from './schemas.js';
import {
  detectLevels,
  toGameRows,
  toPracticeRows,
  toBlockerInputs,
  type CoachScheduleFile,
} from './schedule-transform.js';

const here = dirname(fileURLToPath(import.meta.url));
const schedulePath = resolve(here, '../../../../docs/schedules/2026-27-girls-soccer.json');
const schedule = JSON.parse(readFileSync(schedulePath, 'utf8')) as CoachScheduleFile;

/** Mirrors parseDateTimeToUTC in service.ts - a row is only importable if this holds. */
function parsesAsDatetime(date: string, time: string): boolean {
  return !Number.isNaN(new Date(`${date}T${time}:00`).getTime());
}

describe('the real schedule file', () => {
  it('is the one Truman sent, with every event lacking a start time', () => {
    expect(schedule.events).toHaveLength(22);
    expect(schedule.events.every((e) => e.start_time === null)).toBe(true);
  });
});

describe('detectLevels', () => {
  it('reads both squads from "JV + V"', () => {
    expect(detectLevels('Ursuline JV + V @ TCA')).toEqual({
      levels: ['JV', 'VARSITY'],
      stated: true,
    });
  });

  it('reads JV alone from a parenthetical', () => {
    expect(detectLevels('Prestonwood @ TCA (JV vs. Storm)')).toEqual({
      levels: ['JV'],
      stated: true,
    });
    expect(detectLevels('Covenant (JV?) @ TCA')).toEqual({ levels: ['JV'], stated: true });
  });

  it('reports nothing stated when the line carries no level marker', () => {
    expect(detectLevels('DISTRICT GAME 1 - TCA @ NOLAN')).toEqual({ levels: [], stated: false });
    expect(detectLevels('Greenhill @ TCA')).toEqual({ levels: [], stated: false });
  });

  it('does not mistake a stray V inside a word for the varsity marker', () => {
    expect(detectLevels('Away Date Available')).toEqual({ levels: [], stated: false });
    expect(detectLevels('Tyler Tournament Game 1 - Latest Slot Evening')).toEqual({
      levels: [],
      stated: false,
    });
  });
});

describe('toGameRows', () => {
  const varsity = toGameRows(schedule, { level: 'VARSITY', defaultGameTime: '17:00' });
  const jv = toGameRows(schedule, { level: 'JV', defaultGameTime: '17:00' });

  it('emits rows that importService will accept', () => {
    for (const row of [...varsity.rows, ...jv.rows]) {
      expect(gameRowSchema.safeParse(row).success).toBe(true);
      expect(parsesAsDatetime(row.date, row.time)).toBe(true);
      expect(row.opponent.trim().length).toBeGreaterThan(0);
    }
  });

  it('never invents an opponent - the five opponent-less events are skipped, not padded', () => {
    const opponentless = schedule.events.filter((e) => !e.opponent);
    expect(opponentless).toHaveLength(5);

    for (const event of opponentless) {
      expect(varsity.rows.some((r) => r.date === event.date)).toBe(false);
      const skip = varsity.skipped.find((s) => s.date === event.date);
      expect(skip).toBeDefined();
      expect(skip!.reason).toMatch(/opponent/i);
    }
  });

  it('keeps a JV-only game off the varsity sheet and on the JV sheet', () => {
    const jvOnly = '2026-11-05'; // "Prestonwood @ TCA (JV vs. Storm)"
    expect(varsity.rows.some((r) => r.date === jvOnly)).toBe(false);
    expect(jv.rows.some((r) => r.date === jvOnly)).toBe(true);

    const skip = varsity.skipped.find((s) => s.date === jvOnly);
    expect(skip!.reason).toContain('JV');
  });

  it('puts a "JV + V" game on both sheets', () => {
    const both = '2026-11-12'; // "Ursuline JV + V @ TCA"
    expect(varsity.rows.some((r) => r.date === both)).toBe(true);
    expect(jv.rows.some((r) => r.date === both)).toBe(true);
  });

  it('gives an unstated-level game to both squads and says so in the note', () => {
    const unstated = '2027-01-21'; // "DISTRICT GAME 1 - TCA @ NOLAN"
    const v = varsity.rows.find((r) => r.date === unstated);
    const j = jv.rows.find((r) => r.date === unstated);
    expect(v).toBeDefined();
    expect(j).toBeDefined();
    expect(v!.notes).toContain('level not stated in source');
  });

  it('flags an assumed start time on every row, since the source has none', () => {
    for (const row of varsity.rows) {
      expect(row.time).toBe('17:00');
      expect(row.notes).toContain('start time not in source');
    }
  });

  it('flags the event whose home/away the coach never stated', () => {
    const unstated = varsity.rows.find((r) => r.date === '2026-12-08'); // "(ESD TBD)"
    expect(unstated!.homeAway).toBe('NEUTRAL');
    expect(unstated!.notes).toContain('home/away not stated in source');
  });

  it('flags tentative games rather than presenting them as settled', () => {
    const tentative = varsity.rows.find((r) => r.date === '2027-01-04'); // "(JPII ? @ TCA)"
    expect(tentative!.notes).toContain('tentative');
  });

  it('carries the coach\'s original wording through verbatim', () => {
    for (const row of varsity.rows) {
      const event = schedule.events.find((e) => e.date === row.date)!;
      expect(row.notes).toContain(event.source_text);
    }
  });

  it('numbers rows contiguously from 1 so import errors point at the right row', () => {
    expect(varsity.rows.map((r) => r.row)).toEqual(
      varsity.rows.map((_, i) => i + 1)
    );
  });

  it('accounts for every event exactly once, as a row or as a skip', () => {
    expect(varsity.rows.length + varsity.skipped.length).toBe(schedule.events.length);
    expect(jv.rows.length + jv.skipped.length).toBe(schedule.events.length);
  });
});

describe('toPracticeRows', () => {
  const result = toPracticeRows(schedule, { assumedEndDate: '2026-10-31' });

  it('emits rows importService will accept', () => {
    for (const row of result.rows) {
      expect(practiceRowSchema.safeParse(row).success).toBe(true);
      expect(parsesAsDatetime(row.date, row.time)).toBe(true);
    }
  });

  it('runs 4:15-5:30, which is 75 minutes, not the 90-minute default', () => {
    expect(result.rows.every((r) => r.duration === 75)).toBe(true);
    expect(result.rows.every((r) => r.time === '16:15')).toBe(true);
  });

  it('only lands on Monday through Thursday', () => {
    for (const row of result.rows) {
      const day = new Date(`${row.date}T00:00:00Z`).getUTCDay();
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(4);
    }
  });

  it('starts on the stated first training day', () => {
    expect(result.rows[0].date).toBe('2026-09-08');
  });

  it('admits that the closing date was assumed, not stated', () => {
    expect(result.endDateInferred).toBe(true);
    expect(result.rows[0].notes).toContain('end date assumed');
    expect(result.rows[result.rows.length - 1].date <= '2026-10-31').toBe(true);
  });
});

describe('toBlockerInputs', () => {
  const blockers = toBlockerInputs(schedule);

  it('turns Discovery Week into a blocker covering all five days', () => {
    expect(blockers).toHaveLength(1);
    const [discovery] = blockers;
    expect(discovery.name).toBe('Discovery Week');
    expect(discovery.startDatetime.toISOString()).toBe('2027-02-01T00:00:00.000Z');
    // Inclusive of the 5th - a window ending at midnight would leave that day open.
    expect(discovery.endDatetime.toISOString()).toBe('2027-02-05T23:59:59.000Z');
    expect(discovery.endDatetime.getTime()).toBeGreaterThan(discovery.startDatetime.getTime());
  });

  it('does not collide with any game this season, which is worth knowing before import', () => {
    const [discovery] = blockers;
    const colliding = schedule.events.filter((e) => {
      const at = new Date(`${e.date}T00:00:00Z`).getTime();
      return at >= discovery.startDatetime.getTime() && at <= discovery.endDatetime.getTime();
    });
    expect(colliding).toEqual([]);
  });
});
