// backend/src/modules/import/schooldude-parse.ts
//
// Parses a SchoolDude "Events for ..." athletic-calendar report after it has
// been run through `pdftotext -layout`. The PDF renders a fixed-width table,
// four columns wide, where a single logical record can spill across several
// physical lines: the Event text wraps on its own line, the Room text wraps
// onto a following line, and (only when the Location text is long enough to
// bleed into the next column) the Day-Time Phone number gets pushed off of
// its row entirely and lands alone on the line below.
//
// Nothing here is guessed. A record whose shape doesn't match one of the
// wraps we've actually observed in the source is returned in `skipped`
// rather than parsed with a best-effort field.

export interface SchoolDudeEvent {
  scheduleId: string; // e.g. "182792" - stable external id, kept as a string
  date: string; // ISO "2026-09-01"
  startTime: string | null; // "14:30" 24h
  endTime: string | null;
  setupStart: string | null;
  setupEnd: string | null;
  area: string | null; // "Gym", "Stadium"
  location: string | null; // "Athletic Training Center"
  building: string | null; // "Athletic Training Cntr"
  room: string | null; // "ATC RM 106 Gym"
  status: string | null; // "Approved"
  organization: string | null;
  event: string; // "MS VB Practice - ATC"
  contact: string | null;
  phone: string | null;
  sourceLines: number; // how many lines the record consumed, for debugging
}

export interface SkippedRecord {
  line: number;
  text: string;
  reason: string;
}

export interface ParseResult {
  events: SchoolDudeEvent[];
  skipped: SkippedRecord[];
}

// 0-indexed, half-open column ranges. Verified against the report's own
// "Count of Events" total (870) matching the number of records this produces.
const COL = {
  date: [0, 16] as const, // Date / Schedule ID / Zone
  area: [16, 48] as const, // Area / Location / Building
  statusOrgRoom: [48, 77] as const, // Status / Organization / Room (+ wrap)
  event: [77, 97] as const, // Event, part 1 on line A, part 2 on line B
  contact: [97, 119] as const, // Contact / Day-Time Phone
  time: [119, 141] as const, // Start Time / End Time
  setup: [141, 152] as const, // Setup Begin Time / Setup End Time
};

function col(line: string, [start, end]: readonly [number, number]): string {
  return line.slice(start, end);
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** A real record's Date column holds nothing but the date - a page-footer
 * timestamp ("9/22/2026 11:25:45 AM ... Page 1 of 80") fails this because
 * the time text spills into the same 16-char slice right behind the date. */
function isRecordStart(line: string): boolean {
  return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(col(line, COL.date).trim());
}

/** Page furniture repeats on every page of the report and must never be
 * mistaken for record content: the title, the two report-parameter lines,
 * the three-line column header, the per-page timestamp/footer, and the
 * one-time "Count of Events" total at the very end of the file. */
function isPageNoise(line: string): boolean {
  const text = line.trim();
  if (text === '') return true;
  if (/Page\s+\d+\s+of\s+\d+/.test(text)) return true;
  if (text === 'Trinity Christian Academy') return true;
  if (text === 'Calendar Month') return true;
  if (text.startsWith('Events for ')) return true;
  if (/^Date\s+Area\s+Status\s+Event/.test(text)) return true;
  if (/^Schedule ID\s+Location/.test(text)) return true;
  if (/^Zone\s+Building\s+Room/.test(text)) return true;
  if (text.includes('Count of Events')) return true;
  return false;
}

/** "9/1/2026" -> "2026-09-01". Callers only ever pass what isRecordStart already validated. */
function toIsoDate(mdy: string): string {
  const [month, day, year] = mdy.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/** "2:30PM" -> "14:30", "6:00AM" -> "06:00". Returns null for blank input and
 * undefined if the text doesn't match the format this report always uses -
 * the caller treats undefined as a reason to skip the record rather than
 * invent a time. */
function parseTime(raw: string): string | null | undefined {
  const text = raw.trim();
  if (text === '') return null;
  const match = /^(\d{1,2}):(\d{2})(AM|PM)$/i.exec(text);
  if (!match) return undefined;
  let hour = Number(match[1]);
  const minute = match[2];
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

/** Room's raw text is always "<building>|<room>" once its wrapped lines are
 * joined - strip everything up to and including that pipe. */
function stripBuildingPrefix(roomRaw: string): string {
  const pipeIndex = roomRaw.indexOf('|');
  return pipeIndex === -1 ? collapse(roomRaw) : collapse(roomRaw.slice(pipeIndex + 1));
}

/**
 * Read the Organization value off the record's second line, or null when the
 * layout makes it unrecoverable.
 *
 * On 190 of 870 records a long Location - "Multi Complex Building (MCB)" is the
 * only one that does it - runs past its column and swallows the first characters
 * of Organization, so the plain slice yields "letics" instead of "Athletics".
 *
 * There is no way to recover the real value from the rendered line. Once Location
 * overflows, it and Organization are separated by a single space rather than the
 * wide gap that delimits every other column, so nothing in the text marks where one
 * ends and the next begins. Re-splitting on whitespace picks up the Event column
 * instead and yields confident nonsense - "Games - MCB", "Showoff", a phone number.
 *
 * So this returns null for those records. A field that says "I do not know" is
 * usable; one that says "letics" invites someone to strip a prefix, and one that
 * says "Rally" will be believed.
 */
function readOrganization(rawLineB: string): string | null {
  // Overflow shows up as the LAST position of the Location column being occupied.
  // Checking the first position of the next column instead matches every record,
  // because that is simply where Organization legitimately begins.
  // Measured on the fixture: char 47 is occupied on exactly the 190 affected rows,
  // char 48 on all 870.
  const locationOverflowed = /\S/.test(rawLineB.charAt(COL.area[1] - 1));
  if (locationOverflowed) return null;
  return col(rawLineB, COL.statusOrgRoom).trim() || null;
}

export function parseSchoolDudeCalendar(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const events: SchoolDudeEvent[] = [];
  const skipped: SkippedRecord[] = [];

  const startIndexes: number[] = [];
  lines.forEach((line, index) => {
    if (isRecordStart(line)) startIndexes.push(index);
  });

  for (let i = 0; i < startIndexes.length; i++) {
    const from = startIndexes[i];
    const to = i + 1 < startIndexes.length ? startIndexes[i + 1] : lines.length;

    const content = lines
      .slice(from, to)
      .map((raw, offset) => ({ line: from + offset + 1, raw }))
      .filter((entry) => !isPageNoise(entry.raw));

    if (content.length < 2) {
      skipped.push({
        line: from + 1,
        text: lines[from],
        reason: 'record has no second line - expected the schedule id row after the date row',
      });
      continue;
    }

    const [lineA, lineB] = content;
    const scheduleId = col(lineB.raw, COL.date).trim();
    if (!/^\d+$/.test(scheduleId)) {
      skipped.push({
        line: lineB.line,
        text: lineB.raw,
        reason: `expected a numeric schedule id on the second line, got "${scheduleId}"`,
      });
      continue;
    }

    // Event and phone can each wrap onto their own line; Building/Room wrap
    // together onto one or more lines. Anything that doesn't fit one of
    // those three shapes means we don't understand this record's layout.
    const eventParts = [col(lineA.raw, COL.event), col(lineB.raw, COL.event)];
    const phoneParts = [col(lineB.raw, COL.contact)];
    const buildingParts: string[] = [];
    const roomParts: string[] = [];
    let anomaly: SkippedRecord | null = null;

    for (const entry of content.slice(2)) {
      const areaText = col(entry.raw, COL.area);
      const statusText = col(entry.raw, COL.statusOrgRoom);
      const eventText = col(entry.raw, COL.event);
      const contactText = col(entry.raw, COL.contact);
      const leftover = col(entry.raw, COL.date) + col(entry.raw, COL.time) + col(entry.raw, COL.setup);

      const hasArea = areaText.trim() !== '';
      const hasStatus = statusText.trim() !== '';
      const hasEvent = eventText.trim() !== '';
      const hasContact = contactText.trim() !== '';

      if (leftover.trim() !== '') {
        anomaly = {
          line: entry.line,
          text: entry.raw,
          reason: 'continuation line has content outside the area/room/event/phone columns',
        };
        break;
      }

      if (hasEvent && !hasArea && !hasStatus && !hasContact) {
        eventParts.push(eventText);
      } else if (hasContact && !hasArea && !hasStatus && !hasEvent) {
        phoneParts.push(contactText);
      } else if (hasArea || hasStatus) {
        if (hasEvent || hasContact) {
          anomaly = {
            line: entry.line,
            text: entry.raw,
            reason: 'continuation line mixes building/room content with event or phone content',
          };
          break;
        }
        buildingParts.push(areaText);
        roomParts.push(statusText);
      }
      // A continuation line with nothing in any of these columns is a no-op.
    }

    if (anomaly) {
      skipped.push(anomaly);
      continue;
    }

    const startTime = parseTime(col(lineA.raw, COL.time));
    const endTime = parseTime(col(lineB.raw, COL.time));
    const setupStart = parseTime(col(lineA.raw, COL.setup));
    const setupEnd = parseTime(col(lineB.raw, COL.setup));
    if (startTime === undefined || endTime === undefined || setupStart === undefined || setupEnd === undefined) {
      skipped.push({
        line: lineA.line,
        text: lineA.raw,
        reason: 'a time field did not match the "H:MMAM/PM" format this report uses',
      });
      continue;
    }

    const roomRaw = roomParts.length > 0 ? collapse(roomParts.join(' ')) : '';

    events.push({
      scheduleId,
      date: toIsoDate(col(lineA.raw, COL.date).trim()),
      startTime,
      endTime,
      setupStart,
      setupEnd,
      area: col(lineA.raw, COL.area).trim() || null,
      location: col(lineB.raw, COL.area).trim() || null,
      building: buildingParts.length > 0 ? collapse(buildingParts.join(' ')) : null,
      room: roomRaw ? stripBuildingPrefix(roomRaw) : null,
      status: col(lineA.raw, COL.statusOrgRoom).trim() || null,
      organization: readOrganization(lineB.raw),
      event: collapse(eventParts.join(' ')),
      contact: col(lineA.raw, COL.contact).trim() || null,
      phone: collapse(phoneParts.join(' ')) || null,
      sourceLines: content.length,
    });
  }

  return { events, skipped };
}
