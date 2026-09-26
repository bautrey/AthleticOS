// backend/src/modules/import/schooldude-transform.ts
//
// Turns parsed SchoolDude rows into the shapes AthleticOS reasons about.
//
// Deliberately format-independent: it operates on SchoolDudeEvent, so the same
// code serves the PDF we have today and the Excel export we have asked for.
//
// Three jobs, each of which a naive import gets wrong:
//   1. Some "rooms" are not places. An away game is recorded against a pseudo-room
//      like "US VB AWAY", and importing those as facilities invents buildings and
//      then reports collisions inside them.
//   2. The school level Truman needs - upper, middle, lower - is not a field. It
//      lives in the event name, and the vocabulary is inconsistent: "US", "MS",
//      "TCA 5th/6th", "7th & 8th".
//   3. One booking can hold several rooms at once. A home football game reserves
//      the turf, the track, the mall and the restrooms, and arrives as four rows.
//      Treating those as four events both overcounts and loses the fact that they
//      are one thing.

import type { SchoolDudeEvent } from './schooldude-parse.js';

export type SchoolLevel = 'LOWER' | 'MIDDLE' | 'UPPER';
export type TeamLevel = 'VARSITY' | 'JV';
export type EventKind = 'PRACTICE' | 'GAME' | 'OTHER';
export type HomeAway = 'HOME' | 'AWAY' | null;

export type RoomKind =
  /** A real bookable space. */
  | 'FACILITY'
  /** Not a place: a marker that the team is playing elsewhere. */
  | 'AWAY_PLACEHOLDER';

/**
 * Away bookings are recorded against a pseudo-room named for the team, always
 * ending in AWAY - "US VB AWAY", "MS FB AWAY". They hold no space at the school,
 * so two of them overlapping is not a facility conflict and importing them as
 * facilities would create buildings that do not exist.
 */
export function classifyRoom(room: string | null): RoomKind {
  if (!room) return 'FACILITY';
  return /\bAWAY\b/i.test(room) ? 'AWAY_PLACEHOLDER' : 'FACILITY';
}

export interface EventNameFacts {
  /** Stated in the name. Null means the name does not say, not that it is unknown. */
  schoolLevel: SchoolLevel | null;
  /**
   * `schoolLevel` where stated, otherwise the best available reading.
   *
   * Kept separate from `schoolLevel` so a caller can tell a fact from a reading.
   * The rule: at this school middle-school teams are always written "MS", so a
   * Varsity or JV team with no division named is Upper School. Verified against
   * the fixture - no name combines "MS" with "Varsity" or "JV". Revisit if a
   * future export breaks that convention.
   */
  inferredSchoolLevel: SchoolLevel | null;
  teamLevel: TeamLevel | null;
  sport: string | null;
  kind: EventKind;
  homeAway: HomeAway;
}

/** Grade spans, because the school writes some teams by grade rather than by division. */
const GRADE_SPANS: Array<{ pattern: RegExp; level: SchoolLevel }> = [
  { pattern: /\b5th\s*\/\s*6th\b/i, level: 'LOWER' },
  { pattern: /\b7th\s*(?:&|and)\s*8th\b/i, level: 'MIDDLE' },
];

const SPORTS: Array<{ pattern: RegExp; sport: string }> = [
  { pattern: /\bcheer\b/i, sport: 'Cheer' },
  { pattern: /\b(?:volleyball|vb)\b/i, sport: 'Volleyball' },
  { pattern: /\b(?:football|fb)\b/i, sport: 'Football' },
  { pattern: /\bbasketball\b/i, sport: 'Basketball' },
  { pattern: /\bcross\s*country\b/i, sport: 'Cross Country' },
  { pattern: /\btrack\b/i, sport: 'Track' },
  { pattern: /\btennis\b/i, sport: 'Tennis' },
  { pattern: /\bsoccer\b/i, sport: 'Soccer' },
  { pattern: /\bsoftball\b/i, sport: 'Softball' },
];

/**
 * Read what the event name states. Never infers beyond it.
 *
 * The names are also lossy: the PDF's Event column clips at its width, so
 * "MS Football Practice" arrives as "MS Football Practic" and "Tenfifteen
 * Ministries" as "Tenfifteen Ministri". Matching is therefore on stems rather than
 * whole words wherever a clipped form was actually observed.
 */
export function parseEventName(name: string): EventNameFacts {
  const text = name ?? '';

  let schoolLevel: SchoolLevel | null = null;
  for (const { pattern, level } of GRADE_SPANS) {
    if (pattern.test(text)) schoolLevel = level;
  }
  if (!schoolLevel) {
    // "MS/US Boys Basketball" names both. Neither wins, because the booking really
    // is shared, and picking one would file it under a division it half belongs to.
    const ms = /\bMS\b/.test(text);
    const us = /\bUS\b/.test(text);
    if (ms && !us) schoolLevel = 'MIDDLE';
    else if (us && !ms) schoolLevel = 'UPPER';
  }

  // "Varsity & JV Cheer" names both; leave it unset rather than choose.
  const varsity = /\bvarsity\b/i.test(text) || /\bV\b/.test(text);
  const jv = /\bJV\b/i.test(text);
  const teamLevel: TeamLevel | null = varsity && !jv ? 'VARSITY' : jv && !varsity ? 'JV' : null;

  const sport = SPORTS.find(({ pattern }) => pattern.test(text))?.sport ?? null;

  // "Practic" is the clipped form and appears in the real data.
  const kind: EventKind = /\bpractic/i.test(text) || /\bskills\b/i.test(text) || /\boffseason\b/i.test(text)
    ? 'PRACTICE'
    : /\b(?:game|match|meet|event)\b/i.test(text)
      ? 'GAME'
      : 'OTHER';

  const homeAway: HomeAway = /\baway\b/i.test(text) ? 'AWAY' : /\bhome\b/i.test(text) ? 'HOME' : null;

  const inferredSchoolLevel: SchoolLevel | null =
    schoolLevel ?? (teamLevel === 'VARSITY' || teamLevel === 'JV' ? 'UPPER' : null);

  return { schoolLevel, inferredSchoolLevel, teamLevel, sport, kind, homeAway };
}

export interface Booking {
  /** Unique per occurrence: scheduleId alone identifies a recurring series, not a date. */
  key: string;
  scheduleId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  event: string;
  contact: string | null;
  /** Every space this one booking holds. Usually one; a home football game holds four. */
  rooms: string[];
  /** Rooms that are real places, i.e. excluding away placeholders. */
  facilityRooms: string[];
  isAway: boolean;
  facts: EventNameFacts;
}

/**
 * Collapse the rows of one booking into a single occurrence.
 *
 * Keyed on scheduleId + date + startTime. Verified against the fixture: that key
 * groups the multi-room rows of a single booking and never merges two different
 * bookings, while scheduleId + date alone would merge a series' repeats.
 */
export function groupBookings(events: SchoolDudeEvent[]): Booking[] {
  const byKey = new Map<string, SchoolDudeEvent[]>();
  for (const e of events) {
    const key = `${e.scheduleId}|${e.date}|${e.startTime ?? ''}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(e);
    else byKey.set(key, [e]);
  }

  return [...byKey.entries()].map(([key, rows]) => {
    const first = rows[0];
    const rooms = rows.map((r) => r.room).filter((r): r is string => Boolean(r));
    const facilityRooms = rooms.filter((r) => classifyRoom(r) === 'FACILITY');
    return {
      key,
      scheduleId: first.scheduleId,
      date: first.date,
      startTime: first.startTime,
      endTime: first.endTime,
      event: first.event,
      contact: first.contact,
      rooms,
      facilityRooms,
      // A booking is away when it holds no real space at the school.
      isAway: rooms.length > 0 && facilityRooms.length === 0,
      facts: parseEventName(first.event),
    };
  });
}

export interface RoomConflict {
  date: string;
  room: string;
  a: Booking;
  b: Booking;
  overlapMinutes: number;
}

function toMinutes(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/**
 * Two different bookings holding the same real room at overlapping times.
 *
 * Away placeholders are excluded: two away games overlapping means two teams are
 * both elsewhere, which is normal. Rows of the same booking cannot conflict with
 * each other, which grouping already handles.
 */
export function findRoomConflicts(bookings: Booking[]): RoomConflict[] {
  const byRoomDay = new Map<string, Array<{ b: Booking; room: string }>>();
  for (const b of bookings) {
    for (const room of b.facilityRooms) {
      const k = `${b.date}|${room}`;
      const bucket = byRoomDay.get(k);
      if (bucket) bucket.push({ b, room });
      else byRoomDay.set(k, [{ b, room }]);
    }
  }

  const conflicts: RoomConflict[] = [];
  for (const entries of byRoomDay.values()) {
    const timed = entries
      .map((e) => ({ ...e, s: toMinutes(e.b.startTime), e2: toMinutes(e.b.endTime) }))
      .filter((e) => e.s !== null && e.e2 !== null && e.e2! > e.s!)
      .sort((x, y) => x.s! - y.s!);

    for (let i = 0; i < timed.length; i++) {
      for (let j = i + 1; j < timed.length; j++) {
        if (timed[i].e2! <= timed[j].s!) break; // sorted, so nothing later can overlap either
        conflicts.push({
          date: timed[i].b.date,
          room: timed[i].room,
          a: timed[i].b,
          b: timed[j].b,
          overlapMinutes: Math.min(timed[i].e2!, timed[j].e2!) - timed[j].s!,
        });
      }
    }
  }
  return conflicts;
}
