export interface IcsEvent {
  readonly uid: string;
  readonly summary: string;
  readonly start: string;
  readonly end: string;
  readonly location?: string;
  readonly description?: string;
  readonly timezone?: string;
}

const TZID = /^(?:UTC|[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)+)$/;
const encoder = new TextEncoder();

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}
function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${String(value)}`);
}
function icsEscape(value: string): string {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

/** RFC 5545 content-line folding measured in UTF-8 octets, not JS characters. */
function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const lines: string[] = [];
  let current = '';
  let limit = 75;
  for (const char of line) {
    const candidate = current + char;
    if (encoder.encode(candidate).length > limit) {
      if (!current) throw new Error('Unable to fold ICS content line');
      lines.push(current);
      current = char;
      limit = 74;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.map((part, index) => index === 0 ? part : ` ${part}`).join('\r\n');
}

function pad2(value: number): string { return String(value).padStart(2, '0'); }
function localDatePart(isoDate: string): string {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/);
  if (!match) throw new Error(`Invalid ISO date format: ${isoDate}`);
  return `${match[1]}${match[2]}${match[3]}T${match[4]}${match[5]}${match[6]}`;
}
function formatIcsDate(isoDate: string, timezone?: string): string {
  validateInstant(isoDate);
  if (timezone) return localDatePart(isoDate);
  const date = new Date(isoDate);
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`;
}
function validateTimezone(timezone: string | undefined): string | undefined {
  if (timezone === undefined) return undefined;
  const normalized = required(timezone, 'timezone');
  if (!TZID.test(normalized)) throw new Error(`Invalid timezone identifier: ${normalized}`);
  try { new Intl.DateTimeFormat('en', { timeZone: normalized }); } catch { throw new Error(`Invalid timezone identifier: ${normalized}`); }
  return normalized;
}

export function serializeIcs(event: IcsEvent): string {
  const uid = required(event.uid, 'uid');
  const summary = required(event.summary, 'summary');
  const start = required(event.start, 'start');
  const end = required(event.end, 'end');
  validateInstant(start); validateInstant(end);
  if (Date.parse(end) <= Date.parse(start)) throw new Error('end must be after start');
  const timezone = validateTimezone(event.timezone);

  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Eutaktos//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    foldLine(`UID:${icsEscape(uid)}`),
    foldLine(`SUMMARY:${icsEscape(summary)}`),
    timezone
      ? foldLine(`DTSTART;TZID=${timezone}:${formatIcsDate(start, timezone)}`)
      : foldLine(`DTSTART:${formatIcsDate(start)}`),
    timezone
      ? foldLine(`DTEND;TZID=${timezone}:${formatIcsDate(end, timezone)}`)
      : foldLine(`DTEND:${formatIcsDate(end)}`),
  ];
  if (event.location) lines.push(foldLine(`LOCATION:${icsEscape(event.location)}`));
  if (event.description) lines.push(foldLine(`DESCRIPTION:${icsEscape(event.description)}`));
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
