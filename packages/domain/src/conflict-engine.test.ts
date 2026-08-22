import { describe, expect, it } from 'vitest';
import { detectSchedulingConflicts, hasSchedulingConflict } from './conflict-engine';

const candidate = {
  tenantId: 'tenant-a', assignmentId: 'new', personId: 'p1',
  startsAt: '2026-08-21T18:00:00.000Z', endsAt: '2026-08-21T19:00:00.000Z',
};

describe('detectSchedulingConflicts', () => {
  it('detects same-tenant assignment overlap', () => {
    const conflicts = detectSchedulingConflicts({ tenantId: 'tenant-a', candidate, assignments: [
      { ...candidate, assignmentId: 'old', startsAt: '2026-08-21T18:30:00.000Z', endsAt: '2026-08-21T19:30:00.000Z' },
    ], unavailable: [] });
    expect(conflicts).toEqual([{ kind: 'assignment-overlap', tenantId: 'tenant-a', personId: 'p1', sourceId: 'old' }]);
  });

  it('ignores assignment from another tenant even with same person id', () => {
    expect(hasSchedulingConflict({ tenantId: 'tenant-a', candidate, assignments: [
      { ...candidate, tenantId: 'tenant-b', assignmentId: 'other' },
    ], unavailable: [] })).toBe(false);
  });

  it('detects same-tenant unavailable interval and ignores another tenant', () => {
    const conflicts = detectSchedulingConflicts({ tenantId: 'tenant-a', candidate, assignments: [], unavailable: [
      { tenantId: 'tenant-b', personId: 'p1', sourceId: 'b', startsAt: candidate.startsAt, endsAt: candidate.endsAt },
      { tenantId: 'tenant-a', personId: 'p1', sourceId: 'a', startsAt: candidate.startsAt, endsAt: candidate.endsAt },
    ] });
    expect(conflicts.map(x => x.sourceId)).toEqual(['a']);
  });

  it('allows adjacent windows', () => {
    expect(hasSchedulingConflict({ tenantId: 'tenant-a', candidate, assignments: [
      { ...candidate, assignmentId: 'old', startsAt: '2026-08-21T17:00:00.000Z', endsAt: candidate.startsAt },
    ], unavailable: [] })).toBe(false);
  });

  it('rejects a candidate from a different tenant', () => {
    expect(() => detectSchedulingConflicts({ tenantId: 'tenant-a', candidate: { ...candidate, tenantId: 'tenant-b' }, assignments: [], unavailable: [] }))
      .toThrow('Cross-tenant candidate assignment access denied');
  });

  it('rejects malformed or inverted windows', () => {
    expect(() => detectSchedulingConflicts({ tenantId: 'tenant-a', candidate: { ...candidate, endsAt: candidate.startsAt }, assignments: [], unavailable: [] }))
      .toThrow('must end after');
  });

  it('does not mutate inputs and freezes results', () => {
    const assignments = [{ ...candidate, assignmentId: 'old', startsAt: candidate.startsAt, endsAt: candidate.endsAt }];
    const before = JSON.stringify(assignments);
    const result = detectSchedulingConflicts({ tenantId: 'tenant-a', candidate, assignments, unavailable: [] });
    expect(JSON.stringify(assignments)).toBe(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result[0])).toBe(true);
  });
});


it('does not produce a false conflict from a foreign tenant with the same logical person id', () => {
  const conflicts = detectSchedulingConflicts({
    tenantId: 'tenant-a',
    candidate,
    assignments: [{ ...candidate, tenantId: 'tenant-b', assignmentId: 'foreign-duty', startsAt: '2026-08-21T18:15:00.000Z', endsAt: '2026-08-21T18:45:00.000Z' }],
    unavailable: [{ tenantId: 'tenant-b', personId: 'p1', sourceId: 'foreign-away', startsAt: candidate.startsAt, endsAt: candidate.endsAt }],
  });
  expect(conflicts).toEqual([]);
});
