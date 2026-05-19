// backend/src/modules/quick-add/parser.test.ts
// Pure-function tests for the quick-add text parser.
import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from './parser.js';

const facilities = [
  { id: 'fac-gym', name: 'Main Gym' },
  { id: 'fac-aux', name: 'Auxiliary Gym' },
  { id: 'fac-field', name: 'Soccer Field' },
  { id: 'fac-track', name: 'Track' },
];

const teams = [
  { id: 'team-vbb', name: 'Varsity Basketball', sport: 'Basketball', seasonId: 'season-vbb' },
  { id: 'team-jvbb', name: 'JV Basketball', sport: 'Basketball', seasonId: 'season-jvbb' },
  { id: 'team-soccer', name: 'Varsity Soccer', sport: 'Soccer', seasonId: 'season-soccer' },
];

// Monday 2026-01-05 anchors offset math (Mon=0, Tue=1, ...).
const ctx = (overrides: Partial<Parameters<typeof parseQuickAdd>[1]> = {}) => ({
  facilities,
  teams,
  weekStartDate: '2026-01-05T00:00:00.000Z',
  ...overrides,
});

describe('parseQuickAdd', () => {
  describe('event type', () => {
    it('defaults to PRACTICE when no "vs <opponent>"', () => {
      const result = parseQuickAdd('Tuesday 3:30-5pm Varsity Basketball Main Gym', ctx());
      expect(result.eventType).toBe('PRACTICE');
      expect(result.opponent).toBeNull();
    });

    it('switches to GAME when "vs <opponent>" is present', () => {
      const result = parseQuickAdd(
        'Friday 7pm Varsity Basketball vs Lincoln High at Main Gym',
        ctx()
      );
      expect(result.eventType).toBe('GAME');
      expect(result.opponent).toBe('Lincoln High at Main Gym');
    });

    it('parses opponent after "vs." with a period', () => {
      const result = parseQuickAdd('Sat 2pm Varsity Soccer vs. Jefferson', ctx());
      expect(result.eventType).toBe('GAME');
      expect(result.opponent).toBe('Jefferson');
    });
  });

  describe('day of week', () => {
    it.each([
      ['Mon', 0, '2026-01-05'],
      ['Tue', 1, '2026-01-06'],
      ['Wed', 2, '2026-01-07'],
      ['Thu', 3, '2026-01-08'],
      ['Fri', 4, '2026-01-09'],
      ['Sat', 5, '2026-01-10'],
      ['Sun', 6, '2026-01-11'],
    ])('maps %s correctly into the week (offset %i)', (day, _offset, expectedDate) => {
      const result = parseQuickAdd(`${day} 3:30pm`, ctx());
      expect(result.dayOfWeek).toBe(day);
      expect(result.datetime?.startsWith(expectedDate)).toBe(true);
    });

    it('accepts full day names', () => {
      const result = parseQuickAdd('Wednesday 4pm', ctx());
      expect(result.dayOfWeek).toBe('Wed');
    });

    it('accepts day abbreviations like "thurs" and "tues"', () => {
      const t = parseQuickAdd('tues 4pm', ctx());
      expect(t.dayOfWeek).toBe('Tue');
      const th = parseQuickAdd('thurs 4pm', ctx());
      expect(th.dayOfWeek).toBe('Thu');
    });

    it('matches day as whole word — "mondays" does not match "mon"', () => {
      const result = parseQuickAdd('mondays are heavy 4pm', ctx());
      expect(result.dayOfWeek).toBeNull();
    });

    it('returns null datetime when no day given', () => {
      const result = parseQuickAdd('3:30-5pm Main Gym Varsity Basketball', ctx());
      expect(result.dayOfWeek).toBeNull();
      expect(result.datetime).toBeNull();
      expect(result.missingFields).toContain('day');
    });
  });

  describe('time parsing', () => {
    it('parses "3:30-5pm" range with implied PM', () => {
      const result = parseQuickAdd('Tue 3:30-5pm', ctx());
      expect(result.startTime).toBe('15:30');
      expect(result.endTime).toBe('17:00');
      expect(result.durationMinutes).toBe(90);
    });

    it('parses 24-hour range "15:30-17:00"', () => {
      const result = parseQuickAdd('Tue 15:30-17:00', ctx());
      expect(result.startTime).toBe('15:30');
      expect(result.endTime).toBe('17:00');
    });

    it('parses single-time "7pm" with no end', () => {
      const result = parseQuickAdd('Fri 7pm vs Lincoln', ctx());
      expect(result.startTime).toBe('19:00');
      expect(result.endTime).toBeNull();
      expect(result.durationMinutes).toBeNull();
    });

    it('handles AM correctly (8am = 08:00, 12am = 00:00)', () => {
      const r1 = parseQuickAdd('Sat 8am Track', ctx());
      expect(r1.startTime).toBe('08:00');
      const r2 = parseQuickAdd('Sat 12am Track', ctx());
      expect(r2.startTime).toBe('00:00');
    });

    it('handles 12pm = 12:00 (noon)', () => {
      const result = parseQuickAdd('Sat 12pm Track', ctx());
      expect(result.startTime).toBe('12:00');
    });

    it('does not return durationMinutes when end <= start', () => {
      // 5pm to 3pm — invalid range, should be ignored
      const result = parseQuickAdd('Tue 5pm-3pm', ctx());
      expect(result.durationMinutes).toBeNull();
    });

    it('defaults to 3:30 PM (15:30) when day is present but no time', () => {
      const result = parseQuickAdd('Wednesday Main Gym Varsity Basketball', ctx());
      expect(result.datetime).toBeTruthy();
      expect(result.datetime).toContain('T15:30:00');
      expect(result.startTime).toBeNull();
      expect(result.missingFields).toContain('time');
    });
  });

  describe('facility matching', () => {
    it('matches a facility by substring', () => {
      // Tokenizer only splits on , @ | — keep facility alone or comma-separated.
      const result = parseQuickAdd('Mon 4pm Main Gym', ctx());
      expect(result.facilityId).toBe('fac-gym');
      expect(result.facilityName).toBe('Main Gym');
    });

    it('returns multiple matches when ambiguous (no auto-pick)', () => {
      // "Gym" alone matches both Main Gym and Auxiliary Gym
      const result = parseQuickAdd('Mon 4pm Gym', ctx());
      expect(result.facilityId).toBeNull();
      expect(result.facilityMatches.length).toBeGreaterThanOrEqual(2);
      expect(result.missingFields).toContain('facility');
    });

    it('falls back to fuzzy match within Levenshtein distance', () => {
      // "Trak" → Levenshtein 1 from "Track"
      const result = parseQuickAdd('Mon 4pm Trak', ctx());
      expect(result.facilityId).toBe('fac-track');
    });
  });

  describe('team matching', () => {
    it('matches a team by substring', () => {
      const result = parseQuickAdd('Wed 4pm Varsity Soccer', ctx());
      expect(result.teamId).toBe('team-soccer');
      expect(result.seasonId).toBe('season-soccer');
    });

    it('returns multiple matches when ambiguous', () => {
      // "Basketball" matches both Varsity and JV Basketball
      const result = parseQuickAdd('Mon 4pm Basketball', ctx());
      expect(result.teamId).toBeNull();
      expect(result.teamMatches.length).toBeGreaterThanOrEqual(2);
    });

    it('seasonId is null when team has no seasonId in context', () => {
      const teamsNoSeason = [{ id: 'team-x', name: 'Wrestling', sport: 'Wrestling' }];
      const result = parseQuickAdd(
        'Mon 4pm Wrestling',
        ctx({ teams: teamsNoSeason })
      );
      expect(result.teamId).toBe('team-x');
      expect(result.seasonId).toBeNull();
    });
  });

  describe('confidence + missing fields', () => {
    it('reaches 1.0 confidence for a complete practice', () => {
      // Comma separates the facility and team tokens (tokenizer does not split on whitespace).
      const result = parseQuickAdd('Mon 3:30-5pm Main Gym, Varsity Soccer', ctx());
      expect(result.confidence).toBe(1);
      expect(result.missingFields).toEqual([]);
    });

    it('reports day/time/team/facility as missing for empty input', () => {
      const result = parseQuickAdd('', ctx());
      expect(result.missingFields).toEqual(
        expect.arrayContaining(['day', 'time', 'team', 'facility'])
      );
      expect(result.confidence).toBe(0);
    });

    it('reports opponent missing only for games', () => {
      const game = parseQuickAdd('Fri 7pm Varsity Soccer Field vs Lincoln', ctx());
      // GAME path scores out of 5; check opponent isn't in missing
      expect(game.missingFields).not.toContain('opponent');

      const practice = parseQuickAdd('Mon 3:30pm Varsity Soccer Field', ctx());
      expect(practice.missingFields).not.toContain('opponent');
    });

    it('confidence is bounded [0, 1]', () => {
      const partial = parseQuickAdd('Mon Main Gym', ctx());
      expect(partial.confidence).toBeGreaterThanOrEqual(0);
      expect(partial.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('robustness', () => {
    it('does not throw on empty string', () => {
      expect(() => parseQuickAdd('', ctx())).not.toThrow();
    });

    it('does not throw on garbage input', () => {
      expect(() => parseQuickAdd('!!!@@@###$$$', ctx())).not.toThrow();
    });

    it('tolerates leading and trailing whitespace', () => {
      const result = parseQuickAdd('   Mon    3:30-5pm   ', ctx());
      expect(result.dayOfWeek).toBe('Mon');
      expect(result.startTime).toBe('15:30');
      expect(result.endTime).toBe('17:00');
    });
  });
});
