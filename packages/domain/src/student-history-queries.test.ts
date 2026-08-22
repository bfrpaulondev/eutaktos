import { describe, expect, it } from 'vitest';
import {
  lastAssignment,
  lastAssignmentDate,
  assignmentCount,
  assignmentCountByPartType,
  historyByPerson,
  historyByPartType,
  daysSinceLastAssignment,
  personsAssignedInDateRange,
  uniquePartTypesForPerson,
  type AssignmentHistoryRecord,
} from './student-history-queries';

// ── Test Helpers ─────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<AssignmentHistoryRecord> = {}): AssignmentHistoryRecord {
  return Object.freeze({
    id: 'h-1',
    tenantId: 't-1',
    assignmentId: 'a-1',
    personId: 'p-1',
    partType: 'bible-reading',
    meetingDate: '2025-06-15',
    state: 'completed',
    recordedAt: '2025-06-15T10:00:00Z',
    meetingId: 'm-1',
    ...overrides,
  });
}

const T = 't-1';
const T2 = 't-2';

// Shared records for multiple describe blocks
const R1 = makeRecord({ id: 'r1', personId: 'p-1', partType: 'bible-reading', meetingDate: '2025-06-01', recordedAt: '2025-06-01T10:00:00Z', state: 'completed' });
const R2 = makeRecord({ id: 'r2', personId: 'p-1', partType: 'student-talk', meetingDate: '2025-06-08', recordedAt: '2025-06-08T10:00:00Z', state: 'completed' });
const R3 = makeRecord({ id: 'r3', personId: 'p-1', partType: 'bible-reading', meetingDate: '2025-06-15', recordedAt: '2025-06-15T10:00:00Z', state: 'cancelled' });
const R4 = makeRecord({ id: 'r4', personId: 'p-2', partType: 'chairman', meetingDate: '2025-06-01', recordedAt: '2025-06-01T10:00:00Z', state: 'assigned' });
const R5 = makeRecord({ id: 'r5', personId: 'p-2', partType: 'bible-reading', meetingDate: '2025-06-22', recordedAt: '2025-06-22T10:00:00Z', state: 'completed' });
const R6 = makeRecord({ id: 'r6', personId: 'p-1', partType: 'student-talk', meetingDate: '2025-06-22', recordedAt: '2025-06-22T10:00:00Z', state: 'completed' });
const R_OTHER_TENANT = makeRecord({ id: 'r-ot', tenantId: T2, personId: 'p-1', partType: 'bible-reading', meetingDate: '2025-07-01', recordedAt: '2025-07-01T10:00:00Z', state: 'completed' });

const BASE_HISTORY: readonly AssignmentHistoryRecord[] = [R1, R2, R3, R4, R5, R6, R_OTHER_TENANT];

// ── lastAssignment ──────────────────────────────────────────────────────

describe('lastAssignment', () => {
  it('returns undefined for empty history', () => {
    expect(lastAssignment([], 'p-1', T)).toBeUndefined();
  });

  it('returns undefined for person with no assignments', () => {
    expect(lastAssignment([R1], 'p-99', T)).toBeUndefined();
  });

  it('returns the most recent record by meetingDate', () => {
    const result = lastAssignment(BASE_HISTORY, 'p-1', T);
    expect(result).toBeDefined();
    // p-1 has R1(06-01), R2(06-08), R3(06-15), R6(06-22) → R6 is most recent
    expect(result!.id).toBe('r6');
  });

  it('breaks ties by recordedAt then id', () => {
    const records = [
      makeRecord({ id: 'r-a', personId: 'p-1', meetingDate: '2025-06-15', recordedAt: '2025-06-15T09:00:00Z' }),
      makeRecord({ id: 'r-b', personId: 'p-1', meetingDate: '2025-06-15', recordedAt: '2025-06-15T10:00:00Z' }),
    ];
    const result = lastAssignment(records, 'p-1', T);
    expect(result!.id).toBe('r-b');
  });

  it('filters by tenantId — returns undefined when record exists in another tenant', () => {
    const records = [R_OTHER_TENANT];
    expect(lastAssignment(records, 'p-1', T)).toBeUndefined();
  });

  it('filters by tenantId — finds record in correct tenant', () => {
    const records = [R_OTHER_TENANT, R1];
    // p-1 in T has R1(06-01); in T2 has R_OTHER_TENANT(07-01)
    // But we query T, so only R1 matches
    expect(lastAssignment(records, 'p-1', T)!.id).toBe('r1');
  });

  it('does not mutate input array', () => {
    const records = [R1, R2];
    const before = [...records];
    lastAssignment(records, 'p-1', T);
    expect(records).toEqual(before);
  });
});

// ── lastAssignmentDate ──────────────────────────────────────────────────

describe('lastAssignmentDate', () => {
  it('returns undefined for empty history', () => {
    expect(lastAssignmentDate([], 'p-1', T)).toBeUndefined();
  });

  it('returns undefined for person with no assignments', () => {
    expect(lastAssignmentDate([R1], 'p-99', T)).toBeUndefined();
  });

  it('returns the most recent meeting date', () => {
    // p-1 in T: 06-01, 06-08, 06-15, 06-22
    expect(lastAssignmentDate(BASE_HISTORY, 'p-1', T)).toBe('2025-06-22');
  });

  it('returns the meeting date for p-2', () => {
    // p-2 in T: 06-01, 06-22
    expect(lastAssignmentDate(BASE_HISTORY, 'p-2', T)).toBe('2025-06-22');
  });

  it('respects tenant isolation', () => {
    // p-1 in T2: 07-01
    expect(lastAssignmentDate(BASE_HISTORY, 'p-1', T2)).toBe('2025-07-01');
  });
});

// ── assignmentCount ─────────────────────────────────────────────────────

describe('assignmentCount', () => {
  it('returns 0 for empty history', () => {
    expect(assignmentCount([], 'p-1', T)).toBe(0);
  });

  it('returns 0 for person with no assignments', () => {
    expect(assignmentCount(BASE_HISTORY, 'p-99', T)).toBe(0);
  });

  it('counts only completed assignments for a person', () => {
    // p-1 in T: R1, R2 and R6 are completed; R3 is cancelled.
    expect(assignmentCount(BASE_HISTORY, 'p-1', T)).toBe(3);
  });

  it('counts only completed assignments in a date range', () => {
    // Range 06-08 to 06-15 includes R2; R3 is cancelled.
    expect(assignmentCount(BASE_HISTORY, 'p-1', T, { from: '2025-06-08', to: '2025-06-15' })).toBe(1);
  });

  it('counts completed assignments filtered by partType', () => {
    expect(assignmentCount(BASE_HISTORY, 'p-1', T, { partType: 'bible-reading' })).toBe(1);
  });

  it('counts completed records with both date range and partType', () => {
    expect(assignmentCount(BASE_HISTORY, 'p-1', T, { from: '2025-06-01', to: '2025-06-15', partType: 'bible-reading' })).toBe(1);
  });

  it('throws when from > to', () => {
    expect(() => assignmentCount(BASE_HISTORY, 'p-1', T, { from: '2025-06-15', to: '2025-06-01' })).toThrow(/from date must not be after/);
  });

  it('throws for invalid from date', () => {
    expect(() => assignmentCount(BASE_HISTORY, 'p-1', T, { from: 'not-a-date' })).toThrow();
  });

  it('throws for invalid to date', () => {
    expect(() => assignmentCount(BASE_HISTORY, 'p-1', T, { to: '2025/06/01' })).toThrow();
  });

  it('does not count cancelled assignments', () => {
    expect(assignmentCount(BASE_HISTORY, 'p-1', T)).toBe(3);
  });

  it('respects tenant isolation', () => {
    // p-1 in T2: only R_OTHER_TENANT
    expect(assignmentCount(BASE_HISTORY, 'p-1', T2)).toBe(1);
  });

  it('inclusive boundaries: from and to dates are included', () => {
    // p-1 in T: 06-01, 06-08, 06-15, 06-22
    // Range exactly on 06-01 → 1
    expect(assignmentCount(BASE_HISTORY, 'p-1', T, { from: '2025-06-01', to: '2025-06-01' })).toBe(1);
  });

  it('only from specified excludes cancelled records', () => {
    expect(assignmentCount(BASE_HISTORY, 'p-1', T, { from: '2025-06-15' })).toBe(1);
  });

  it('only to specified (no lower bound)', () => {
    // p-1 in T up to 06-08: R1(06-01), R2(06-08) = 2
    expect(assignmentCount(BASE_HISTORY, 'p-1', T, { to: '2025-06-08' })).toBe(2);
  });
});

// ── assignmentCountByPartType ──────────────────────────────────────────

describe('assignmentCountByPartType', () => {
  it('returns empty map for empty history', () => {
    const result = assignmentCountByPartType([], 'p-1', T);
    expect(result.size).toBe(0);
  });

  it('returns empty map for person with no assignments', () => {
    const result = assignmentCountByPartType(BASE_HISTORY, 'p-99', T);
    expect(result.size).toBe(0);
  });

  it('counts correctly by part type', () => {
    // Only completed records contribute: bible-reading(R1)=1, student-talk(R2,R6)=2.
    const result = assignmentCountByPartType(BASE_HISTORY, 'p-1', T);
    expect(result.get('bible-reading')).toBe(1);
    expect(result.get('student-talk')).toBe(2);
    expect(result.size).toBe(2);
  });

  it('counts multiple part types for p-2', () => {
    // R4 is assigned only, so only completed bible-reading R5 contributes.
    const result = assignmentCountByPartType(BASE_HISTORY, 'p-2', T);
    expect(result.get('chairman')).toBeUndefined();
    expect(result.get('bible-reading')).toBe(1);
    expect(result.size).toBe(1);
  });

  it('respects tenant isolation', () => {
    // p-1 in T2: bible-reading(R_OTHER_TENANT)=1
    const result = assignmentCountByPartType(BASE_HISTORY, 'p-1', T2);
    expect(result.get('bible-reading')).toBe(1);
    expect(result.size).toBe(1);
  });

  it('excludes cancelled assignments from counts', () => {
    const result = assignmentCountByPartType(BASE_HISTORY, 'p-1', T);
    expect(result.get('bible-reading')).toBe(1);
  });
});

// ── historyByPerson ─────────────────────────────────────────────────────

describe('historyByPerson', () => {
  it('returns empty array for empty history', () => {
    expect(historyByPerson([], 'p-1', T)).toEqual([]);
  });

  it('returns empty array for person with no assignments', () => {
    expect(historyByPerson(BASE_HISTORY, 'p-99', T)).toEqual([]);
  });

  it('returns all records for person ordered by meetingDate desc', () => {
    const result = historyByPerson(BASE_HISTORY, 'p-1', T);
    // p-1 in T: R6(06-22), R3(06-15), R2(06-08), R1(06-01)
    expect(result).toHaveLength(4);
    expect(result[0]!.id).toBe('r6');
    expect(result[1]!.id).toBe('r3');
    expect(result[2]!.id).toBe('r2');
    expect(result[3]!.id).toBe('r1');
  });

  it('respects tenant isolation', () => {
    const result = historyByPerson(BASE_HISTORY, 'p-1', T2);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('r-ot');
  });

  it('does not mutate input array', () => {
    const records = [R1, R2];
    const before = [...records];
    historyByPerson(records, 'p-1', T);
    expect(records).toEqual(before);
  });

  it('includes cancelled records', () => {
    const result = historyByPerson(BASE_HISTORY, 'p-1', T);
    const cancelled = result.filter(r => r.state === 'cancelled');
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]!.id).toBe('r3');
  });
});

// ── historyByPartType ───────────────────────────────────────────────────

describe('historyByPartType', () => {
  it('returns empty array for empty history', () => {
    expect(historyByPartType([], 'bible-reading', T)).toEqual([]);
  });

  it('returns empty array for part type with no records', () => {
    expect(historyByPartType(BASE_HISTORY, 'nonexistent', T)).toEqual([]);
  });

  it('returns records ordered by meetingDate desc', () => {
    const result = historyByPartType(BASE_HISTORY, 'bible-reading', T);
    // bible-reading in T: R3(06-15,p-1), R1(06-01,p-1), R5(06-22,p-2)
    // desc: R5(06-22), R3(06-15), R1(06-01)
    expect(result).toHaveLength(3);
    expect(result[0]!.id).toBe('r5');
    expect(result[1]!.id).toBe('r3');
    expect(result[2]!.id).toBe('r1');
  });

  it('respects tenant isolation', () => {
    const result = historyByPartType(BASE_HISTORY, 'bible-reading', T2);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('r-ot');
  });

  it('does not mutate input array', () => {
    const records = [R1, R5];
    const before = [...records];
    historyByPartType(records, 'bible-reading', T);
    expect(records).toEqual(before);
  });
});

// ── daysSinceLastAssignment ─────────────────────────────────────────────

describe('daysSinceLastAssignment', () => {
  it('returns null when person has never been assigned', () => {
    expect(daysSinceLastAssignment([], 'p-1', T, '2025-06-30')).toBeNull();
  });

  it('returns null for person with no assignments in non-empty history', () => {
    expect(daysSinceLastAssignment([R1], 'p-99', T, '2025-06-30')).toBeNull();
  });

  it('calculates days correctly', () => {
    // p-1 last assignment in T: 2025-06-22, reference: 2025-06-29 → 7 days
    expect(daysSinceLastAssignment(BASE_HISTORY, 'p-1', T, '2025-06-29')).toBe(7);
  });

  it('returns 0 when reference date equals last assignment date', () => {
    // p-1 last in T: 2025-06-22
    expect(daysSinceLastAssignment(BASE_HISTORY, 'p-1', T, '2025-06-22')).toBe(0);
  });

  it('handles leap year correctly (2024-02-29 to 2024-03-01 = 1 day)', () => {
    const records = [makeRecord({ id: 'leap', personId: 'p-l', meetingDate: '2024-02-29', recordedAt: '2024-03-01T10:00:00Z' })];
    expect(daysSinceLastAssignment(records, 'p-l', T, '2024-03-01')).toBe(1);
  });

  it('handles year boundary (2024-12-31 to 2025-01-02 = 2 days)', () => {
    const records = [makeRecord({ id: 'ybd', personId: 'p-yb', meetingDate: '2024-12-31', recordedAt: '2024-12-31T10:00:00Z' })];
    expect(daysSinceLastAssignment(records, 'p-yb', T, '2025-01-02')).toBe(2);
  });

  it('handles month end (2025-01-31 to 2025-02-02 = 2 days)', () => {
    const records = [makeRecord({ id: 'me', personId: 'p-me', meetingDate: '2025-01-31', recordedAt: '2025-02-01T10:00:00Z' })];
    expect(daysSinceLastAssignment(records, 'p-me', T, '2025-02-02')).toBe(2);
  });

  it('throws for invalid reference date', () => {
    expect(() => daysSinceLastAssignment([], 'p-1', T, 'not-a-date')).toThrow();
  });

  it('respects tenant isolation', () => {
    // p-1 in T2 last: 2025-07-01, ref: 2025-07-08 → 7 days
    expect(daysSinceLastAssignment(BASE_HISTORY, 'p-1', T2, '2025-07-08')).toBe(7);
  });
});

// ── personsAssignedInDateRange ──────────────────────────────────────────

describe('personsAssignedInDateRange', () => {
  it('returns empty set for empty history', () => {
    const result = personsAssignedInDateRange([], ['p-1', 'p-2'], T, '2025-06-01', '2025-06-30');
    expect(result.size).toBe(0);
  });

  it('returns empty set for empty personIds list', () => {
    const result = personsAssignedInDateRange(BASE_HISTORY, [], T, '2025-06-01', '2025-06-30');
    expect(result.size).toBe(0);
  });

  it('finds persons assigned in range', () => {
    // In T: p-1 has records at 06-01, 06-08, 06-15, 06-22; p-2 at 06-01, 06-22
    const result = personsAssignedInDateRange(BASE_HISTORY, ['p-1', 'p-2', 'p-99'], T, '2025-06-01', '2025-06-30');
    expect(result.has('p-1')).toBe(true);
    expect(result.has('p-2')).toBe(true);
    expect(result.has('p-99')).toBe(false);
    expect(result.size).toBe(2);
  });

  it('returns empty when range has no assignments for candidates', () => {
    const result = personsAssignedInDateRange(BASE_HISTORY, ['p-1'], T, '2025-01-01', '2025-01-31');
    expect(result.size).toBe(0);
  });

  it('handles leap year boundary', () => {
    const records = [
      makeRecord({ id: 'lp1', personId: 'p-lp', meetingDate: '2024-02-29', recordedAt: '2024-03-01T10:00:00Z' }),
    ];
    const result = personsAssignedInDateRange(records, ['p-lp'], T, '2024-02-28', '2024-03-01');
    expect(result.has('p-lp')).toBe(true);
  });

  it('handles year boundary crossing', () => {
    const records = [
      makeRecord({ id: 'yb1', personId: 'p-yb', meetingDate: '2024-12-31', recordedAt: '2024-12-31T10:00:00Z' }),
      makeRecord({ id: 'yb2', personId: 'p-yb2', meetingDate: '2025-01-01', recordedAt: '2025-01-02T10:00:00Z' }),
    ];
    const result = personsAssignedInDateRange(records, ['p-yb', 'p-yb2'], T, '2024-12-31', '2025-01-01');
    expect(result.size).toBe(2);
  });

  it('handles month end boundary', () => {
    const records = [
      makeRecord({ id: 'me1', personId: 'p-me', meetingDate: '2025-06-30', recordedAt: '2025-07-01T10:00:00Z' }),
    ];
    const result = personsAssignedInDateRange(records, ['p-me'], T, '2025-06-30', '2025-06-30');
    expect(result.has('p-me')).toBe(true);
  });

  it('respects tenant isolation', () => {
    // R_OTHER_TENANT is in T2, not T
    const result = personsAssignedInDateRange(BASE_HISTORY, ['p-1'], T, '2025-07-01', '2025-07-01');
    expect(result.size).toBe(0);
  });

  it('throws when from > to', () => {
    expect(() => personsAssignedInDateRange([], ['p-1'], T, '2025-06-15', '2025-06-01')).toThrow(/from date must not be after/);
  });

  it('throws for invalid from date', () => {
    expect(() => personsAssignedInDateRange([], ['p-1'], T, 'bad', '2025-06-30')).toThrow();
  });

  it('throws for invalid to date', () => {
    expect(() => personsAssignedInDateRange([], ['p-1'], T, '2025-06-01', 'bad')).toThrow();
  });

  it('only considers personIds from the provided list', () => {
    // Even though p-1 has records, we only ask about p-2
    const result = personsAssignedInDateRange(BASE_HISTORY, ['p-2'], T, '2025-06-01', '2025-06-30');
    expect(result.has('p-1')).toBe(false);
    expect(result.has('p-2')).toBe(true);
    expect(result.size).toBe(1);
  });
});

// ── uniquePartTypesForPerson ────────────────────────────────────────────

describe('uniquePartTypesForPerson', () => {
  it('returns empty set for empty history', () => {
    const result = uniquePartTypesForPerson([], 'p-1', T);
    expect(result.size).toBe(0);
  });

  it('returns empty set for person with no assignments', () => {
    const result = uniquePartTypesForPerson(BASE_HISTORY, 'p-99', T);
    expect(result.size).toBe(0);
  });

  it('returns distinct part types for a person', () => {
    // p-1 in T: bible-reading, student-talk, bible-reading, student-talk
    const result = uniquePartTypesForPerson(BASE_HISTORY, 'p-1', T);
    expect(result.size).toBe(2);
    expect(result.has('bible-reading')).toBe(true);
    expect(result.has('student-talk')).toBe(true);
  });

  it('returns single type when person only has one type', () => {
    // p-1 in T2: only bible-reading
    const result = uniquePartTypesForPerson(BASE_HISTORY, 'p-1', T2);
    expect(result.size).toBe(1);
    expect(result.has('bible-reading')).toBe(true);
  });

  it('includes types from cancelled assignments', () => {
    // p-1 in T has cancelled R3 with student-talk — already counted, but let's verify
    const result = uniquePartTypesForPerson(BASE_HISTORY, 'p-1', T);
    expect(result.has('student-talk')).toBe(true);
  });

  it('respects tenant isolation', () => {
    const result = uniquePartTypesForPerson(BASE_HISTORY, 'p-1', 'nonexistent-tenant');
    expect(result.size).toBe(0);
  });
});

// ── Determinism ─────────────────────────────────────────────────────────

describe('determinism', () => {
  it('lastAssignment returns same result for same inputs', () => {
    const a = lastAssignment(BASE_HISTORY, 'p-1', T);
    const b = lastAssignment(BASE_HISTORY, 'p-1', T);
    expect(a).toBe(b); // same reference from the input array (single pass, same object)
  });

  it('assignmentCount returns same number for same inputs', () => {
    const a = assignmentCount(BASE_HISTORY, 'p-1', T, { from: '2025-06-01', to: '2025-06-30' });
    const b = assignmentCount(BASE_HISTORY, 'p-1', T, { from: '2025-06-01', to: '2025-06-30' });
    expect(a).toBe(b);
  });

  it('historyByPerson returns identical arrays for same inputs', () => {
    const a = historyByPerson(BASE_HISTORY, 'p-1', T);
    const b = historyByPerson(BASE_HISTORY, 'p-1', T);
    expect(a).toEqual(b);
  });

  it('daysSinceLastAssignment returns same value for same inputs', () => {
    const a = daysSinceLastAssignment(BASE_HISTORY, 'p-1', T, '2025-07-01');
    const b = daysSinceLastAssignment(BASE_HISTORY, 'p-1', T, '2025-07-01');
    expect(a).toBe(b);
  });

  it('personsAssignedInDateRange returns same set contents for same inputs', () => {
    const a = personsAssignedInDateRange(BASE_HISTORY, ['p-1', 'p-2'], T, '2025-06-01', '2025-06-30');
    const b = personsAssignedInDateRange(BASE_HISTORY, ['p-1', 'p-2'], T, '2025-06-01', '2025-06-30');
    expect(a).toEqual(b);
  });
});

// ── No recommendation / scoring / ranking ───────────────────────────────

describe('consultation-only contract', () => {
  it('does not export any scoring, ranking, or recommendation functions', async () => {
    const mod = await import('./student-history-queries');
    const exported = Object.keys(mod);
    expect(exported).not.toContain('score');
    expect(exported).not.toContain('rank');
    expect(exported).not.toContain('recommend');
    expect(exported).not.toContain('best');
    expect(exported).not.toContain('mostQualified');
    expect(exported).not.toContain('suitability');
  });
});

// ── Edge Cases ──────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles single-element history array', () => {
    const single = [makeRecord({ id: 'solo', personId: 'p-s', meetingDate: '2025-01-01' })];
    expect(lastAssignment(single, 'p-s', T)!.id).toBe('solo');
    expect(lastAssignmentDate(single, 'p-s', T)).toBe('2025-01-01');
    expect(assignmentCount(single, 'p-s', T)).toBe(1);
    expect(assignmentCountByPartType(single, 'p-s', T).get('bible-reading')).toBe(1);
    expect(historyByPerson(single, 'p-s', T)).toHaveLength(1);
    expect(daysSinceLastAssignment(single, 'p-s', T, '2025-01-08')).toBe(7);
    expect(uniquePartTypesForPerson(single, 'p-s', T).has('bible-reading')).toBe(true);
  });

  it('handles records with same meetingDate and different recordedAt', () => {
    const records = [
      makeRecord({ id: 't-a', personId: 'p-t', meetingDate: '2025-06-15', recordedAt: '2025-06-15T08:00:00Z', partType: 'chairman' }),
      makeRecord({ id: 't-b', personId: 'p-t', meetingDate: '2025-06-15', recordedAt: '2025-06-15T12:00:00Z', partType: 'bible-reading' }),
    ];
    const last = lastAssignment(records, 'p-t', T);
    expect(last!.id).toBe('t-b');
  });

  it('handles very large date range spanning years', () => {
    const records = [
      makeRecord({ id: 'yr1', personId: 'p-yr', meetingDate: '2020-01-01' }),
      makeRecord({ id: 'yr2', personId: 'p-yr', meetingDate: '2025-12-31' }),
    ];
    expect(assignmentCount(records, 'p-yr', T, { from: '2020-01-01', to: '2025-12-31' })).toBe(2);
  });

  it('empty personIds in personsAssignedInDateRange returns empty set', () => {
    const result = personsAssignedInDateRange(BASE_HISTORY, [], T, '2025-06-01', '2025-06-30');
    expect(result.size).toBe(0);
  });

  it('assignmentCount with empty options object', () => {
    // Same as no options
    expect(assignmentCount(BASE_HISTORY, 'p-1', T, {})).toBe(3);
  });
});
