import { describe, expect, it } from 'vitest';
import { detectSchedulingConflicts, type ConflictAssignment, type UnavailableInterval } from './conflict-engine';

const base = { tenantId: 'tenant-a', personId: 'person-1' } as const;
const candidate: ConflictAssignment = { ...base, assignmentId: 'candidate', startsAt: '2026-08-25T10:00:00Z', endsAt: '2026-08-25T11:00:00Z' };

function unavailable(sourceId: string, startsAt: string, endsAt: string, tenantId = 'tenant-a', personId = 'person-1'): UnavailableInterval {
  return { tenantId, personId, sourceId, startsAt, endsAt };
}

describe('KP4 conflict reporting', () => {
  it('reports no conflict for disjoint windows', () => {
    const result = detectSchedulingConflicts({ tenantId: 'tenant-a', candidate, assignments: [{ ...base, assignmentId: 'other', startsAt: '2026-08-25T11:00:00Z', endsAt: '2026-08-25T12:00:00Z' }], unavailable: [] });
    expect(result).toEqual([]);
  });

  it('reports full and partial assignment overlaps for the same person', () => {
    const result = detectSchedulingConflicts({
      tenantId: 'tenant-a', candidate,
      assignments: [
        { ...base, assignmentId: 'full', startsAt: '2026-08-25T09:00:00Z', endsAt: '2026-08-25T12:00:00Z' },
        { ...base, assignmentId: 'partial', startsAt: '2026-08-25T10:30:00Z', endsAt: '2026-08-25T11:30:00Z' },
      ], unavailable: [],
    });
    expect(result).toEqual([
      { kind: 'assignment-overlap', tenantId: 'tenant-a', personId: 'person-1', sourceId: 'full' },
      { kind: 'assignment-overlap', tenantId: 'tenant-a', personId: 'person-1', sourceId: 'partial' },
    ]);
  });

  it('does not create a conflict for a different person', () => {
    const result = detectSchedulingConflicts({ tenantId: 'tenant-a', candidate, assignments: [{ ...base, personId: 'person-2', assignmentId: 'other', startsAt: candidate.startsAt, endsAt: candidate.endsAt }], unavailable: [] });
    expect(result).toEqual([]);
  });

  it('ignores foreign-tenant assignments even when logical ids are identical', () => {
    const result = detectSchedulingConflicts({
      tenantId: 'tenant-a',
      candidate: { ...candidate, assignmentId: 'shared-id' },
      assignments: [{ ...base, tenantId: 'tenant-b', assignmentId: 'shared-id', startsAt: candidate.startsAt, endsAt: candidate.endsAt }],
      unavailable: [unavailable('shared-away', candidate.startsAt, candidate.endsAt, 'tenant-b')],
    });
    expect(result).toEqual([]);
  });

  it('reports away/unavailable overlap as a hard constraint', () => {
    const result = detectSchedulingConflicts({ tenantId: 'tenant-a', candidate, assignments: [], unavailable: [unavailable('away-1', '2026-08-25T10:30:00Z', '2026-08-25T12:00:00Z')] });
    expect(result).toEqual([{ kind: 'unavailable', tenantId: 'tenant-a', personId: 'person-1', sourceId: 'away-1' }]);
  });

  it('uses [start,end) semantics at boundaries', () => {
    const result = detectSchedulingConflicts({
      tenantId: 'tenant-a',
      candidate,
      assignments: [{ ...base, assignmentId: 'touching', startsAt: '2026-08-25T11:00:00Z', endsAt: '2026-08-25T12:00:00Z' }],
      unavailable: [unavailable('touching-away', '2026-08-25T09:00:00Z', '2026-08-25T10:00:00Z')],
    });
    expect(result).toEqual([]);
  });

  it('orders multiple conflict reasons deterministically', () => {
    const input = {
      tenantId: 'tenant-a',
      candidate,
      assignments: [
        { ...base, assignmentId: 'z-assignment', startsAt: '2026-08-25T09:00:00Z', endsAt: '2026-08-25T12:00:00Z' },
        { ...base, assignmentId: 'a-assignment', startsAt: '2026-08-25T09:30:00Z', endsAt: '2026-08-25T11:30:00Z' },
      ],
      unavailable: [unavailable('b-away', '2026-08-25T09:00:00Z', '2026-08-25T12:00:00Z'), unavailable('a-away', '2026-08-25T09:00:00Z', '2026-08-25T12:00:00Z')],
    };
    const first = detectSchedulingConflicts(input);
    const second = detectSchedulingConflicts({ ...input, assignments: [...input.assignments].reverse(), unavailable: [...input.unavailable].reverse() });
    expect(first).toEqual(second);
    expect(first.map(item => item.sourceId)).toEqual(['a-assignment', 'z-assignment', 'a-away', 'b-away']);
  });

  it('does not mutate candidate, assignments or unavailable inputs', () => {
    const assignments: ConflictAssignment[] = [{ ...base, assignmentId: 'other', startsAt: candidate.startsAt, endsAt: candidate.endsAt }];
    const unavailablePeriods = [unavailable('away', candidate.startsAt, candidate.endsAt)];
    const before = structuredClone({ candidate, assignments, unavailable: unavailablePeriods });
    detectSchedulingConflicts({ tenantId: 'tenant-a', candidate, assignments, unavailable: unavailablePeriods });
    expect({ candidate, assignments, unavailable: unavailablePeriods }).toEqual(before);
  });

  it('rejects a candidate whose tenant does not match the requested tenant', () => {
    expect(() => detectSchedulingConflicts({ tenantId: 'tenant-a', candidate: { ...candidate, tenantId: 'tenant-b' }, assignments: [], unavailable: [] })).toThrow('Cross-tenant candidate assignment access denied');
  });

  it('rejects malformed windows instead of silently ignoring them', () => {
    expect(() => detectSchedulingConflicts({ tenantId: 'tenant-a', candidate: { ...candidate, endsAt: candidate.startsAt }, assignments: [], unavailable: [] })).toThrow('Conflict window must end after it starts');
    expect(() => detectSchedulingConflicts({ tenantId: 'tenant-a', candidate, assignments: [{ ...base, assignmentId: 'bad', startsAt: 'bad', endsAt: candidate.endsAt }], unavailable: [] })).toThrow('startsAt must be an ISO instant');
  });
});
