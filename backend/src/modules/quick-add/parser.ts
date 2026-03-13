// backend/src/modules/quick-add/parser.ts

interface FacilityRef {
  id: string;
  name: string;
}

interface TeamRef {
  id: string;
  name: string;
  sport: string;
  seasonId?: string;
}

interface ParseContext {
  facilities: FacilityRef[];
  teams: TeamRef[];
  weekStartDate: string; // ISO date string (Monday of the target week)
}

export interface ParsedQuickAdd {
  eventType: 'GAME' | 'PRACTICE';
  dayOfWeek: string | null;
  startTime: string | null;  // HH:mm
  endTime: string | null;    // HH:mm
  datetime: string | null;   // Full ISO datetime
  durationMinutes: number | null;
  facilityId: string | null;
  facilityName: string | null;
  facilityMatches: FacilityRef[];
  teamId: string | null;
  teamName: string | null;
  teamMatches: TeamRef[];
  seasonId: string | null;
  opponent: string | null;
  confidence: number;
  missingFields: string[];
}

const DAY_MAP: Record<string, number> = {
  mon: 0, monday: 0,
  tue: 1, tues: 1, tuesday: 1,
  wed: 2, wednesday: 2,
  thu: 3, thur: 3, thurs: 3, thursday: 3,
  fri: 4, friday: 4,
  sat: 5, saturday: 5,
  sun: 6, sunday: 6,
};

/**
 * Levenshtein distance between two strings
 */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Fuzzy match a query string against a list of named items.
 * Returns substring matches first, then Levenshtein distance <= 3.
 */
function fuzzyMatch<T extends { name: string }>(query: string, items: T[]): T[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  // Exact substring matches first
  const substringMatches = items.filter(item =>
    item.name.toLowerCase().includes(q)
  );
  if (substringMatches.length > 0) return substringMatches;

  // Levenshtein distance <= 3
  return items.filter(item => {
    const name = item.name.toLowerCase();
    // Check each word in the name
    const words = name.split(/\s+/);
    return words.some(word => levenshtein(q, word) <= 3);
  });
}

/**
 * Extract day of week from text.
 * Returns [dayName, offsetFromMonday] or null.
 */
function extractDay(text: string): { day: string; offset: number } | null {
  const lower = text.toLowerCase();
  for (const [key, offset] of Object.entries(DAY_MAP)) {
    // Match whole word boundaries
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(lower)) {
      return { day: key.charAt(0).toUpperCase() + key.slice(1, 3), offset };
    }
  }
  return null;
}

/**
 * Extract time range from text.
 * Supports formats: "3:30-5pm", "3:30pm-5:00pm", "15:30-17:00", "3pm", "3:30pm"
 */
function extractTimeRange(text: string): { startTime: string; endTime: string | null } | null {
  // Pattern: HH:MM(am/pm)?-HH:MM(am/pm)?
  const rangeRegex = /(\d{1,2}):?(\d{2})?\s*(am|pm)?\s*[-–to]+\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i;
  const match = text.match(rangeRegex);

  if (match) {
    let [, startH, startM, startAmPm, endH, endM, endAmPm] = match;
    let sh = parseInt(startH);
    const sm = parseInt(startM || '0');
    let eh = parseInt(endH);
    const em = parseInt(endM || '0');

    // Infer am/pm from context
    const effectiveEndAmPm = (endAmPm || startAmPm || '').toLowerCase();
    const effectiveStartAmPm = (startAmPm || endAmPm || '').toLowerCase();

    if (effectiveEndAmPm === 'pm' && eh < 12) eh += 12;
    if (effectiveEndAmPm === 'am' && eh === 12) eh = 0;
    if (effectiveStartAmPm === 'pm' && sh < 12) sh += 12;
    if (effectiveStartAmPm === 'am' && sh === 12) sh = 0;

    // If no am/pm at all, assume PM for typical school sports hours
    if (!startAmPm && !endAmPm) {
      if (sh < 12 && sh >= 1 && sh <= 6) sh += 12;
      if (eh < 12 && eh >= 1 && eh <= 6) eh += 12;
    }

    const startTime = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
    const endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
    return { startTime, endTime };
  }

  // Single time: "3:30pm" or "3pm"
  const singleRegex = /(\d{1,2}):?(\d{2})?\s*(am|pm)/i;
  const singleMatch = text.match(singleRegex);

  if (singleMatch) {
    let [, h, m, ampm] = singleMatch;
    let hour = parseInt(h);
    const min = parseInt(m || '0');

    if (ampm.toLowerCase() === 'pm' && hour < 12) hour += 12;
    if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;

    const startTime = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    return { startTime, endTime: null };
  }

  return null;
}

/**
 * Extract opponent from "vs <opponent>" pattern.
 */
function extractOpponent(text: string): string | null {
  const match = text.match(/\bvs\.?\s+([A-Za-z][A-Za-z\s.''-]+)/i);
  if (match) {
    return match[1].trim();
  }
  return null;
}

/**
 * Extract potential facility or team name tokens from text
 * (after removing recognized patterns like day, time, vs).
 */
function extractNameTokens(text: string): string[] {
  let cleaned = text;

  // Remove time patterns
  cleaned = cleaned.replace(/\d{1,2}:?\d{0,2}\s*(am|pm)?\s*[-–to]+\s*\d{1,2}:?\d{0,2}\s*(am|pm)?/gi, '');
  cleaned = cleaned.replace(/\d{1,2}:?\d{2}\s*(am|pm)/gi, '');
  cleaned = cleaned.replace(/\d{1,2}\s*(am|pm)/gi, '');

  // Remove day names
  for (const key of Object.keys(DAY_MAP)) {
    cleaned = cleaned.replace(new RegExp(`\\b${key}\\b`, 'gi'), '');
  }

  // Remove "vs opponent"
  cleaned = cleaned.replace(/\bvs\.?\s+[A-Za-z][A-Za-z\s.''-]*/gi, '');

  // Remove common filler words
  cleaned = cleaned.replace(/\b(at|on|in|the|for|practice|game)\b/gi, '');

  // Split remaining by common delimiters
  const tokens = cleaned.split(/[,@|]+/).map(t => t.trim()).filter(t => t.length >= 2);
  return tokens;
}

export function parseQuickAdd(text: string, context: ParseContext): ParsedQuickAdd {
  const result: ParsedQuickAdd = {
    eventType: 'PRACTICE',
    dayOfWeek: null,
    startTime: null,
    endTime: null,
    datetime: null,
    durationMinutes: null,
    facilityId: null,
    facilityName: null,
    facilityMatches: [],
    teamId: null,
    teamName: null,
    teamMatches: [],
    seasonId: null,
    opponent: null,
    confidence: 0,
    missingFields: [],
  };

  // 1. Determine event type
  const opponent = extractOpponent(text);
  if (opponent) {
    result.eventType = 'GAME';
    result.opponent = opponent;
  }

  // 2. Extract day
  const dayResult = extractDay(text);
  if (dayResult) {
    result.dayOfWeek = dayResult.day;

    // Calculate the actual date from weekStartDate + offset
    const weekStart = new Date(context.weekStartDate);
    const eventDate = new Date(weekStart);
    eventDate.setDate(eventDate.getDate() + dayResult.offset);

    // 3. Extract time
    const timeResult = extractTimeRange(text);
    if (timeResult) {
      result.startTime = timeResult.startTime;
      result.endTime = timeResult.endTime;

      const [h, m] = timeResult.startTime.split(':').map(Number);
      eventDate.setHours(h, m, 0, 0);
      result.datetime = eventDate.toISOString();

      if (timeResult.endTime) {
        const [eh, em] = timeResult.endTime.split(':').map(Number);
        const endMs = eh * 60 + em;
        const startMs = h * 60 + m;
        if (endMs > startMs) {
          result.durationMinutes = endMs - startMs;
        }
      }
    } else {
      // Day without time — set a default
      eventDate.setHours(15, 30, 0, 0); // Default 3:30 PM
      result.datetime = eventDate.toISOString();
    }
  }

  // 4. Fuzzy match facility and team from remaining tokens
  const tokens = extractNameTokens(text);

  for (const token of tokens) {
    // Try facility match
    if (!result.facilityId) {
      const facilityMatches = fuzzyMatch(token, context.facilities);
      if (facilityMatches.length === 1) {
        result.facilityId = facilityMatches[0].id;
        result.facilityName = facilityMatches[0].name;
      } else if (facilityMatches.length > 1) {
        result.facilityMatches = facilityMatches;
      }
    }

    // Try team match
    if (!result.teamId) {
      const teamMatches = fuzzyMatch(token, context.teams);
      if (teamMatches.length === 1) {
        result.teamId = teamMatches[0].id;
        result.teamName = teamMatches[0].name;
        result.seasonId = teamMatches[0].seasonId ?? null;
      } else if (teamMatches.length > 1) {
        result.teamMatches = teamMatches;
      }
    }
  }

  // 5. Calculate confidence
  let resolved = 0;
  const total = result.eventType === 'GAME' ? 5 : 4; // game needs opponent too

  if (result.dayOfWeek) resolved++;
  if (result.startTime) resolved++;
  if (result.facilityId) resolved++;
  if (result.teamId) resolved++;
  if (result.eventType === 'GAME' && result.opponent) resolved++;

  result.confidence = total > 0 ? Math.round((resolved / total) * 100) / 100 : 0;

  // 6. Missing fields
  if (!result.dayOfWeek) result.missingFields.push('day');
  if (!result.startTime) result.missingFields.push('time');
  if (!result.teamId) result.missingFields.push('team');
  if (!result.facilityId) result.missingFields.push('facility');
  if (result.eventType === 'GAME' && !result.opponent) result.missingFields.push('opponent');

  return result;
}
