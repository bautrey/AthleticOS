// backend/src/common/text-match.ts
//
// Name similarity for proposing matches between AthleticOS records and records in
// an external system. These scores only ever PROPOSE a pair for a human to confirm.
// The confirmed link is an id in external_mappings, never a name.

/** Classic Levenshtein edit distance. */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: a.length + 1 }, (_, i) => i);
  const curr = new Array<number>(a.length + 1);

  for (let i = 1; i <= b.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= a.length; j++) {
      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr.slice();
  }
  return prev[a.length];
}

/**
 * Lowercase, drop punctuation, collapse whitespace.
 *
 * Keeps digits, because "JV 2" and "JV 3" are different teams.
 */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s: string): string[] {
  const n = normalizeName(s);
  return n ? n.split(' ') : [];
}

/**
 * Similarity in [0, 1], combining word-set overlap with character-level distance.
 *
 * Word order is the reason this is not plain Levenshtein. Schools write the same
 * team as "Varsity Soccer (Girls)" in one system and "Girls Varsity Soccer" in
 * another, and edit distance rates that pair WORSE than "Varsity Soccer (Girls)"
 * against "Varsity Soccer (Boys)" - which would confidently propose handing the
 * boys' schedule to the girls' team. Comparing word sets makes reordering free
 * while keeping a one-word difference expensive.
 *
 * The character score still contributes, so "Vrsity Soccer" and "Varsity Soccer"
 * stay close despite a typo splitting a token.
 */
/**
 * Word groups where naming the wrong one is not a near miss but a different team.
 *
 * Similarity alone puts "Varsity Soccer (Girls)" and "Varsity Soccer (Boys)" close
 * together, because they are close as text. The consequence of confusing them is
 * syncing one squad's schedule onto another, so when both names state a value from
 * the same group and the values disagree, that settles it regardless of how alike
 * the rest reads.
 */
const DISCRIMINATORS: string[][] = [
  ['girls', 'girl', 'womens', 'women', 'female'],
  ['boys', 'boy', 'mens', 'men', 'male'],
  ['varsity'],
  ['jv', 'junior'],
  ['freshman', 'freshmen'],
  ['middle', 'ms'],
  ['lower'],
  ['upper', 'us'],
];

/** Index of the group a token belongs to, or -1. */
function discriminatorGroup(token: string): number {
  return DISCRIMINATORS.findIndex((group) => group.includes(token));
}

/**
 * True when both names state a discriminator and they disagree.
 *
 * Gender and level are checked as separate axes: "Girls Varsity" against
 * "Girls JV" conflicts on level, "Girls Varsity" against "Boys Varsity" on gender,
 * and "Girls Varsity" against "Girls Soccer" conflicts on neither, because the
 * second simply does not say.
 */
export function hasConflictingDiscriminator(a: string, b: string): boolean {
  const GENDER = new Set([0, 1]);
  const groupsOf = (s: string) => {
    const found = new Set<number>();
    for (const t of tokens(s)) {
      const g = discriminatorGroup(t);
      if (g !== -1) found.add(g);
    }
    return found;
  };

  const ga = groupsOf(a);
  const gb = groupsOf(b);

  const genderA = [...ga].filter((g) => GENDER.has(g));
  const genderB = [...gb].filter((g) => GENDER.has(g));
  if (genderA.length && genderB.length && genderA[0] !== genderB[0]) return true;

  const levelA = [...ga].filter((g) => !GENDER.has(g));
  const levelB = [...gb].filter((g) => !GENDER.has(g));
  if (levelA.length && levelB.length && !levelA.some((g) => levelB.includes(g))) return true;

  return false;
}

export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  // A stated disagreement on gender or level is disqualifying, however alike the
  // rest of the name reads.
  if (hasConflictingDiscriminator(a, b)) return 0;

  const ta = tokens(a);
  const tb = tokens(b);

  // Pair each word with its closest counterpart rather than requiring an exact
  // hit, so "Varsty" still finds "Varsity". Pairs below the floor score zero
  // instead of contributing partial credit: "girls" and "boys" are 0.2 similar as
  // strings and must count for nothing, or a gender swap starts looking like a
  // match.
  const FLOOR = 0.7;
  const bestFor = (token: string, pool: string[]) => {
    let best = 0;
    for (const other of pool) {
      const maxLen = Math.max(token.length, other.length);
      const sim = maxLen === 0 ? 0 : 1 - levenshteinDistance(token, other) / maxLen;
      if (sim > best) best = sim;
    }
    return best >= FLOOR ? best : 0;
  };

  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  // Both directions, so an extra word on either side costs something.
  const tokenScore = (avg(ta.map((t) => bestFor(t, tb))) + avg(tb.map((t) => bestFor(t, ta)))) / 2;

  const maxLen = Math.max(na.length, nb.length);
  const charScore = maxLen === 0 ? 0 : 1 - levenshteinDistance(na, nb) / maxLen;

  // Word matching carries the decision; character distance only breaks ties.
  // Weighted this way, reordering is nearly free and a changed word is expensive.
  return 0.7 * tokenScore + 0.3 * Math.max(0, charScore);
}

export interface NameCandidate {
  id: string;
  name: string;
}

export interface NameMatch<T extends NameCandidate = NameCandidate> {
  candidate: T;
  score: number;
  /** An exact match after normalisation, which a UI can pre-confirm. */
  exact: boolean;
}

/**
 * Rank candidates against one name, best first.
 *
 * `minScore` filters out noise; a low bar here produces a reconciliation screen
 * full of confident nonsense, which is worse than an empty suggestion.
 */
export function rankByName<T extends NameCandidate>(
  query: string,
  candidates: T[],
  options: { minScore?: number; limit?: number } = {}
): NameMatch<T>[] {
  const { minScore = 0.45, limit = 5 } = options;
  const nq = normalizeName(query);

  return candidates
    .map((candidate) => ({
      candidate,
      score: nameSimilarity(query, candidate.name),
      exact: normalizeName(candidate.name) === nq && nq.length > 0,
    }))
    .filter((m) => m.exact || m.score >= minScore)
    .sort((a, b) => (Number(b.exact) - Number(a.exact)) || b.score - a.score)
    .slice(0, limit);
}
