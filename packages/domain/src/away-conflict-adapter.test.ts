import { describe, it, expect } from 'vitest';
import {
  findUnavailablePersons,
  isPersonUnavailable,
  toConflictEngineFormat,
  filterAwayPeriodsForTenant,
  awayPeriodsOverlap,
  meetingWindowToInstantRange,
  validateAwayPeriod,
  type AwayPeriod,
  type MeetingTimeWindow,
  type UnavailablePerson,
  type ConflictEngineUnavailablePeriod,
} from './away-conflict-adapter';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAwayPeriod(overrides: Partial<AwayPeriod> & { personId: string; tenantId: string }): AwayPeriod {
  return Object.freeze({
    startsAt: '2025-06-01T09:00:00Z',
    endsAt: '2025-06-01T17:00:00Z',
    ...overrides,
  });
}

function makeMeetingWindow(overrides: Partial<MeetingTimeWindow> & { meetingDate: string; timezone: string }): MeetingTimeWindow {
  return Object.freeze({
    startTime: '10:00',
    endTime: '11:00',
    ...overrides,
  });
}

const UTC_WINDOW: MeetingTimeWindow = Object.freeze({
  meetingDate: '2025-06-01',
  startTime: '10:00',
  endTime: '11:00',
  timezone: 'UTC',
});

// ─── meetingWindowToInstantRange ─────────────────────────────────────────────

describe('meetingWindowToInstantRange', () => {
  it('converts a UTC meeting window correctly', () => {
    const range = meetingWindowToInstantRange(UTC_WINDOW);
    expect(range).not.toBeNull();
    expect(range!.start).toBe('2025-06-01T10:00:00.000Z');
    expect(range!.end).toBe('2025-06-01T11:00:00.000Z');
  });

  it('handles Europe/Lisbon timezone (UTC+0 in winter)', () => {
    const window = makeMeetingWindow({
      meetingDate: '2025-01-15',
      startTime: '10:00',
      endTime: '11:00',
      timezone: 'Europe/Lisbon',
    });
    const range = meetingWindowToInstantRange(window);
    expect(range).not.toBeNull();
    // January = WET (UTC+0)
    expect(range!.start).toBe('2025-01-15T10:00:00.000Z');
    expect(range!.end).toBe('2025-01-15T11:00:00.000Z');
  });

  it('handles Europe/Lisbon summer time (WEST, UTC+1)', () => {
    const window = makeMeetingWindow({
      meetingDate: '2025-07-15',
      startTime: '10:00',
      endTime: '11:00',
      timezone: 'Europe/Lisbon',
    });
    const range = meetingWindowToInstantRange(window);
    expect(range).not.toBeNull();
    // July = WEST (UTC+1)
    expect(range!.start).toBe('2025-07-15T09:00:00.000Z');
    expect(range!.end).toBe('2025-07-15T10:00:00.000Z');
  });

  it('handles DST spring-forward in Europe/Lisbon (2025-03-30 at 01:00)', () => {
    // At 01:00 clocks go forward to 02:00. Time 01:30 doesn't exist.
    // The meeting at 01:00 should shift to the next valid time.
    const window = makeMeetingWindow({
      meetingDate: '2025-03-30',
      startTime: '00:30',
      endTime: '01:30',
      timezone: 'Europe/Lisbon',
    });
    const range = meetingWindowToInstantRange(window);
    // The function should still return a result (possibly adjusted)
    expect(range).not.toBeNull();
    expect(typeof range!.start).toBe('string');
    expect(typeof range!.end).toBe('string');
  });

  it('handles meeting after DST spring-forward in Europe/Lisbon', () => {
    // After the transition, 03:00 is valid
    const window = makeMeetingWindow({
      meetingDate: '2025-03-30',
      startTime: '10:00',
      endTime: '11:00',
      timezone: 'Europe/Lisbon',
    });
    const range = meetingWindowToInstantRange(window);
    expect(range).not.toBeNull();
    // After spring forward, Lisbon is UTC+1
    expect(range!.start).toBe('2025-03-30T09:00:00.000Z');
    expect(range!.end).toBe('2025-03-30T10:00:00.000Z');
  });

  it('handles DST fall-back in Europe/Lisbon (2025-10-26 at 02:00)', () => {
    // At 02:00 clocks go back to 01:00. Time 01:30 is ambiguous.
    // A meeting at 01:30 should resolve to the first (summer) occurrence.
    const window = makeMeetingWindow({
      meetingDate: '2025-10-26',
      startTime: '01:00',
      endTime: '02:00',
      timezone: 'Europe/Lisbon',
    });
    const range = meetingWindowToInstantRange(window);
    expect(range).not.toBeNull();
    // At 01:00 local, before the transition, Lisbon is still UTC+1 (WEST)
    // So 01:00 WEST = 00:00 UTC
    expect(range!.start).toBe('2025-10-26T00:00:00.000Z');
  });

  it('handles America/New_York EST (UTC-5) in winter', () => {
    const window = makeMeetingWindow({
      meetingDate: '2025-01-15',
      startTime: '10:00',
      endTime: '11:00',
      timezone: 'America/New_York',
    });
    const range = meetingWindowToInstantRange(window);
    expect(range).not.toBeNull();
    expect(range!.start).toBe('2025-01-15T15:00:00.000Z');
    expect(range!.end).toBe('2025-01-15T16:00:00.000Z');
  });

  it('handles America/New_York EDT (UTC-4) in summer', () => {
    const window = makeMeetingWindow({
      meetingDate: '2025-07-15',
      startTime: '10:00',
      endTime: '11:00',
      timezone: 'America/New_York',
    });
    const range = meetingWindowToInstantRange(window);
    expect(range).not.toBeNull();
    expect(range!.start).toBe('2025-07-15T14:00:00.000Z');
    expect(range!.end).toBe('2025-07-15T15:00:00.000Z');
  });

  it('handles America/New_York DST spring-forward (2025-03-09 at 02:00)', () => {
    // At 02:00 clocks go forward to 03:00
    const window = makeMeetingWindow({
      meetingDate: '2025-03-09',
      startTime: '10:00',
      endTime: '11:00',
      timezone: 'America/New_York',
    });
    const range = meetingWindowToInstantRange(window);
    expect(range).not.toBeNull();
    // March 9 after spring forward = EDT (UTC-4)
    expect(range!.start).toBe('2025-03-09T14:00:00.000Z');
    expect(range!.end).toBe('2025-03-09T15:00:00.000Z');
  });

  it('handles America/New_York DST fall-back (2025-11-02 at 02:00)', () => {
    // At 02:00 clocks go back to 01:00
    const window = makeMeetingWindow({
      meetingDate: '2025-11-02',
      startTime: '01:00',
      endTime: '02:00',
      timezone: 'America/New_York',
    });
    const range = meetingWindowToInstantRange(window);
    expect(range).not.toBeNull();
    // At 01:00 local, before the transition, still EDT (UTC-4)
    expect(range!.start).toBe('2025-11-02T05:00:00.000Z');
  });

  it('handles Pacific/Kiritimati (UTC+14)', () => {
    const window = makeMeetingWindow({
      meetingDate: '2025-06-01',
      startTime: '10:00',
      endTime: '11:00',
      timezone: 'Pacific/Kiritimati',
    });
    const range = meetingWindowToInstantRange(window);
    expect(range).not.toBeNull();
    // UTC+14: local 10:00 = UTC 2025-05-31T20:00Z
    expect(range!.start).toBe('2025-05-31T20:00:00.000Z');
    expect(range!.end).toBe('2025-05-31T21:00:00.000Z');
  });

  it('handles Etc/GMT+12 (UTC-12, near Baker Island)', () => {
    const window = makeMeetingWindow({
      meetingDate: '2025-06-01',
      startTime: '10:00',
      endTime: '11:00',
      timezone: 'Etc/GMT+12',
    });
    const range = meetingWindowToInstantRange(window);
    expect(range).not.toBeNull();
    // UTC-12: local 10:00 = UTC 22:00
    expect(range!.start).toBe('2025-06-01T22:00:00.000Z');
    expect(range!.end).toBe('2025-06-01T23:00:00.000Z');
  });

  it('handles late evening meeting in a non-UTC timezone (near midnight)', () => {
    // Meeting from 22:00 to 23:30 in America/New_York (EDT, UTC-4)
    const window = makeMeetingWindow({
      meetingDate: '2025-07-15',
      startTime: '22:00',
      endTime: '23:30',
      timezone: 'America/New_York',
    });
    const range = meetingWindowToInstantRange(window);
    expect(range).not.toBeNull();
    // 22:00 EDT = 02:00 UTC next day
    // 23:30 EDT = 03:30 UTC next day
    expect(range!.start).toBe('2025-07-16T02:00:00.000Z');
    expect(range!.end).toBe('2025-07-16T03:30:00.000Z');
  });

  it('documents that meetingDate applies to both times (midnight limitation)', () => {
    // When endTime < startTime in local wall-clock, both are on meetingDate.
    // The caller must handle midnight-spanning meetings via separate windows.
    const window = makeMeetingWindow({
      meetingDate: '2025-07-15',
      startTime: '23:00',
      endTime: '01:00',
      timezone: 'America/New_York',
    });
    const range = meetingWindowToInstantRange(window);
    expect(range).not.toBeNull();
    // 23:00 EDT Jul 15 = 03:00 UTC Jul 16
    // 01:00 EDT Jul 15 = 05:00 UTC Jul 15 (NOT Jul 16 — same meetingDate)
    expect(range!.start).toBe('2025-07-16T03:00:00.000Z');
    expect(range!.end).toBe('2025-07-15T05:00:00.000Z');
  });

  it('returns null for invalid timezone', () => {
    const window = makeMeetingWindow({
      meetingDate: '2025-06-01',
      startTime: '10:00',
      endTime: '11:00',
      timezone: 'Invalid/Zone',
    });
    expect(meetingWindowToInstantRange(window)).toBeNull();
  });

  it('returns null for null input', () => {
    expect(meetingWindowToInstantRange(null)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(meetingWindowToInstantRange('string')).toBeNull();
    expect(meetingWindowToInstantRange(42)).toBeNull();
  });

  it('returns null for missing fields', () => {
    expect(meetingWindowToInstantRange({})).toBeNull();
    expect(meetingWindowToInstantRange({ meetingDate: '2025-06-01' })).toBeNull();
  });

  it('returns null for invalid date format', () => {
    const window = makeMeetingWindow({
      meetingDate: 'not-a-date',
      timezone: 'UTC',
    });
    expect(meetingWindowToInstantRange(window)).toBeNull();
  });

  it('returns null for invalid time format', () => {
    const window = makeMeetingWindow({
      meetingDate: '2025-06-01',
      startTime: '25:00',
      endTime: '26:00',
      timezone: 'UTC',
    });
    expect(meetingWindowToInstantRange(window)).toBeNull();
  });

  it('returns null for empty timezone', () => {
    const window = makeMeetingWindow({
      meetingDate: '2025-06-01',
      timezone: '',
    });
    expect(meetingWindowToInstantRange(window)).toBeNull();
  });
});

// ─── awayPeriodsOverlap ──────────────────────────────────────────────────────

describe('awayPeriodsOverlap', () => {
  const base: AwayPeriod = makeAwayPeriod({
    personId: 'p1',
    tenantId: 't1',
    startsAt: '2025-06-01T10:00:00Z',
    endsAt: '2025-06-01T12:00:00Z',
  });

  it('returns true for overlapping periods', () => {
    const other: AwayPeriod = makeAwayPeriod({
      personId: 'p2', tenantId: 't1',
      startsAt: '2025-06-01T11:00:00Z',
      endsAt: '2025-06-01T13:00:00Z',
    });
    expect(awayPeriodsOverlap(base, other)).toBe(true);
  });

  it('returns true for contained period', () => {
    const other: AwayPeriod = makeAwayPeriod({
      personId: 'p2', tenantId: 't1',
      startsAt: '2025-06-01T10:30:00Z',
      endsAt: '2025-06-01T11:30:00Z',
    });
    expect(awayPeriodsOverlap(base, other)).toBe(true);
  });

  it('returns true for fully containing period', () => {
    const other: AwayPeriod = makeAwayPeriod({
      personId: 'p2', tenantId: 't1',
      startsAt: '2025-06-01T09:00:00Z',
      endsAt: '2025-06-01T13:00:00Z',
    });
    expect(awayPeriodsOverlap(base, other)).toBe(true);
  });

  it('returns false for non-overlapping periods (before)', () => {
    const other: AwayPeriod = makeAwayPeriod({
      personId: 'p2', tenantId: 't1',
      startsAt: '2025-06-01T08:00:00Z',
      endsAt: '2025-06-01T10:00:00Z',
    });
    expect(awayPeriodsOverlap(base, other)).toBe(false);
  });

  it('returns false for non-overlapping periods (after)', () => {
    const other: AwayPeriod = makeAwayPeriod({
      personId: 'p2', tenantId: 't1',
      startsAt: '2025-06-01T12:00:00Z',
      endsAt: '2025-06-01T14:00:00Z',
    });
    expect(awayPeriodsOverlap(base, other)).toBe(false);
  });

  it('returns false for adjacent periods (a ends where b starts)', () => {
    const other: AwayPeriod = makeAwayPeriod({
      personId: 'p2', tenantId: 't1',
      startsAt: '2025-06-01T12:00:00Z',
      endsAt: '2025-06-01T14:00:00Z',
    });
    // base ends at 12:00, other starts at 12:00 → no overlap (half-open)
    expect(awayPeriodsOverlap(base, other)).toBe(false);
  });

  it('returns false for adjacent periods (b ends where a starts)', () => {
    const other: AwayPeriod = makeAwayPeriod({
      personId: 'p2', tenantId: 't1',
      startsAt: '2025-06-01T08:00:00Z',
      endsAt: '2025-06-01T10:00:00Z',
    });
    expect(awayPeriodsOverlap(base, other)).toBe(false);
  });

  it('returns false for null inputs', () => {
    expect(awayPeriodsOverlap(null, base)).toBe(false);
    expect(awayPeriodsOverlap(base, null)).toBe(false);
    expect(awayPeriodsOverlap(null, null)).toBe(false);
  });

  it('returns false for invalid date strings', () => {
    const bad = { startsAt: 'not-a-date', endsAt: 'also-bad', personId: 'p2', tenantId: 't1' };
    expect(awayPeriodsOverlap(base, bad)).toBe(false);
  });

  it('returns false when end equals start (zero-length period)', () => {
    const zero: AwayPeriod = makeAwayPeriod({
      personId: 'p2', tenantId: 't1',
      startsAt: '2025-06-01T11:00:00Z',
      endsAt: '2025-06-01T11:00:00Z',
    });
    expect(awayPeriodsOverlap(base, zero)).toBe(false);
  });

  it('returns false when end is before start', () => {
    const inverted = {
      startsAt: '2025-06-01T12:00:00Z',
      endsAt: '2025-06-01T10:00:00Z',
      personId: 'p2', tenantId: 't1',
    };
    expect(awayPeriodsOverlap(base, inverted)).toBe(false);
  });

  it('is symmetric', () => {
    const a: AwayPeriod = makeAwayPeriod({
      personId: 'p1', tenantId: 't1',
      startsAt: '2025-06-01T10:00:00Z',
      endsAt: '2025-06-01T14:00:00Z',
    });
    const b: AwayPeriod = makeAwayPeriod({
      personId: 'p2', tenantId: 't1',
      startsAt: '2025-06-01T12:00:00Z',
      endsAt: '2025-06-01T16:00:00Z',
    });
    expect(awayPeriodsOverlap(a, b)).toBe(awayPeriodsOverlap(b, a));
  });
});

// ─── filterAwayPeriodsForTenant ──────────────────────────────────────────────

describe('filterAwayPeriodsForTenant', () => {
  it('returns only periods for the given tenant', () => {
    const periods: AwayPeriod[] = [
      makeAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T10:00:00Z', endsAt: '2025-06-01T12:00:00Z' }),
      makeAwayPeriod({ personId: 'p2', tenantId: 't2', startsAt: '2025-06-01T10:00:00Z', endsAt: '2025-06-01T12:00:00Z' }),
      makeAwayPeriod({ personId: 'p3', tenantId: 't1', startsAt: '2025-06-02T10:00:00Z', endsAt: '2025-06-02T12:00:00Z' }),
    ];
    const result = filterAwayPeriodsForTenant(periods, 't1');
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.tenantId === 't1')).toBe(true);
  });

  it('returns empty array for non-matching tenant', () => {
    const periods: AwayPeriod[] = [
      makeAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T10:00:00Z', endsAt: '2025-06-01T12:00:00Z' }),
    ];
    expect(filterAwayPeriodsForTenant(periods, 't2')).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(filterAwayPeriodsForTenant([], 't1')).toHaveLength(0);
  });

  it('returns empty array for empty tenantId', () => {
    const periods: AwayPeriod[] = [
      makeAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T10:00:00Z', endsAt: '2025-06-01T12:00:00Z' }),
    ];
    expect(filterAwayPeriodsForTenant(periods, '')).toHaveLength(0);
  });

  it('filters out malformed entries silently', () => {
    const mixed: unknown[] = [
      makeAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T10:00:00Z', endsAt: '2025-06-01T12:00:00Z' }),
      null,
      'not an object',
      { personId: 'p2' },
      { personId: 'p3', tenantId: 't1' },
      makeAwayPeriod({ personId: 'p4', tenantId: 't1', startsAt: '2025-06-02T10:00:00Z', endsAt: '2025-06-02T12:00:00Z' }),
    ];
    const result = filterAwayPeriodsForTenant(mixed, 't1');
    expect(result).toHaveLength(2);
  });

  it('ensures strict tenant equality (no substring match)', () => {
    const periods: AwayPeriod[] = [
      makeAwayPeriod({ personId: 'p1', tenantId: 't1-extra', startsAt: '2025-06-01T10:00:00Z', endsAt: '2025-06-01T12:00:00Z' }),
    ];
    expect(filterAwayPeriodsForTenant(periods, 't1')).toHaveLength(0);
  });
});

// ─── findUnavailablePersons ──────────────────────────────────────────────────

describe('findUnavailablePersons', () => {
  it('returns persons whose away period overlaps the meeting', () => {
    const periods: AwayPeriod[] = [
      makeAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T09:00:00Z', endsAt: '2025-06-01T11:00:00Z' }),
      makeAwayPeriod({ personId: 'p2', tenantId: 't1', startsAt: '2025-06-01T12:00:00Z', endsAt: '2025-06-01T14:00:00Z' }),
    ];
    const result = findUnavailablePersons(periods, UTC_WINDOW);
    expect(result).toHaveLength(1);
    expect(result[0]!.personId).toBe('p1');
    expect(result[0]!.reason).toBe('away-period');
  });

  it('returns empty for empty away periods', () => {
    expect(findUnavailablePersons([], UTC_WINDOW)).toHaveLength(0);
  });

  it('returns empty when no one is away during the meeting', () => {
    const periods: AwayPeriod[] = [
      makeAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T07:00:00Z', endsAt: '2025-06-01T09:00:00Z' }),
      makeAwayPeriod({ personId: 'p2', tenantId: 't1', startsAt: '2025-06-01T12:00:00Z', endsAt: '2025-06-01T14:00:00Z' }),
    ];
    expect(findUnavailablePersons(periods, UTC_WINDOW)).toHaveLength(0);
  });

  it('handles away period ending exactly at meeting start (no overlap)', () => {
    // Half-open: away [08:00, 10:00), meeting [10:00, 11:00) → no overlap
    const periods: AwayPeriod[] = [
      makeAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T08:00:00Z', endsAt: '2025-06-01T10:00:00Z' }),
    ];
    expect(findUnavailablePersons(periods, UTC_WINDOW)).toHaveLength(0);
  });

  it('handles away period starting exactly at meeting end (no overlap)', () => {
    // Half-open: meeting [10:00, 11:00), away [11:00, 13:00) → no overlap
    const periods: AwayPeriod[] = [
      makeAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T11:00:00Z', endsAt: '2025-06-01T13:00:00Z' }),
    ];
    expect(findUnavailablePersons(periods, UTC_WINDOW)).toHaveLength(0);
  });

  it('handles away period containing the entire meeting', () => {
    const periods: AwayPeriod[] = [
      makeAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T00:00:00Z', endsAt: '2025-06-02T00:00:00Z' }),
    ];
    const result = findUnavailablePersons(periods, UTC_WINDOW);
    expect(result).toHaveLength(1);
    expect(result[0]!.personId).toBe('p1');
  });

  it('deduplicates per person (returns first matching period)', () => {
    const periods: AwayPeriod[] = [
      makeAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T09:00:00Z', endsAt: '2025-06-01T11:00:00Z' }),
      makeAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T10:30:00Z', endsAt: '2025-06-01T12:00:00Z' }),
    ];
    const result = findUnavailablePersons(periods, UTC_WINDOW);
    expect(result).toHaveLength(1);
    // Should be the first matching period
    expect(result[0]!.startsAt).toBe('2025-06-01T09:00:00Z');
  });

  it('returns empty for null meeting window', () => {
    const periods: AwayPeriod[] = [
      makeAwayPeriod({ personId: 'p1', tenantId: 't1' }),
    ];
    expect(findUnavailablePersons(periods, null)).toHaveLength(0);
  });

  it('ignores malformed away period entries', () => {
    const mixed: unknown[] = [
      null,
      'not an object',
      { personId: 'p1' },
      makeAwayPeriod({ personId: 'p2', tenantId: 't1', startsAt: '2025-06-01T09:00:00Z', endsAt: '2025-06-01T11:00:00Z' }),
      { personId: 'p3', tenantId: 't1', startsAt: 'bad', endsAt: 'bad' },
    ];
    const result = findUnavailablePersons(mixed, UTC_WINDOW);
    expect(result).toHaveLength(1);
    expect(result[0]!.personId).toBe('p2');
  });

  it('returns frozen arrays', () => {
    const periods: AwayPeriod[] = [
      makeAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T09:00:00Z', endsAt: '2025-06-01T11:00:00Z' }),
    ];
    const result = findUnavailablePersons(periods, UTC_WINDOW);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('works with non-UTC timezone meeting windows', () => {
    // Meeting in Europe/Lisbon summer (UTC+1): 10:00-11:00 WEST = 09:00-10:00 UTC
    const lisbonWindow = makeMeetingWindow({
      meetingDate: '2025-07-15',
      startTime: '10:00',
      endTime: '11:00',
      timezone: 'Europe/Lisbon',
    });
    // Away period at 09:30 UTC → should overlap with 09:00-10:00 UTC
    const periods: AwayPeriod[] = [
      makeAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-07-15T09:30:00Z', endsAt: '2025-07-15T10:30:00Z' }),
    ];
    const result = findUnavailablePersons(periods, lisbonWindow);
    expect(result).toHaveLength(1);
  });

  it('handles DST boundary correctly for away period overlap', () => {
    // Europe/Lisbon DST spring-forward: 2025-03-30 at 01:00
    // Meeting at 10:00 local (09:00 UTC since DST already happened)
    const lisbonWindow = makeMeetingWindow({
      meetingDate: '2025-03-30',
      startTime: '10:00',
      endTime: '11:00',
      timezone: 'Europe/Lisbon',
    });
    // Away period overlapping 09:00-10:00 UTC
    const periods: AwayPeriod[] = [
      makeAwayPeriod({
        personId: 'p1', tenantId: 't1',
        startsAt: '2025-03-30T08:00:00Z',
        endsAt: '2025-03-30T09:30:00Z',
      }),
    ];
    const result = findUnavailablePersons(periods, lisbonWindow);
    expect(result).toHaveLength(1);
  });
});

// ─── isPersonUnavailable ─────────────────────────────────────────────────────

describe('isPersonUnavailable', () => {
  it('returns true when person has an overlapping away period', () => {
    const periods: AwayPeriod[] = [
      makeAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T09:00:00Z', endsAt: '2025-06-01T11:00:00Z' }),
    ];
    expect(isPersonUnavailable(periods, 'p1', UTC_WINDOW)).toBe(true);
  });

  it('returns false when person has no away periods', () => {
    const periods: AwayPeriod[] = [
      makeAwayPeriod({ personId: 'p2', tenantId: 't1', startsAt: '2025-06-01T09:00:00Z', endsAt: '2025-06-01T11:00:00Z' }),
    ];
    expect(isPersonUnavailable(periods, 'p1', UTC_WINDOW)).toBe(false);
  });

  it('returns false when person is away but not during the meeting', () => {
    const periods: AwayPeriod[] = [
      makeAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T07:00:00Z', endsAt: '2025-06-01T09:00:00Z' }),
    ];
    expect(isPersonUnavailable(periods, 'p1', UTC_WINDOW)).toBe(false);
  });

  it('returns false for empty personId', () => {
    expect(isPersonUnavailable([], '', UTC_WINDOW)).toBe(false);
  });

  it('returns false for empty away periods', () => {
    expect(isPersonUnavailable([], 'p1', UTC_WINDOW)).toBe(false);
  });

  it('returns false for null meeting window', () => {
    expect(isPersonUnavailable([], 'p1', null)).toBe(false);
  });

  it('returns true for exact boundary overlap (away starts one ms before meeting end)', () => {
    const periods: AwayPeriod[] = [
      makeAwayPeriod({
        personId: 'p1', tenantId: 't1',
        startsAt: '2025-06-01T10:59:59.999Z',
        endsAt: '2025-06-01T12:00:00Z',
      }),
    ];
    expect(isPersonUnavailable(periods, 'p1', UTC_WINDOW)).toBe(true);
  });

  it('returns false for exact boundary non-overlap (away starts at meeting end)', () => {
    const periods: AwayPeriod[] = [
      makeAwayPeriod({
        personId: 'p1', tenantId: 't1',
        startsAt: '2025-06-01T11:00:00.000Z',
        endsAt: '2025-06-01T12:00:00Z',
      }),
    ];
    expect(isPersonUnavailable(periods, 'p1', UTC_WINDOW)).toBe(false);
  });
});

// ─── toConflictEngineFormat ──────────────────────────────────────────────────

describe('toConflictEngineFormat', () => {
  it('converts UnavailablePerson to ConflictEngineUnavailablePeriod', () => {
    const persons: UnavailablePerson[] = [
      Object.freeze({
        personId: 'p1',
        reason: 'away-period' as const,
        startsAt: '2025-06-01T09:00:00Z',
        endsAt: '2025-06-01T11:00:00Z',
      }),
    ];
    const result = toConflictEngineFormat(persons);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      personId: 'p1',
      startsAt: '2025-06-01T09:00:00Z',
      endsAt: '2025-06-01T11:00:00Z',
    });
  });

  it('strips the reason field', () => {
    const persons: UnavailablePerson[] = [
      Object.freeze({
        personId: 'p1',
        reason: 'away-period' as const,
        startsAt: '2025-06-01T09:00:00Z',
        endsAt: '2025-06-01T11:00:00Z',
      }),
    ];
    const result = toConflictEngineFormat(persons);
    expect('reason' in result[0]!).toBe(false);
  });

  it('returns empty array for empty input', () => {
    expect(toConflictEngineFormat([])).toHaveLength(0);
  });

  it('skips malformed entries silently', () => {
    const mixed: unknown[] = [
      null,
      'not an object',
      { personId: 'p1' },
      Object.freeze({
        personId: 'p2',
        reason: 'away-period' as const,
        startsAt: '2025-06-01T09:00:00Z',
        endsAt: '2025-06-01T11:00:00Z',
      }),
    ];
    const result = toConflictEngineFormat(mixed);
    expect(result).toHaveLength(1);
    expect(result[0]!.personId).toBe('p2');
  });

  it('returns frozen arrays', () => {
    const persons: UnavailablePerson[] = [
      Object.freeze({
        personId: 'p1',
        reason: 'away-period' as const,
        startsAt: '2025-06-01T09:00:00Z',
        endsAt: '2025-06-01T11:00:00Z',
      }),
    ];
    const result = toConflictEngineFormat(persons);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('handles unavailability reason type', () => {
    const persons: UnavailablePerson[] = [
      Object.freeze({
        personId: 'p1',
        reason: 'unavailability' as const,
        startsAt: '2025-06-01T09:00:00Z',
        endsAt: '2025-06-01T11:00:00Z',
      }),
    ];
    const result = toConflictEngineFormat(persons);
    expect(result).toHaveLength(1);
    expect(result[0]!.personId).toBe('p1');
  });
});

// ─── validateAwayPeriod ──────────────────────────────────────────────────────

describe('validateAwayPeriod', () => {
  it('returns valid for a correct away period', () => {
    const period = makeAwayPeriod({
      personId: 'p1', tenantId: 't1',
      startsAt: '2025-06-01T09:00:00Z',
      endsAt: '2025-06-01T11:00:00Z',
    });
    const result = validateAwayPeriod(period);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects null', () => {
    const result = validateAwayPeriod(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Period must be a non-null object');
  });

  it('rejects missing personId', () => {
    const result = validateAwayPeriod({ tenantId: 't1', startsAt: '2025-06-01T09:00:00Z', endsAt: '2025-06-01T11:00:00Z' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('personId'))).toBe(true);
  });

  it('rejects empty personId', () => {
    const result = validateAwayPeriod({ personId: '', tenantId: 't1', startsAt: '2025-06-01T09:00:00Z', endsAt: '2025-06-01T11:00:00Z' });
    expect(result.valid).toBe(false);
  });

  it('rejects missing tenantId', () => {
    const result = validateAwayPeriod({ personId: 'p1', startsAt: '2025-06-01T09:00:00Z', endsAt: '2025-06-01T11:00:00Z' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('tenantId'))).toBe(true);
  });

  it('rejects empty tenantId', () => {
    const result = validateAwayPeriod({ personId: 'p1', tenantId: '', startsAt: '2025-06-01T09:00:00Z', endsAt: '2025-06-01T11:00:00Z' });
    expect(result.valid).toBe(false);
  });

  it('rejects invalid startsAt', () => {
    const result = validateAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: 'not-a-date', endsAt: '2025-06-01T11:00:00Z' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('startsAt'))).toBe(true);
  });

  it('rejects invalid endsAt', () => {
    const result = validateAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T09:00:00Z', endsAt: 'not-a-date' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('endsAt'))).toBe(true);
  });

  it('rejects endsAt before startsAt', () => {
    const result = validateAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T11:00:00Z', endsAt: '2025-06-01T09:00:00Z' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('after startsAt'))).toBe(true);
  });

  it('rejects endsAt equal to startsAt', () => {
    const result = validateAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T10:00:00Z', endsAt: '2025-06-01T10:00:00Z' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('after startsAt'))).toBe(true);
  });

  it('rejects empty startsAt', () => {
    const result = validateAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '', endsAt: '2025-06-01T11:00:00Z' });
    expect(result.valid).toBe(false);
  });

  it('rejects empty endsAt', () => {
    const result = validateAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T09:00:00Z', endsAt: '' });
    expect(result.valid).toBe(false);
  });

  it('collects multiple errors', () => {
    const result = validateAwayPeriod({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4); // personId, tenantId, startsAt, endsAt
  });

  it('returns frozen result', () => {
    const period = makeAwayPeriod({ personId: 'p1', tenantId: 't1' });
    const result = validateAwayPeriod(period);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.errors)).toBe(true);
  });
});

// ─── Determinism ─────────────────────────────────────────────────────────────

describe('determinism', () => {
  it('findUnavailablePersons returns same result for same inputs', () => {
    const periods: AwayPeriod[] = [
      makeAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T09:00:00Z', endsAt: '2025-06-01T11:00:00Z' }),
      makeAwayPeriod({ personId: 'p2', tenantId: 't1', startsAt: '2025-06-01T12:00:00Z', endsAt: '2025-06-01T14:00:00Z' }),
      makeAwayPeriod({ personId: 'p3', tenantId: 't1', startsAt: '2025-06-01T10:30:00Z', endsAt: '2025-06-01T12:30:00Z' }),
    ];

    const r1 = findUnavailablePersons(periods, UTC_WINDOW);
    const r2 = findUnavailablePersons(periods, UTC_WINDOW);
    expect(r1).toEqual(r2);
  });

  it('meetingWindowToInstantRange returns same result for same inputs', () => {
    const window = makeMeetingWindow({
      meetingDate: '2025-07-15',
      startTime: '14:30',
      endTime: '16:00',
      timezone: 'America/New_York',
    });
    const r1 = meetingWindowToInstantRange(window);
    const r2 = meetingWindowToInstantRange(window);
    expect(r1).toEqual(r2);
  });

  it('toConflictEngineFormat returns same result for same inputs', () => {
    const persons: UnavailablePerson[] = [
      Object.freeze({ personId: 'p1', reason: 'away-period' as const, startsAt: '2025-06-01T09:00:00Z', endsAt: '2025-06-01T11:00:00Z' }),
      Object.freeze({ personId: 'p2', reason: 'unavailability' as const, startsAt: '2025-06-01T10:00:00Z', endsAt: '2025-06-01T12:00:00Z' }),
    ];
    const r1 = toConflictEngineFormat(persons);
    const r2 = toConflictEngineFormat(persons);
    expect(r1).toEqual(r2);
  });
});

// ─── Integration: full pipeline ──────────────────────────────────────────────

describe('integration: full pipeline', () => {
  it('findUnavailablePersons → toConflictEngineFormat produces engine-compatible output', () => {
    const periods: AwayPeriod[] = [
      makeAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T09:00:00Z', endsAt: '2025-06-01T11:00:00Z' }),
      makeAwayPeriod({ personId: 'p2', tenantId: 't1', startsAt: '2025-06-01T10:30:00Z', endsAt: '2025-06-01T12:00:00Z' }),
    ];

    const unavailable = findUnavailablePersons(periods, UTC_WINDOW);
    const engineFormat = toConflictEngineFormat(unavailable);

    expect(engineFormat).toHaveLength(2);
    for (const entry of engineFormat) {
      expect(entry).toHaveProperty('personId');
      expect(entry).toHaveProperty('startsAt');
      expect(entry).toHaveProperty('endsAt');
      expect(typeof entry.personId).toBe('string');
      expect(typeof entry.startsAt).toBe('string');
      expect(typeof entry.endsAt).toBe('string');
      // Verify dates are parseable
      expect(Number.isFinite(Date.parse(entry.startsAt))).toBe(true);
      expect(Number.isFinite(Date.parse(entry.endsAt))).toBe(true);
    }
  });

  it('filterAwayPeriodsForTenant → findUnavailablePersons → toConflictEngineFormat end-to-end', () => {
    const allPeriods: AwayPeriod[] = [
      makeAwayPeriod({ personId: 'p1', tenantId: 't1', startsAt: '2025-06-01T09:00:00Z', endsAt: '2025-06-01T11:00:00Z' }),
      makeAwayPeriod({ personId: 'p2', tenantId: 't2', startsAt: '2025-06-01T09:00:00Z', endsAt: '2025-06-01T11:00:00Z' }),
      makeAwayPeriod({ personId: 'p3', tenantId: 't1', startsAt: '2025-06-01T12:00:00Z', endsAt: '2025-06-01T14:00:00Z' }),
    ];

    const tenantPeriods = filterAwayPeriodsForTenant(allPeriods, 't1');
    expect(tenantPeriods).toHaveLength(2);

    const unavailable = findUnavailablePersons(tenantPeriods, UTC_WINDOW);
    expect(unavailable).toHaveLength(1);
    expect(unavailable[0]!.personId).toBe('p1');

    const engineFormat = toConflictEngineFormat(unavailable);
    expect(engineFormat).toHaveLength(1);
    expect(engineFormat[0]!.personId).toBe('p1');
  });
});
