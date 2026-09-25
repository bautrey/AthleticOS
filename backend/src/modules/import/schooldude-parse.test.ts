// backend/src/modules/import/schooldude-parse.test.ts
//
// Runs against the real SchoolDude export (extracted with `pdftotext -layout`
// from docs/schedules/2026-schooldude-athletic-calendar.pdf), not a hand-built
// fixture, because the whole point of this parser is surviving that report's
// actual line-wrapping quirks. The file's own last line reads
// "Count of Events       870" - that is the ground truth this suite checks
// the parser against, not the 950 you get from a naive count of every line
// that starts with a date (870 real records + 80 per-page footer timestamps,
// which also start with a date and must NOT be parsed as records).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { parseSchoolDudeCalendar, type SchoolDudeEvent } from './schooldude-parse.js';

const here = dirname(fileURLToPath(import.meta.url));
// Committed fixture rather than a scratch file: the previous path pointed into
// .scratch/, which is gitignored, so this suite passed only on the machine that
// happened to have run pdftotext. Produced by:
//   pdftotext -layout docs/schedules/2026-schooldude-athletic-calendar.pdf <this file>
// The PDF it comes from is already in the repo, so the fixture adds no data that
// was not already committed.
const calendarPath = resolve(here, 'fixtures/schooldude-calendar-2026-fall.txt');
const calendarText = readFileSync(calendarPath, 'utf8');

function find(events: SchoolDudeEvent[], scheduleId: string): SchoolDudeEvent[] {
  return events.filter((e) => e.scheduleId === scheduleId);
}

describe('the real SchoolDude export', () => {
  it('parses every record the report itself counts, with nothing skipped', () => {
    const { events, skipped } = parseSchoolDudeCalendar(calendarText);
    // Matches the report's own "Count of Events       870" footer line.
    expect(events).toHaveLength(870);
    expect(skipped).toEqual([]);
  });

  it('finds the MS VB Practice collision: same slot, two different rooms', () => {
    const { events } = parseSchoolDudeCalendar(calendarText);

    // 182792 and 182807 are booked for the same date and the same 2:30-4:15
    // window - this is a real double-booking at the school, and telling
    // these two apart by room is the entire reason this parser exists.
    const atc = find(events, '182792').find((e) => e.date === '2026-09-01');
    expect(atc).toMatchObject({
      scheduleId: '182792',
      date: '2026-09-01',
      startTime: '14:30',
      endTime: '16:15',
      event: 'MS VB Practice - ATC',
      area: 'Gym',
    });
    expect(atc?.room).toContain('ATC RM 106');

    const mcb = find(events, '182807').find((e) => e.date === '2026-09-01');
    expect(mcb).toMatchObject({
      scheduleId: '182807',
      date: '2026-09-01',
      startTime: '14:30',
      endTime: '16:15',
      area: 'Gym',
    });
    // Proves the two bookings are distinguished by room rather than merged.
    expect(mcb?.room).not.toEqual(atc?.room);
  });

  it('rejoins an Event that wraps across three lines', () => {
    const { events } = parseSchoolDudeCalendar(calendarText);

    // Line A holds "Varsity Cross", line B holds "Country Practice -", and a
    // third line (with nothing but Event-column text) holds "Track".
    const event = events.find(
      (e) => e.scheduleId === '183059' && e.date === '2026-09-01'
    );
    expect(event?.event).toBe('Varsity Cross Country Practice - Track');
  });

  it('rejoins a Room that wraps across two lines and strips the building prefix', () => {
    const { events } = parseSchoolDudeCalendar(calendarText);

    // Raw source: "Athletic Training Cntr|ATC" then a continuation line
    // "RM 106 Gym" - the building name and the pipe must not leak into room.
    const event = events.find(
      (e) => e.scheduleId === '182792' && e.date === '2026-09-01'
    );
    expect(event?.building).toBe('Athletic Training Cntr');
    expect(event?.room).toBe('ATC RM 106 Gym');
  });

  it('produces no events from page headers, footers, or their repeated timestamps', () => {
    const { events } = parseSchoolDudeCalendar(calendarText);

    // A page-footer timestamp ("9/22/2026 11:25:45 AM ... Page 1 of 80")
    // matches "starts with a date" the same way a real record does; only the
    // Date-column-holds-nothing-but-the-date check tells them apart. None of
    // the report's furniture text should ever show up inside a parsed field.
    expect(events.some((e) => e.event.includes('Trinity Christian Academy'))).toBe(false);
    expect(events.some((e) => /Page \d+ of \d+/.test(e.event))).toBe(false);
    expect(events.some((e) => e.event.includes('Count of Events'))).toBe(false);
    expect(events.some((e) => /^\d{1,2}:\d{2}:\d{2}/.test(e.event))).toBe(false);
  });

  it('has real, non-unique schedule ids - SchoolDude reuses one id per recurring series', () => {
    const { events } = parseSchoolDudeCalendar(calendarText);

    const counts = new Map<string, number>();
    for (const e of events) counts.set(e.scheduleId, (counts.get(e.scheduleId) ?? 0) + 1);

    // 182792 (MS VB Practice - ATC) recurs on 8 different dates under the
    // same schedule id, which is exactly why scheduleId alone can't be
    // treated as a unique row key.
    expect(counts.get('182792')).toBe(8);

    // Measured directly against this file: 95 distinct schedule ids across
    // 870 events, 82 of which recur (857 of the 870 events belong to a
    // recurring id, the other 13 ids appear exactly once). This is a
    // property of the source data, not an assumption - re-derive it here
    // instead of hard-coding 950/870 style guesses.
    const idsAppearingMoreThanOnce = [...counts.values()].filter((c) => c > 1);
    expect(counts.size).toBe(95);
    expect(idsAppearingMoreThanOnce).toHaveLength(82);
    expect(idsAppearingMoreThanOnce.reduce((sum, c) => sum + c, 0)).toBe(857);
  });

  it('gives every event a date that parses and falls inside the report window', () => {
    const { events } = parseSchoolDudeCalendar(calendarText);

    // The report header states "Events for 09/01/2026 - 12/31/2026" - that
    // declared window, not an empirically-observed max, is the right bound
    // here since it's the actual query the export was run with.
    const start = new Date('2026-09-01T00:00:00Z').getTime();
    const end = new Date('2026-12-31T00:00:00Z').getTime();

    for (const e of events) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const parsed = new Date(`${e.date}T00:00:00Z`).getTime();
      expect(Number.isNaN(parsed)).toBe(false);
      expect(parsed).toBeGreaterThanOrEqual(start);
      expect(parsed).toBeLessThanOrEqual(end);
    }
  });
});

describe('organization column overflow', () => {
  it('says null rather than guessing when Location eats the column', () => {
    const { events } = parseSchoolDudeCalendar(calendarText);
    const counts = new Map<string, number>();
    for (const e of events) counts.set(e.organization ?? 'null', (counts.get(e.organization ?? 'null') ?? 0) + 1);

    // Every record in this report is Athletics. 190 of them have a Location long
    // enough to swallow the start of the column, and once that happens the value
    // cannot be recovered from the rendered text - Location and Organization end up
    // separated by a single space instead of the wide gap that delimits every other
    // column. Re-splitting on whitespace picks up the Event column instead, which
    // produced confident nonsense ("Games - MCB", "Showoff", a phone number) before
    // this was settled on null.
    expect(counts.get('Athletics')).toBe(680);
    expect(counts.get('null')).toBe(190);
    expect(counts.size).toBe(2);
  });

  it('never returns a value that came from a neighbouring column', () => {
    const { events } = parseSchoolDudeCalendar(calendarText);
    const bad = events.filter((e) => e.organization !== null && e.organization !== 'Athletics');
    expect(bad.map((e) => `${e.scheduleId}:${e.organization}`)).toEqual([]);
  });
});
