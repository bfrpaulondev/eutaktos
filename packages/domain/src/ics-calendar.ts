// ── Types ──────────────────────────────────────────────────────────────────

export interface IcsEvent {
  readonly uid: string;
  readonly summary: string;
  readonly start: string;  // ISO 8601
  readonly end: string;    // ISO 8601
  readonly location?: string;
  readonly description?: string;
  readonly timezone?: string; // IANA e.g. 'America/Sao_Paulo'
}

// ── Internal helpers ───────────────────────────────────────────────────────

function required(value: string, field: string): string {
  const n = value.trim();
  if (!n) throw new Error(`${field} is required`);
  return n;
}

/**
 * ICS text escaping per RFC 5545 §3.3.11.
 * ESCAPED-CHAR = ("\\\\" / ";" / "," / "N" / "n")
 * \; → \;
 * \, → \,
 * \\ → \\\\
 * newline → \n
 */
function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * RFC 5545 §3.1: content lines MUST NOT exceed 75 octets.
 * Long lines are folded by inserting CRLF followed by a single space/tab.
 */
function foldLine(line: string): string {
  const MAX = 75;
  if (line.length <= MAX) return line;

  const parts: string[] = [];
  let pos = 0;
  // First line: MAX octets
  parts.push(line.slice(0, MAX));
  pos = MAX;
  // Continuation lines: CRLF + SPACE + up to 74 octets
  while (pos < line.length) {
    const chunk = line.slice(pos, pos + 74);
    parts.push(`\r\n ${chunk}`);
    pos += 74;
  }
  return parts.join('');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatIcsDate(isoDate: string, timezone?: string): string {
  if (!Number.isFinite(Date.parse(isoDate))) throw new Error(`Invalid ISO date: ${isoDate}`);

  // Parse the ISO string components directly to avoid server timezone influence
  const match = isoDate.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  if (!match) throw new Error(`Invalid ISO date format: ${isoDate}`);

  // Remove timezone suffix, keep only the date/time part
  const clean = isoDate.replace(/[Z+-][^T]*$/, '');
  const parts = clean.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!parts) throw new Error(`Cannot parse date: ${isoDate}`);

  const local = `${parts[1]}${parts[2]}${parts[3]}T${parts[4]}${parts[5]}${parts[6]}`;

  if (timezone) {
    return local;
  }

  // For UTC, convert the ISO date to UTC using Date to handle offsets
  const d = new Date(isoDate);
  return `${pad2(d.getUTCFullYear())}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

// ── Serializer ─────────────────────────────────────────────────────────────

/**
 * Serializes an IcsEvent into an ICS/RFC 5545 compliant string.
 * Output is deterministic: same input → same output.
 *
 * This does NOT integrate with any calendar provider API.
 * It produces the ICS text that can be saved as .ics or sent as attachment.
 */
export function serializeIcs(event: IcsEvent): string {
  required(event.uid, 'uid');
  required(event.summary, 'summary');
  required(event.start, 'start');
  required(event.end, 'end');

  const lines: string[] = [];

  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//Eutaktos//EN');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');

  lines.push('BEGIN:VEVENT');

  lines.push(foldLine(`UID:${icsEscape(event.uid)}`));
  lines.push(foldLine(`SUMMARY:${icsEscape(event.summary)}`));

  if (event.timezone) {
    lines.push(foldLine(`DTSTART;TZID=${event.timezone}:${formatIcsDate(event.start, event.timezone)}`));
    lines.push(foldLine(`DTEND;TZID=${event.timezone}:${formatIcsDate(event.end, event.timezone)}`));
  } else {
    lines.push(foldLine(`DTSTART:${formatIcsDate(event.start)}`));
    lines.push(foldLine(`DTEND:${formatIcsDate(event.end)}`));
  }

  if (event.location) {
    lines.push(foldLine(`LOCATION:${icsEscape(event.location)}`));
  }

  if (event.description) {
    lines.push(foldLine(`DESCRIPTION:${icsEscape(event.description)}`));
  }

  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.join('\r\n') + '\r\n';
}
