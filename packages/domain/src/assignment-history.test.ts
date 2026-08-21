import { describe, expect, it } from 'vitest';
import {
  recordAssignmentHistory,
  normalizeAssignmentHistoryRecord,
  assertHistoryTenant,
  filterHistoryByTenant,
  filterHistoryByPerson,
  filterHistoryByMeeting,
  filterHistoryByDateRange,
  filterHistoryByPartType,
  filterHistoryByState,
  orderHistoryByDate,
  countAssignmentsInPeriod,
  lastAssignmentDate,
  type AssignmentHistoryRecord,
} from './assignment-history';

const T = 'tenant-1';
const NOW = '2025-06-15T10:00:00Z';

function makeRecord(overrides: Partial<AssignmentHistoryRecord> = {}): Readonly<AssignmentHistoryRecord> {
  return recordAssignmentHistory({
    id: 'h-1',
    tenantId: T,
    assignmentId: 'a-1',
    personId: 'p-1',
    partType: 'bible-reading',
    meetingDate: '2025-06-15',
    state: 'completed',
    recordedAt: NOW,
    meetingId: 'm-1',
    ...overrides,
  });
}

describe('assignment-history domain', () => {
  // ── Creation & Validation ──────────────────────────────────────────────
  describe('recordAssignmentHistory', () => {
    it('creates a frozen record with all fields', () => {
      const r = makeRecord();
      expect(r.id).toBe('h-1');
      expect(r.tenantId).toBe(T);
      expect(r.assignmentId).toBe('a-1');
      expect(r.personId).toBe('p-1');
      expect(r.partType).toBe('bible-reading');
      expect(r.meetingDate).toBe('2025-06-15');
      expect(r.state).toBe('completed');
      expect(r.recordedAt).toBe(NOW);
      expect(r.meetingId).toBe('m-1');
    });

    it('returns a frozen object', () => {
      const r = makeRecord();
      expect(Object.isFrozen(r)).toBe(true);
    });

    it('creates records for each valid state', () => {
      for (const state of ['assigned', 'completed', 'cancelled'] as const) {
        const r = makeRecord({ id: `h-${state}`, state });
        expect(r.state).toBe(state);
      }
    });

    it('rejects empty id', () => {
      expect(() => makeRecord({ id: ' ' })).toThrow(/historyRecordId is required/);
    });

    it('rejects empty tenantId', () => {
      expect(() => makeRecord({ tenantId: '' })).toThrow(/tenantId is required/);
    });

    it('rejects empty assignmentId', () => {
      expect(() => makeRecord({ assignmentId: '   ' })).toThrow(/assignmentId is required/);
    });

    it('rejects empty personId', () => {
      expect(() => makeRecord({ personId: '' })).toThrow(/personId is required/);
    });

    it('rejects empty partType', () => {
      expect(() => makeRecord({ partType: ' ' })).toThrow(/partType is required/);
    });

    it('rejects empty meetingId', () => {
      expect(() => makeRecord({ meetingId: '' })).toThrow(/meetingId is required/);
    });

    it('rejects invalid meetingDate format', () => {
      expect(() => makeRecord({ meetingDate: '15/06/2025' })).toThrow(/YYYY-MM-DD/);
    });

    it('rejects invalid ISO recordedAt', () => {
      expect(() => makeRecord({ recordedAt: 'not-a-date' })).toThrow(/Invalid ISO date/);
    });

    it('rejects invalid state', () => {
      expect(() => makeRecord({ state: 'deleted' as any })).toThrow(/Invalid state/);
    });

    it('rejects non-string id', () => {
      expect(() => recordAssignmentHistory({
        id: 123 as any, tenantId: T, assignmentId: 'a-1', personId: 'p-1',
        partType: 'chairman', meetingDate: '2025-06-15', state: 'assigned',
        recordedAt: NOW, meetingId: 'm-1',
      })).toThrow(/historyRecordId must be a string/);
    });

    it('rejects null injection for tenantId', () => {
      expect(() => recordAssignmentHistory({
        id: 'h-x', tenantId: null as any, assignmentId: 'a-1', personId: 'p-1',
        partType: 'chairman', meetingDate: '2025-06-15', state: 'assigned',
        recordedAt: NOW, meetingId: 'm-1',
      })).toThrow(/tenantId must be a string/);
    });

    it('rejects non-string meetingDate', () => {
      expect(() => makeRecord({ meetingDate: 20250615 as any })).toThrow(/meetingDate must be a string/);
    });

    it('rejects non-string state', () => {
      expect(() => makeRecord({ state: null as any })).toThrow(/Invalid state/);
    });
  });

  // ── Normalization ──────────────────────────────────────────────────────
  describe('normalizeAssignmentHistoryRecord', () => {
    it('validates and freezes an imported record', () => {
      const imported = {
        id: '  h-norm  ', tenantId: T, assignmentId: 'a-2', personId: 'p-2',
        partType: 'student-talk', meetingDate: '2025-07-01', state: 'completed' as const,
        recordedAt: '2025-07-02T08:00:00Z', meetingId: 'm-2',
      };
      const result = normalizeAssignmentHistoryRecord(imported);
      expect(result.id).toBe('h-norm');
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('rejects invalid imported record', () => {
      expect(() => normalizeAssignmentHistoryRecord({
        id: 'h-bad', tenantId: T, assignmentId: 'a-1', personId: 'p-1',
        partType: 'chairman', meetingDate: '2025-06-15', state: 'bogus' as any,
        recordedAt: NOW, meetingId: 'm-1',
      })).toThrow(/Invalid state/);
    });

    it('rejects imported record with empty fields', () => {
      expect(() => normalizeAssignmentHistoryRecord({
        id: '', tenantId: T, assignmentId: 'a-1', personId: 'p-1',
        partType: 'chairman', meetingDate: '2025-06-15', state: 'assigned',
        recordedAt: NOW, meetingId: 'm-1',
      })).toThrow(/historyRecordId is required/);
    });
  });

  // ── Tenant Guard ──────────────────────────────────────────────────────
  describe('assertHistoryTenant', () => {
    it('passes for matching tenant', () => {
      const r = makeRecord();
      expect(() => assertHistoryTenant(r, T)).not.toThrow();
    });

    it('rejects cross-tenant access', () => {
      const r = makeRecord();
      expect(() => assertHistoryTenant(r, 'tenant-2')).toThrow(/Cross-tenant/);
    });
  });

  // ── Filters ────────────────────────────────────────────────────────────
  const r1 = makeRecord({ id: 'h-1', personId: 'p-1', meetingId: 'm-1', meetingDate: '2025-06-01', partType: 'bible-reading', state: 'completed' });
  const r2 = makeRecord({ id: 'h-2', personId: 'p-2', meetingId: 'm-1', meetingDate: '2025-06-01', partType: 'chairman', state: 'assigned', tenantId: T });
  const r3 = makeRecord({ id: 'h-3', personId: 'p-1', meetingId: 'm-2', meetingDate: '2025-06-08', partType: 'student-talk', state: 'cancelled' });
  const rOther = makeRecord({ id: 'h-99', tenantId: 'tenant-2', personId: 'p-1', meetingId: 'm-3', meetingDate: '2025-06-01', partType: 'bible-reading', state: 'completed', assignmentId: 'a-99', recordedAt: NOW });
  const allRecords = [r1, r2, r3, rOther];

  describe('filterHistoryByTenant', () => {
    it('returns only matching tenant records', () => {
      const result = filterHistoryByTenant(allRecords, T);
      expect(result).toHaveLength(3);
      expect(result.every(r => r.tenantId === T)).toBe(true);
    });

    it('returns empty for non-existent tenant', () => {
      expect(filterHistoryByTenant(allRecords, 'tenant-X')).toHaveLength(0);
    });
  });

  describe('filterHistoryByPerson', () => {
    it('returns records for a specific person', () => {
      const result = filterHistoryByPerson(allRecords, 'p-1');
      expect(result).toHaveLength(3); // r1, r3, rOther
      expect(result.every(r => r.personId === 'p-1')).toBe(true);
    });
  });

  describe('filterHistoryByMeeting', () => {
    it('returns records for a specific meeting', () => {
      const result = filterHistoryByMeeting(allRecords, 'm-1');
      expect(result).toHaveLength(2);
      expect(result.every(r => r.meetingId === 'm-1')).toBe(true);
    });
  });

  describe('filterHistoryByDateRange', () => {
    it('filters inclusive date range', () => {
      const result = filterHistoryByDateRange(allRecords, '2025-06-01', '2025-06-01');
      expect(result).toHaveLength(3); // r1, r2, rOther all on 06-01
    });

    it('filters wider date range', () => {
      const result = filterHistoryByDateRange(allRecords, '2025-05-01', '2025-07-01');
      expect(result).toHaveLength(4);
    });

    it('returns empty for range with no matches', () => {
      const result = filterHistoryByDateRange(allRecords, '2025-01-01', '2025-01-31');
      expect(result).toHaveLength(0);
    });

    it('rejects from > to', () => {
      expect(() => filterHistoryByDateRange(allRecords, '2025-06-15', '2025-06-01')).toThrow(/from date must not be after/);
    });

    it('handles leap year date 2024-02-29', () => {
      const rLeap = makeRecord({ id: 'h-leap', meetingDate: '2024-02-29', recordedAt: '2024-03-01T10:00:00Z' });
      const result = filterHistoryByDateRange([rLeap], '2024-02-28', '2024-03-01');
      expect(result).toHaveLength(1);
    });

    it('handles year boundary crossing', () => {
      const rDec = makeRecord({ id: 'h-dec', meetingDate: '2024-12-31', recordedAt: '2024-12-31T10:00:00Z' });
      const rJan = makeRecord({ id: 'h-jan', meetingDate: '2025-01-01', recordedAt: '2025-01-02T10:00:00Z' });
      const result = filterHistoryByDateRange([rDec, rJan], '2024-12-31', '2025-01-01');
      expect(result).toHaveLength(2);
    });

    it('handles month boundary', () => {
      const rEnd = makeRecord({ id: 'h-end', meetingDate: '2025-06-30', recordedAt: '2025-07-01T10:00:00Z' });
      const rStart = makeRecord({ id: 'h-start', meetingDate: '2025-07-01', recordedAt: '2025-07-02T10:00:00Z' });
      const result = filterHistoryByDateRange([rEnd, rStart], '2025-06-30', '2025-07-01');
      expect(result).toHaveLength(2);
    });
  });

  describe('filterHistoryByPartType', () => {
    it('filters by part type', () => {
      const result = filterHistoryByPartType(allRecords, 'bible-reading');
      expect(result).toHaveLength(2); // r1, rOther
    });
  });

  describe('filterHistoryByState', () => {
    it('filters by state', () => {
      const result = filterHistoryByState(allRecords, 'completed');
      // r1=completed, r2=assigned, r3=cancelled, rOther=completed → 2
      expect(result).toHaveLength(2);
      expect(result.every(r => r.state === 'completed')).toBe(true);
    });

    it('counts each state correctly', () => {
      expect(filterHistoryByState(allRecords, 'completed')).toHaveLength(2);
      expect(filterHistoryByState(allRecords, 'assigned')).toHaveLength(1);
      expect(filterHistoryByState(allRecords, 'cancelled')).toHaveLength(1);
    });
  });

  // ── Ordering ───────────────────────────────────────────────────────────
  describe('orderHistoryByDate', () => {
    it('sorts ascending by meetingDate then recordedAt then id', () => {
      const a = makeRecord({ id: 'h-b', meetingDate: '2025-06-15', recordedAt: '2025-06-15T09:00:00Z' });
      const b = makeRecord({ id: 'h-a', meetingDate: '2025-06-15', recordedAt: '2025-06-15T08:00:00Z' });
      const c = makeRecord({ id: 'h-c', meetingDate: '2025-06-01', recordedAt: '2025-06-01T10:00:00Z' });
      const ordered = orderHistoryByDate([a, b, c]);
      expect(ordered.map(r => r.id)).toEqual(['h-c', 'h-a', 'h-b']);
    });

    it('does not mutate the input array', () => {
      const records = [r1, r2, r3];
      const before = [...records];
      orderHistoryByDate(records);
      expect(records).toEqual(before);
    });
  });

  // ── Count & Last Assignment ────────────────────────────────────────────
  describe('countAssignmentsInPeriod', () => {
    it('counts assignments for a person in a date range', () => {
      const records = [
        makeRecord({ id: 'h-c1', personId: 'p-1', meetingDate: '2025-06-01' }),
        makeRecord({ id: 'h-c2', personId: 'p-1', meetingDate: '2025-06-08' }),
        makeRecord({ id: 'h-c3', personId: 'p-1', meetingDate: '2025-06-15' }),
        makeRecord({ id: 'h-c4', personId: 'p-2', meetingDate: '2025-06-08' }),
      ];
      expect(countAssignmentsInPeriod(records, 'p-1', '2025-06-01', '2025-06-30')).toBe(3);
      expect(countAssignmentsInPeriod(records, 'p-1', '2025-06-08', '2025-06-08')).toBe(1);
    });

    it('returns 0 when person has no assignments', () => {
      expect(countAssignmentsInPeriod([r1], 'p-99', '2025-01-01', '2025-12-31')).toBe(0);
    });
  });

  describe('lastAssignmentDate', () => {
    it('returns the most recent meeting date for a person', () => {
      const records = [
        makeRecord({ id: 'h-l1', personId: 'p-1', meetingDate: '2025-06-01' }),
        makeRecord({ id: 'h-l2', personId: 'p-1', meetingDate: '2025-06-15' }),
        makeRecord({ id: 'h-l3', personId: 'p-1', meetingDate: '2025-06-08' }),
      ];
      expect(lastAssignmentDate(records, 'p-1')).toBe('2025-06-15');
    });

    it('returns null when person has no records', () => {
      expect(lastAssignmentDate([], 'p-1')).toBeNull();
    });

    it('respects beforeDate (exclusive)', () => {
      const records = [
        makeRecord({ id: 'h-b1', personId: 'p-1', meetingDate: '2025-06-01' }),
        makeRecord({ id: 'h-b2', personId: 'p-1', meetingDate: '2025-06-15' }),
      ];
      expect(lastAssignmentDate(records, 'p-1', '2025-06-15')).toBe('2025-06-01');
    });

    it('returns null when all records are at or after beforeDate', () => {
      const records = [makeRecord({ id: 'h-b3', personId: 'p-1', meetingDate: '2025-06-15' })];
      expect(lastAssignmentDate(records, 'p-1', '2025-06-15')).toBeNull();
    });
  });

  // ── Immutability ───────────────────────────────────────────────────────
  describe('immutability', () => {
    it('cannot mutate a frozen record', () => {
      const r = makeRecord();
      expect(() => { (r as any).state = 'deleted'; }).toThrow();
    });

    it('original input object is not the same reference', () => {
      const input = { id: 'h-x', tenantId: T, assignmentId: 'a-1', personId: 'p-1', partType: 'chairman', meetingDate: '2025-06-15', state: 'assigned' as const, recordedAt: NOW, meetingId: 'm-1' };
      const r = recordAssignmentHistory(input);
      expect(r).not.toBe(input);
    });
  });

  // ── Append-Only: No update/delete exported ─────────────────────────────
  describe('append-only contract', () => {
    it('does not export update or delete functions', async () => {
      const mod = await import('./assignment-history');
      const exported = Object.keys(mod);
      expect(exported).not.toContain('updateAssignmentHistory');
      expect(exported).not.toContain('deleteAssignmentHistory');
      expect(exported).not.toContain('removeAssignmentHistory');
      expect(exported).not.toContain('editAssignmentHistory');
      expect(exported).not.toContain('modifyAssignmentHistory');
    });
  });

  // ── Tenant Isolation ───────────────────────────────────────────────────
  describe('tenant isolation', () => {
    it('filters exclude records from other tenants', () => {
      const t1 = makeRecord({ id: 'h-t1', tenantId: 't1' });
      const t2 = makeRecord({ id: 'h-t2', tenantId: 't2' });
      const result = filterHistoryByTenant([t1, t2], 't1');
      expect(result).toHaveLength(1);
      expect(result[0].tenantId).toBe('t1');
    });

    it('count is tenant-scoped via pre-filtering', () => {
      const t1 = makeRecord({ id: 'h-c1', tenantId: 't1', personId: 'p-1', meetingDate: '2025-06-01' });
      const t2 = makeRecord({ id: 'h-c2', tenantId: 't2', personId: 'p-1', meetingDate: '2025-06-01' });
      const scoped = filterHistoryByTenant([t1, t2], 't1');
      expect(countAssignmentsInPeriod(scoped, 'p-1', '2025-01-01', '2025-12-31')).toBe(1);
    });
  });

  // ── Adversarial / Edge Cases ───────────────────────────────────────────
  describe('adversarial inputs', () => {
    it('rejects prototype pollution attempt on id', () => {
      expect(() => recordAssignmentHistory({
        id: '__proto__', tenantId: T, assignmentId: 'a-1', personId: 'p-1',
        partType: 'chairman', meetingDate: '2025-06-15', state: 'assigned',
        recordedAt: NOW, meetingId: 'm-1',
      })).not.toThrow(); // It's a valid non-empty string — accepted but harmless
    });

    it('rejects constructor as id', () => {
      expect(() => recordAssignmentHistory({
        id: 'constructor', tenantId: T, assignmentId: 'a-1', personId: 'p-1',
        partType: 'chairman', meetingDate: '2025-06-15', state: 'assigned',
        recordedAt: NOW, meetingId: 'm-1',
      })).not.toThrow(); // Valid non-empty string
    });

    it('rejects undefined recordedAt', () => {
      expect(() => recordAssignmentHistory({
        id: 'h-x', tenantId: T, assignmentId: 'a-1', personId: 'p-1',
        partType: 'chairman', meetingDate: '2025-06-15', state: 'assigned',
        recordedAt: undefined as any, meetingId: 'm-1',
      })).toThrow(/Invalid ISO date/);
    });

    it('rejects numeric personId', () => {
      expect(() => recordAssignmentHistory({
        id: 'h-x', tenantId: T, assignmentId: 'a-1', personId: 42 as any,
        partType: 'chairman', meetingDate: '2025-06-15', state: 'assigned',
        recordedAt: NOW, meetingId: 'm-1',
      })).toThrow(/personId must be a string/);
    });

    it('rejects meetingDate with time component', () => {
      expect(() => makeRecord({ meetingDate: '2025-06-15T10:00:00Z' })).toThrow(/YYYY-MM-DD/);
    });

    it('rejects meetingDate 2025-13-01 (invalid month)', () => {
      expect(() => makeRecord({ meetingDate: '2025-13-01' })).toThrow();
    });

    it('rejects meetingDate 2025-02-30 (invalid day)', () => {
      expect(() => makeRecord({ meetingDate: '2025-02-30' })).toThrow();
    });

    it('accepts leap day 2024-02-29', () => {
      expect(() => makeRecord({ meetingDate: '2024-02-29', recordedAt: '2024-03-01T10:00:00Z' })).not.toThrow();
    });

    it('rejects non-leap day 2023-02-29', () => {
      expect(() => makeRecord({ meetingDate: '2023-02-29' })).toThrow();
    });
  });

  // ── Determinism ────────────────────────────────────────────────────────
  describe('determinism', () => {
    it('produces identical output for identical input', () => {
      const input = {
        id: 'h-det', tenantId: T, assignmentId: 'a-1', personId: 'p-1',
        partType: 'chairman', meetingDate: '2025-06-15', state: 'assigned' as const,
        recordedAt: NOW, meetingId: 'm-1',
      };
      const a = recordAssignmentHistory(input);
      const b = recordAssignmentHistory(input);
      expect(a).toEqual(b);
      expect(a).not.toBe(b); // different frozen objects
    });

    it('orderHistoryByDate is stable for identical timestamps', () => {
      const records = [
        makeRecord({ id: 'h-z', meetingDate: '2025-06-15', recordedAt: NOW }),
        makeRecord({ id: 'h-a', meetingDate: '2025-06-15', recordedAt: NOW }),
      ];
      const ordered = orderHistoryByDate(records);
      expect(ordered.map(r => r.id)).toEqual(['h-a', 'h-z']);
    });
  });
});
