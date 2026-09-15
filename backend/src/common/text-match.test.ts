// backend/src/common/text-match.test.ts
// Pure functions, no database.

import { describe, it, expect } from 'vitest';
import {
  levenshteinDistance,
  normalizeName,
  nameSimilarity,
  rankByName,
  hasConflictingDiscriminator,
} from './text-match.js';

describe('levenshteinDistance', () => {
  it('is zero for identical strings and symmetric otherwise', () => {
    expect(levenshteinDistance('soccer', 'soccer')).toBe(0);
    expect(levenshteinDistance('soccer', 'socer')).toBe(1);
    expect(levenshteinDistance('socer', 'soccer')).toBe(1);
  });

  it('handles empty input', () => {
    expect(levenshteinDistance('', '')).toBe(0);
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
  });
});

describe('normalizeName', () => {
  it('lowercases, strips punctuation and collapses whitespace', () => {
    expect(normalizeName('Varsity Soccer (Girls)')).toBe('varsity soccer girls');
    expect(normalizeName('  JV   Basketball  ')).toBe('jv basketball');
  });

  it('keeps digits, because JV 2 and JV 3 are different teams', () => {
    expect(normalizeName('JV 2')).toBe('jv 2');
    expect(normalizeName('JV 3')).toBe('jv 3');
    expect(nameSimilarity('JV 2', 'JV 3')).toBeLessThan(1);
  });
});

describe('nameSimilarity', () => {
  it('scores a reordered name as a strong match', () => {
    // Not 1 - the strings genuinely differ - but high enough to lead a ranking.
    expect(nameSimilarity('Varsity Soccer (Girls)', 'Girls Varsity Soccer')).toBeGreaterThan(0.8);
  });

  it('THE case this exists for: reordering must beat a one-word gender swap', () => {
    // Plain edit distance gets this backwards and would propose handing the boys'
    // schedule to the girls' team.
    const reordered = nameSimilarity('Varsity Soccer (Girls)', 'Girls Varsity Soccer');
    const wrongTeam = nameSimilarity('Varsity Soccer (Girls)', 'Varsity Soccer (Boys)');
    expect(reordered).toBeGreaterThan(wrongTeam);

    const naiveReordered = levenshteinDistance(
      normalizeName('Varsity Soccer (Girls)'),
      normalizeName('Girls Varsity Soccer')
    );
    const naiveWrongTeam = levenshteinDistance(
      normalizeName('Varsity Soccer (Girls)'),
      normalizeName('Varsity Soccer (Boys)')
    );
    // Confirms the trap is real rather than hypothetical: by raw edit distance the
    // wrong team looks closer (smaller distance) than the correct reordered name.
    expect(naiveWrongTeam).toBeLessThan(naiveReordered);
  });

  it('survives a typo', () => {
    expect(nameSimilarity('Varsity Soccer', 'Varsty Soccer')).toBeGreaterThan(0.6);
  });

  it('rates unrelated names low', () => {
    expect(nameSimilarity('Varsity Soccer', 'Aquatic Center')).toBeLessThan(0.3);
  });

  it('handles empty input without throwing', () => {
    expect(nameSimilarity('', '')).toBe(1);
    expect(nameSimilarity('Soccer', '')).toBe(0);
    expect(nameSimilarity('', 'Soccer')).toBe(0);
  });
});

describe('hasConflictingDiscriminator', () => {
  it('rejects a stated gender mismatch outright', () => {
    expect(hasConflictingDiscriminator('Varsity Soccer (Girls)', 'Varsity Soccer (Boys)')).toBe(true);
    expect(nameSimilarity('Varsity Soccer (Girls)', 'Varsity Soccer (Boys)')).toBe(0);
  });

  it('rejects a stated level mismatch outright', () => {
    expect(hasConflictingDiscriminator('Varsity Soccer', 'JV Soccer')).toBe(true);
    expect(nameSimilarity('Varsity Soccer (Girls)', 'JV Soccer (Girls)')).toBe(0);
  });

  it('separates US from MS football, which is Truman\'s actual case', () => {
    expect(hasConflictingDiscriminator('US Football', 'MS Football')).toBe(true);
    expect(nameSimilarity('US Football', 'MS Football')).toBe(0);
  });

  it('stays quiet when one side simply does not say', () => {
    // "Girls Soccer" states a gender and no level, so it cannot conflict on level
    // and must remain a candidate for the varsity girls team.
    expect(hasConflictingDiscriminator('Varsity Soccer (Girls)', 'Girls Soccer')).toBe(false);
    expect(nameSimilarity('Varsity Soccer (Girls)', 'Girls Soccer')).toBeGreaterThan(0.6);
  });

  it('treats womens and girls as the same side of the gender axis', () => {
    expect(hasConflictingDiscriminator('Womens Soccer', 'Girls Soccer')).toBe(false);
    expect(hasConflictingDiscriminator('Womens Soccer', 'Boys Soccer')).toBe(true);
  });

  it('does not fire when neither name states anything', () => {
    expect(hasConflictingDiscriminator('Soccer', 'Football')).toBe(false);
  });
});

describe('rankByName', () => {
  const teams = [
    { id: 't1', name: 'Varsity Soccer (Girls)' },
    { id: 't2', name: 'Varsity Soccer (Boys)' },
    { id: 't3', name: 'JV Soccer (Girls)' },
    { id: 't4', name: 'Varsity Basketball (Girls)' },
    { id: 't5', name: 'Aquatic Center Swim' },
  ];

  it('puts the correctly-reordered team first', () => {
    const [best] = rankByName('Girls Varsity Soccer', teams);
    expect(best.candidate.id).toBe('t1');
    // A reordered name is a strong fuzzy match, not an exact one - `exact` is
    // reserved for names that are identical once normalised, which a UI may
    // pre-confirm.
    expect(best.exact).toBe(false);
  });

  it('does not offer the opposite gender or the wrong level at all', () => {
    const ranked = rankByName('Girls Varsity Soccer', teams);
    expect(ranked[0].candidate.id).toBe('t1');
    expect(ranked.map((m) => m.candidate.id)).not.toContain('t2'); // Boys
    expect(ranked.map((m) => m.candidate.id)).not.toContain('t3'); // JV
  });

  it('returns nothing rather than a confident wrong answer', () => {
    // An empty suggestion list is a better reconciliation screen than a plausible
    // but wrong pre-selected pair.
    expect(rankByName('Robotics Club', teams, { minScore: 0.45 })).toEqual([]);
  });

  it('respects the limit', () => {
    expect(rankByName('Varsity Soccer', teams, { minScore: 0, limit: 2 })).toHaveLength(2);
  });

  it('marks an exact normalised match even with different punctuation and case', () => {
    const [best] = rankByName('varsity  soccer   girls!', teams);
    expect(best.candidate.id).toBe('t1');
    expect(best.exact).toBe(true);
  });
});
