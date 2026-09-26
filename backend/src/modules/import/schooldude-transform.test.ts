// backend/src/modules/import/schooldude-transform.test.ts
//
// Runs against the real export, because every rule here was derived from what
// TCA actually writes rather than from a specification.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { parseSchoolDudeCalendar } from './schooldude-parse.js';
import {
  classifyRoom,
  parseEventName,
  groupBookings,
  findRoomConflicts,
} from './schooldude-transform.js';

const here = dirname(fileURLToPath(import.meta.url));
const text = readFileSync(resolve(here, 'fixtures/schooldude-calendar-2026-fall.txt'), 'utf8');
const events = parseSchoolDudeCalendar(text).events;
const bookings = groupBookings(events);

describe('classifyRoom', () => {
  it('treats an AWAY pseudo-room as not a place', () => {
    // These hold no space at the school. Importing them as facilities would
    // invent buildings and then report collisions inside them.
    expect(classifyRoom('US VB AWAY')).toBe('AWAY_PLACEHOLDER');
    expect(classifyRoom('MS FB AWAY')).toBe('AWAY_PLACEHOLDER');
    expect(classifyRoom('US Tennis AWAY')).toBe('AWAY_PLACEHOLDER');
  });

  it('treats real rooms as facilities', () => {
    expect(classifyRoom('ATC RM 106 Gym')).toBe('FACILITY');
    expect(classifyRoom('Stadium Turf Field')).toBe('FACILITY');
    expect(classifyRoom('MCB RM 115 Gym')).toBe('FACILITY');
  });
});

describe('parseEventName', () => {
  it('reads the division the school actually writes', () => {
    expect(parseEventName('MS VB Practice - ATC').schoolLevel).toBe('MIDDLE');
    expect(parseEventName('US Football Fall Practice - Stadium').schoolLevel).toBe('UPPER');
  });

  it('reads divisions written as grade spans', () => {
    expect(parseEventName('TCA 5th/6th FB Practice - Softball Field').schoolLevel).toBe('LOWER');
    expect(parseEventName('7th & 8th HOME FB Ke Game').schoolLevel).toBe('MIDDLE');
  });

  it('refuses to choose when a name states both divisions', () => {
    // "MS/US Boys Basketball - Skills" really is shared; picking one would file it
    // under a division it half belongs to.
    expect(parseEventName('MS/US Boys Basketball - Skills').schoolLevel).toBeNull();
  });

  it('refuses to choose when a name states both team levels', () => {
    expect(parseEventName('Varsity & JV Cheer Practice').teamLevel).toBeNull();
    expect(parseEventName('JV & V Cheer Practice').teamLevel).toBeNull();
  });

  it('separates what is stated from what is inferred', () => {
    const v = parseEventName('Varsity Cheer Practice');
    expect(v.schoolLevel).toBeNull(); // the name does not say
    expect(v.inferredSchoolLevel).toBe('UPPER'); // but MS teams are always labelled MS
    expect(v.teamLevel).toBe('VARSITY');
  });

  it('does not infer a division for a name with no team level either', () => {
    expect(parseEventName('Football Team Breakfast').inferredSchoolLevel).toBeNull();
  });

  it('survives the clipping the PDF introduces', () => {
    // The Event column truncates: "Practice" arrives as "Practic".
    expect(parseEventName('MS Football Practic - Stadium').kind).toBe('PRACTICE');
    expect(parseEventName('MS Football Practic - Stadium').sport).toBe('Football');
  });

  it('reads sport, kind and home/away', () => {
    const g = parseEventName('Varsity HOME Football Game');
    expect(g).toMatchObject({ sport: 'Football', kind: 'GAME', homeAway: 'HOME' });
    const a = parseEventName('JV Volleyball - Away Game');
    expect(a).toMatchObject({ sport: 'Volleyball', kind: 'GAME', homeAway: 'AWAY' });
  });

  it('never claims the inference contradicts a stated division', () => {
    for (const b of bookings) {
      if (b.facts.schoolLevel) {
        expect(b.facts.inferredSchoolLevel).toBe(b.facts.schoolLevel);
      }
    }
  });
});

describe('groupBookings', () => {
  it('collapses the rows of one booking that holds several rooms', () => {
    // A home football game reserves the turf, the track, the mall and the
    // restrooms. Four rows, one game.
    const football = bookings.find((b) => b.scheduleId === '182949' && b.date === '2026-09-02');
    expect(football).toBeDefined();
    expect(football!.rooms.length).toBeGreaterThan(1);
    expect(football!.rooms).toContain('Stadium Turf Field');
    expect(football!.rooms).toContain('Stadium Track');
  });

  it('does not merge separate occurrences of a recurring series', () => {
    // scheduleId identifies the series, so grouping on it alone would collapse
    // every date of a repeating practice into one booking.
    const series = bookings.filter((b) => b.scheduleId === '182792');
    expect(series.length).toBeGreaterThan(1);
    expect(new Set(series.map((b) => b.date)).size).toBe(series.length);
  });

  it('accounts for every row exactly once', () => {
    const rowsBack = bookings.reduce((n, b) => n + b.rooms.length, 0);
    expect(rowsBack).toBe(events.length);
  });

  it('marks a booking away when it holds no real space', () => {
    const away = bookings.filter((b) => b.isAway);
    expect(away.length).toBeGreaterThan(0);
    for (const b of away) expect(b.facilityRooms).toEqual([]);
  });
});

describe('findRoomConflicts', () => {
  const conflicts = findRoomConflicts(bookings);

  it('finds the real facility collisions and no others', () => {
    // 39, not the 45 you get before excluding away placeholders, and not the 138
    // you get if room names are truncated so that distinct spaces merge.
    expect(conflicts).toHaveLength(39);
    expect(new Set(conflicts.map((c) => c.date)).size).toBe(28);
  });

  it('never reports a booking against itself', () => {
    for (const c of conflicts) expect(c.a.key).not.toBe(c.b.key);
  });

  it('never reports a conflict in a pseudo-room', () => {
    // Two teams both playing away is not a facility conflict.
    for (const c of conflicts) expect(classifyRoom(c.room)).toBe('FACILITY');
  });

  it('keeps the ATC main gym and the mirror area apart', () => {
    // Merging these two spaces is what produced a phantom Track Offseason
    // collision. Track is in the mirror area and collides with nothing.
    const track = bookings.filter((b) => b.event.includes('Track Offseason'));
    expect(track.length).toBeGreaterThan(0);
    for (const t of track) expect(t.rooms).toEqual(['ATC Mirror/Agility Area']);
    expect(conflicts.some((c) => c.a.event.includes('Track Offseason'))).toBe(false);
    expect(conflicts.some((c) => c.b.event.includes('Track Offseason'))).toBe(false);
  });

  it('reports a real overlap with its duration', () => {
    const sep1 = conflicts.filter((c) => c.date === '2026-09-01' && c.room === 'ATC RM 106 Gym');
    expect(sep1.length).toBeGreaterThan(0);
    for (const c of sep1) expect(c.overlapMinutes).toBeGreaterThan(0);
  });
});
