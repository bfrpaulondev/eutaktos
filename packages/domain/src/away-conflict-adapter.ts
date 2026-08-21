/**
 * K29 — Away Period Conflict Adapter
 *
 * Pure function layer bridging availability/away-period data with the
 * conflict engine (K28). No side effects, no I/O, no random, no DOM.
 * Same inputs → same outputs always.
 */

// ─── Local Types ─────────────────────────────────────────────────────────────

/** Matches the existing AvailabilityPeriod shape from people.ts */
export interface AwayPeriod {
  readonly personId: string;
  readonly tenantId: string;
  readonly startsAt: string; // ISO 8601 instant
  readonly endsAt: string; // ISO 8601 instant
}

export interface MeetingTimeWindow {
  readonly meetingDate: string; // YYYY-MM-DD
  readonly startTime: string; // HH:mm
  readonly endTime: string; // HH:mm
  readonly timezone: string; // IANA timezone
}

export interface UnavailablePerson {
  readonly personId: string;
  readonly reason: 'away-period' | 'unavailability';
  readonly startsAt: string;
  readonly endsAt: string;
}

/** Output format expected by K28's conflict engine (UnavailablePeriod) */
export interface ConflictEngineUnavailablePeriod {
  readonly personId: string;
  readonly startsAt: string;
  readonly endsAt: string;
}

/** Validation result */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/** Parse an ISO 8601 string to a timestamp number. Returns NaN on failure. */
function parseInstant(value: unknown): number {
  if (typeof value !== 'string' || value.length === 0) return NaN;
  return Date.parse(value);
}

/** Parse "HH:mm" to minutes since midnight. Returns NaN on invalid input. */
function parseHhMm(time: unknown): number {
  if (typeof time !== 'string' || time.length === 0) return NaN;
  const parts = time.split(':');
  if (parts.length < 1 || parts.length > 2) return NaN;
  const h = Number(parts[0]!);
  const m = parts.length === 2 ? Number(parts[1]!) : 0;
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  if (h < 0 || h > 23 || m < 0 || m > 59) return NaN;
  return h * 60 + m;
}

/**
 * Check if a given IANA timezone string is supported by the runtime.
 * Uses Intl support as a proxy (available in all modern JS runtimes).
 */
function isValidTimezone(tz: unknown): boolean {
  if (typeof tz !== 'string' || tz.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract local date/time components from a UTC instant using Intl.
 */
function formatInTz(
  ms: number,
  formatter: Intl.DateTimeFormat,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = formatter.formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '0';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
  };
}

/** Check if formatted local time matches desired components. */
function matchesLocal(
  fmt: ReturnType<typeof formatInTz>,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): boolean {
  return (
    fmt.year === year && fmt.month === month && fmt.day === day && fmt.hour === hour && fmt.minute === minute
  );
}

/**
 * Convert a local datetime in a given IANA timezone to a UTC instant.
 *
 * Uses the Intl API to compute offsets. Handles DST transitions:
 * - Ambiguous times (fall-back): picks the FIRST (earlier/summer) occurrence.
 * - Non-existent times (spring-forward): shifts forward to the next valid time.
 *
 * Algorithm:
 * 1. Get offset from a reference point (noon UTC on the previous day).
 *    This avoids landing on a DST transition boundary.
 * 2. Compute candidate UTC = desiredLocal - offset.
 * 3. Verify by formatting back. If mismatch, try ±1h offsets.
 * 4. For ambiguous times, check if (candidate - 1h) also maps to the same
 *    local time; if so, return the earlier one (summer occurrence).
 */
function localToUtc(dateStr: string, hhMm: string, timezone: string): string | null {
  const mins = parseHhMm(hhMm);
  if (!Number.isFinite(mins)) return null;

  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  if (!yearStr || !monthStr || !dayStr) return null;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  const hour = Math.floor(mins / 60);
  const minute = mins % 60;

  // Validate the date is real
  const checkDate = new Date(Date.UTC(year, month - 1, day));
  if (checkDate.getUTCFullYear() !== year || checkDate.getUTCMonth() !== month - 1 || checkDate.getUTCDate() !== day) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const desiredLocalMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const oneHour = 60 * 60 * 1000;

  // Step 1: Get offset from a reference point — noon UTC on the day before.
  // This is guaranteed to be far from any DST transition on the target day.
  const refMs = Date.UTC(year, month - 1, day - 1, 12, 0, 0);
  const refFmt = formatInTz(refMs, formatter);
  const refLocalMs = Date.UTC(refFmt.year, refFmt.month - 1, refFmt.day, refFmt.hour, refFmt.minute, refFmt.second);
  const baseOffsetMs = refLocalMs - refMs;

  // Step 2: Try candidate UTC values with baseOffset, baseOffset+1h, baseOffset-1h
  const candidates = [
    desiredLocalMs - baseOffsetMs,
    desiredLocalMs - (baseOffsetMs + oneHour),
    desiredLocalMs - (baseOffsetMs - oneHour),
  ];

  let validMs: number | null = null;
  for (const c of candidates) {
    const fmt = formatInTz(c, formatter);
    if (matchesLocal(fmt, year, month, day, hour, minute)) {
      validMs = c;
      break;
    }
  }

  if (validMs === null) {
    // Time doesn't exist (spring-forward gap).
    // Return the shifted-forward time as best effort.
    return new Date(candidates[0]!).toISOString();
  }

  // Step 3: Check for ambiguity (fall-back DST).
  // If (validMs - 1h) also maps to the same local time, the time is ambiguous.
  // Pick the EARLIER occurrence (smaller UTC instant = summer/DST time).
  const earlierMs = validMs - oneHour;
  const earlierFmt = formatInTz(earlierMs, formatter);
  if (matchesLocal(earlierFmt, year, month, day, hour, minute)) {
    return new Date(earlierMs).toISOString();
  }

  return new Date(validMs).toISOString();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert a meeting date + time + timezone to UTC instant range.
 *
 * Returns `{ start, end }` as ISO 8601 strings, or `null` if inputs are invalid.
 *
 * NOTE: Both startTime and endTime are interpreted as being on `meetingDate`.
 * Meetings that span midnight require the caller to use two separate windows
 * or a different date for the end time.
 */
export function meetingWindowToInstantRange(
  window: unknown,
): { readonly start: string; readonly end: string } | null {
  if (!window || typeof window !== 'object') return null;
  const w = window as Record<string, unknown>;
  if (
    typeof w.meetingDate !== 'string' ||
    typeof w.startTime !== 'string' ||
    typeof w.endTime !== 'string' ||
    typeof w.timezone !== 'string'
  ) {
    return null;
  }

  if (!isValidTimezone(w.timezone)) return null;

  const startInstant = localToUtc(w.meetingDate, w.startTime, w.timezone);
  const endInstant = localToUtc(w.meetingDate, w.endTime, w.timezone);
  if (!startInstant || !endInstant) return null;

  return { start: startInstant, end: endInstant };
}

/**
 * Check if two away periods overlap.
 *
 * Uses half-open intervals [startsAt, endsAt). Two periods overlap if
 * a.startsAt < b.endsAt AND b.startsAt < a.endsAt.
 *
 * Returns `false` for invalid inputs.
 */
export function awayPeriodsOverlap(a: unknown, b: unknown): boolean {
  if (!a || typeof a !== 'object' || !b || typeof b !== 'object') return false;
  const pa = a as Record<string, unknown>;
  const pb = b as Record<string, unknown>;
  if (typeof pa.startsAt !== 'string' || typeof pa.endsAt !== 'string') return false;
  if (typeof pb.startsAt !== 'string' || typeof pb.endsAt !== 'string') return false;

  const aStart = parseInstant(pa.startsAt);
  const aEnd = parseInstant(pa.endsAt);
  const bStart = parseInstant(pb.startsAt);
  const bEnd = parseInstant(pb.endsAt);

  if (!Number.isFinite(aStart) || !Number.isFinite(aEnd)) return false;
  if (!Number.isFinite(bStart) || !Number.isFinite(bEnd)) return false;
  if (aEnd <= aStart || bEnd <= bStart) return false;

  return aStart < bEnd && bStart < aEnd;
}

/**
 * Filter away periods to only those belonging to a specific tenant.
 *
 * Tenant isolation: only periods where `period.tenantId === tenantId` are returned.
 */
export function filterAwayPeriodsForTenant(
  awayPeriods: readonly unknown[],
  tenantId: string,
): readonly AwayPeriod[] {
  if (typeof tenantId !== 'string' || tenantId.length === 0) return [];

  return Object.freeze(
    awayPeriods.filter((p): p is AwayPeriod => {
      if (!p || typeof p !== 'object') return false;
      const period = p as Record<string, unknown>;
      return (
        typeof period.personId === 'string' &&
        typeof period.tenantId === 'string' &&
        typeof period.startsAt === 'string' &&
        typeof period.endsAt === 'string' &&
        period.tenantId === tenantId
      );
    }),
  );
}

/**
 * Find all persons who are away during a meeting's time window.
 *
 * Returns an array of UnavailablePerson for every away period that overlaps
 * with the meeting window. Each person appears at most once.
 */
export function findUnavailablePersons(
  awayPeriods: readonly unknown[],
  window: unknown,
): readonly UnavailablePerson[] {
  const range = meetingWindowToInstantRange(window);
  if (!range) return [];

  const meetingStart = Date.parse(range.start);
  const meetingEnd = Date.parse(range.end);
  if (!Number.isFinite(meetingStart) || !Number.isFinite(meetingEnd)) return [];
  if (meetingEnd <= meetingStart) return [];

  const results: UnavailablePerson[] = [];
  const seen = new Set<string>();

  for (const p of awayPeriods) {
    if (!p || typeof p !== 'object') continue;
    const period = p as Record<string, unknown>;
    if (
      typeof period.personId !== 'string' ||
      typeof period.startsAt !== 'string' ||
      typeof period.endsAt !== 'string'
    ) {
      continue;
    }

    const awayStart = Date.parse(period.startsAt);
    const awayEnd = Date.parse(period.endsAt);
    if (!Number.isFinite(awayStart) || !Number.isFinite(awayEnd)) continue;
    if (awayEnd <= awayStart) continue;

    // Half-open interval overlap: [meetingStart, meetingEnd) ∩ [awayStart, awayEnd)
    if (meetingStart < awayEnd && meetingEnd > awayStart) {
      if (!seen.has(period.personId)) {
        seen.add(period.personId);
        results.push(
          Object.freeze({
            personId: period.personId,
            reason: 'away-period' as const,
            startsAt: period.startsAt,
            endsAt: period.endsAt,
          }),
        );
      }
    }
  }

  return Object.freeze(results);
}

/**
 * Check if a specific person is unavailable during a meeting's time window.
 */
export function isPersonUnavailable(
  awayPeriods: readonly unknown[],
  personId: string,
  window: unknown,
): boolean {
  if (typeof personId !== 'string' || personId.length === 0) return false;

  const range = meetingWindowToInstantRange(window);
  if (!range) return false;

  const meetingStart = Date.parse(range.start);
  const meetingEnd = Date.parse(range.end);
  if (!Number.isFinite(meetingStart) || !Number.isFinite(meetingEnd)) return false;
  if (meetingEnd <= meetingStart) return false;

  for (const p of awayPeriods) {
    if (!p || typeof p !== 'object') continue;
    const period = p as Record<string, unknown>;
    if (
      typeof period.personId !== 'string' ||
      typeof period.startsAt !== 'string' ||
      typeof period.endsAt !== 'string'
    ) {
      continue;
    }
    if (period.personId !== personId) continue;

    const awayStart = Date.parse(period.startsAt);
    const awayEnd = Date.parse(period.endsAt);
    if (!Number.isFinite(awayStart) || !Number.isFinite(awayEnd)) continue;
    if (awayEnd <= awayStart) continue;

    if (meetingStart < awayEnd && meetingEnd > awayStart) {
      return true;
    }
  }

  return false;
}

/**
 * Convert UnavailablePerson[] to the format expected by K28's conflict engine.
 *
 * The conflict engine expects `UnavailablePeriod` with `personId`, `startsAt`, `endsAt`.
 */
export function toConflictEngineFormat(
  unavailablePersons: readonly unknown[],
): readonly ConflictEngineUnavailablePeriod[] {
  const results: ConflictEngineUnavailablePeriod[] = [];

  for (const p of unavailablePersons) {
    if (!p || typeof p !== 'object') continue;
    const person = p as Record<string, unknown>;
    if (
      typeof person.personId !== 'string' ||
      typeof person.startsAt !== 'string' ||
      typeof person.endsAt !== 'string'
    ) {
      continue;
    }

    results.push(
      Object.freeze({
        personId: person.personId,
        startsAt: person.startsAt,
        endsAt: person.endsAt,
      }),
    );
  }

  return Object.freeze(results);
}

/**
 * Validate an away period.
 *
 * Checks:
 * - Required fields: personId, tenantId, startsAt, endsAt
 * - Non-empty strings
 * - Valid ISO 8601 dates for startsAt and endsAt
 * - endsAt > startsAt
 */
export function validateAwayPeriod(period: unknown): ValidationResult {
  const errors: string[] = [];

  if (!period || typeof period !== 'object') {
    return { valid: false, errors: Object.freeze(['Period must be a non-null object']) };
  }

  const p = period as Record<string, unknown>;

  if (typeof p.personId !== 'string' || p.personId.length === 0) {
    errors.push('personId is required and must be a non-empty string');
  }

  if (typeof p.tenantId !== 'string' || p.tenantId.length === 0) {
    errors.push('tenantId is required and must be a non-empty string');
  }

  if (typeof p.startsAt !== 'string' || p.startsAt.length === 0) {
    errors.push('startsAt is required and must be a non-empty string');
  } else if (!Number.isFinite(Date.parse(p.startsAt))) {
    errors.push('startsAt must be a valid ISO 8601 instant');
  }

  if (typeof p.endsAt !== 'string' || p.endsAt.length === 0) {
    errors.push('endsAt is required and must be a non-empty string');
  } else if (!Number.isFinite(Date.parse(p.endsAt))) {
    errors.push('endsAt must be a valid ISO 8601 instant');
  }

  // Check ordering only if both dates are valid
  if (
    typeof p.startsAt === 'string' && p.startsAt.length > 0 &&
    typeof p.endsAt === 'string' && p.endsAt.length > 0 &&
    Number.isFinite(Date.parse(p.startsAt)) &&
    Number.isFinite(Date.parse(p.endsAt))
  ) {
    if (Date.parse(p.endsAt) <= Date.parse(p.startsAt)) {
      errors.push('endsAt must be after startsAt');
    }
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  });
}
