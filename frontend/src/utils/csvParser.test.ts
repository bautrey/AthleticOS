import { describe, it, expect } from 'vitest';
import {
  parseGamesCsv,
  parsePracticesCsv,
  detectAndParseCsv,
} from './csvParser';

function csvFile(content: string, name = 'data.csv'): File {
  return new File([content], name, { type: 'text/csv' });
}

describe('csvParser', () => {
  describe('parseGamesCsv', () => {
    it('parses a well-formed games CSV', async () => {
      const csv = [
        'date,time,opponent,home_away,facility,notes',
        '2027-03-15,15:00,Lincoln High,HOME,Main Gym,Big rivalry',
        '03/22/2027,7:30 PM,Jefferson,AWAY,,',
      ].join('\n');

      const result = await parseGamesCsv(csvFile(csv));
      expect(result.type).toBe('games');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toMatchObject({
        row: 2,
        date: '2027-03-15',
        time: '15:00',
        opponent: 'Lincoln High',
        homeAway: 'HOME',
        facility: 'Main Gym',
      });
      // 7:30 PM → 19:30 (24h)
      expect(result.rows[1].time).toBe('19:30');
      // M/D/YYYY → YYYY-MM-DD
      expect(result.rows[1].date).toBe('2027-03-22');
      expect(result.rows[1].homeAway).toBe('AWAY');
      expect(result.rows[1].facility).toBeNull();
    });

    it('flags missing required columns', async () => {
      const csv = ['date,time', '2027-03-15,15:00'].join('\n');
      const result = await parseGamesCsv(csvFile(csv));
      expect(result.isValid).toBe(false);
      const fields = result.errors.map((e) => e.field);
      expect(fields).toEqual(expect.arrayContaining(['opponent', 'home_away']));
    });

    it('flags invalid date format with row number', async () => {
      const csv = [
        'date,time,opponent,home_away',
        'not-a-date,15:00,Lincoln,HOME',
      ].join('\n');
      const result = await parseGamesCsv(csvFile(csv));
      expect(result.isValid).toBe(false);
      const err = result.errors.find((e) => e.field === 'date' && e.row === 2);
      expect(err).toBeTruthy();
    });

    it('accepts H/A as well as HOME/AWAY for home_away', async () => {
      const csv = [
        'date,time,opponent,home_away',
        '2027-03-15,15:00,Lincoln,H',
        '2027-03-16,15:00,Jefferson,A',
        '2027-03-17,15:00,Roosevelt,N',
      ].join('\n');
      const result = await parseGamesCsv(csvFile(csv));
      expect(result.isValid).toBe(true);
      expect(result.rows.map((r) => r.homeAway)).toEqual(['HOME', 'AWAY', 'NEUTRAL']);
    });

    it('strips Excel formula injection from cell values', async () => {
      // Cells starting with =, +, -, or @ are a classic Excel injection vector.
      const csv = [
        'date,time,opponent,home_away,notes',
        '2027-03-15,15:00,=SUM(A1),HOME,@malicious',
      ].join('\n');
      const result = await parseGamesCsv(csvFile(csv));
      expect(result.rows[0].opponent).toBe('SUM(A1)');
      expect(result.rows[0].notes).toBe('malicious');
    });
  });

  describe('parsePracticesCsv', () => {
    it('parses a well-formed practices CSV with default duration', async () => {
      const csv = [
        'date,time,duration,facility',
        '2027-03-15,15:30,90,Main Gym',
        '2027-03-16,16:00,,Auxiliary Gym', // missing duration → default 90
      ].join('\n');
      const result = await parsePracticesCsv(csvFile(csv));
      expect(result.type).toBe('practices');
      expect(result.isValid).toBe(true);
      expect(result.rows[0].duration).toBe(90);
      expect(result.rows[1].duration).toBe(90);
    });

    it('rejects out-of-range durations (>8h or <=0)', async () => {
      const csv = [
        'date,time,duration',
        '2027-03-15,15:30,600', // 10 hours
        '2027-03-16,15:30,0',
      ].join('\n');
      const result = await parsePracticesCsv(csvFile(csv));
      // Out-of-range values fall back to 90 (default) and produce no errors.
      // What matters is that they don't get persisted as 600.
      expect(result.rows[0].duration).toBe(90);
      expect(result.rows[1].duration).toBe(90);
    });

    it('flags missing required columns', async () => {
      const csv = ['facility', 'Main Gym'].join('\n');
      const result = await parsePracticesCsv(csvFile(csv));
      expect(result.isValid).toBe(false);
      const fields = result.errors.map((e) => e.field);
      expect(fields).toEqual(expect.arrayContaining(['date', 'time']));
    });
  });

  describe('detectAndParseCsv', () => {
    it('detects games CSV from opponent + home_away columns', async () => {
      const csv = [
        'date,time,opponent,home_away',
        '2027-03-15,15:00,Lincoln,HOME',
      ].join('\n');
      const result = await detectAndParseCsv(csvFile(csv));
      expect(result.type).toBe('games');
      expect(result.isValid).toBe(true);
    });

    it('detects practices CSV from a duration column', async () => {
      const csv = [
        'date,time,duration',
        '2027-03-15,15:00,90',
      ].join('\n');
      const result = await detectAndParseCsv(csvFile(csv));
      expect(result.type).toBe('practices');
      expect(result.isValid).toBe(true);
    });

    it('returns "unknown" type with a helpful error when no signal columns are present', async () => {
      const csv = ['title,notes', 'Hello,World'].join('\n');
      const result = await detectAndParseCsv(csvFile(csv));
      expect(result.type).toBe('unknown');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toMatch(/could not detect csv type/i);
    });

    it('accepts column-name aliases (e.g. "vs" for opponent, "h/a" for home/away)', async () => {
      const csv = [
        'date,time,vs,h/a',
        '2027-03-15,15:00,Lincoln,HOME',
      ].join('\n');
      const result = await detectAndParseCsv(csvFile(csv));
      expect(result.type).toBe('games');
      expect(result.isValid).toBe(true);
    });
  });
});
