import { describe, it, expect } from 'vitest';
import {
  detectConflicts,
  hasConflict,
  type SchedulingAssignment,
  type Conflict,
  type UnavailablePeriod,
  type ConflictDetectionOptions,
} from './conflict-engine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const T = 'tenant-1';
const T2 = 'tenant-2';
const MEETING = 'meeting-1';
const DATE = '2026-01-15';

function makeAssignment(overrides: Partial<SchedulingAssignment> & { id: string; slotId: string; personId: string }): SchedulingAssignment {
  return Object.freeze({
    tenantId: T,
    meetingId: MEETING,
    meetingDate: DATE,
    startTime: '09:00',
    endTime: '10:00',
    ...overrides,
  });
}

// ─── Simple property-based testing helper ────────────────────────────────────

/** Simple seeded PRNG (LCG) for deterministic property-based tests */
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function randomItem<T>(rng: () => number, arr: readonly T[]): T {
  return arr[randomInt(rng, 0, arr.length - 1)]!;
}

function randomHhMm(rng: () => number): string {
  const h = randomInt(rng, 0, 23);
  const m = randomInt(rng, 0, 59);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function randomDate(rng: () => number): string {
  const y = randomInt(rng, 2024, 2030);
  const mo = randomInt(rng, 1, 12);
  const d = randomInt(rng, 1, 28);
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function generateRandomAssignments(rng: () => number, count: number): SchedulingAssignment[] {
  const assignments: SchedulingAssignment[] = [];
  for (let i = 0; i < count; i++) {
    const startMin = randomInt(rng, 0, 20) * 60;
    const duration = randomInt(rng, 30, 120);
    const sh = Math.floor(startMin / 60);
    const sm = startMin % 60;
    const eh = Math.floor((startMin + duration) / 60);
    const em = (startMin + duration) % 60;
    assignments.push(Object.freeze({
      id: `asgn-${i}`,
      tenantId: `tenant-${randomInt(rng, 1, 5)}`,
      meetingId: `meeting-${randomInt(rng, 1, 5)}`,
      slotId: `slot-${randomInt(rng, 1, 10)}`,
      personId: `person-${randomInt(rng, 1, 10)}`,
      meetingDate: randomDate(rng),
      startTime: `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`,
      endTime: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`,
      classId: rng() > 0.7 ? `class-${randomInt(rng, 1, 3)}` : undefined,
    }));
  }
  return assignments;
}

// ─── 1. No conflicts when none exist ─────────────────────────────────────────

describe('no conflicts when none exist', () => {
  it('empty assignments produce no conflicts', () => {
    expect(detectConflicts([])).toEqual([]);
  });

  it('single assignment produces no conflicts', () => {
    const a = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1' });
    expect(detectConflicts([a])).toEqual([]);
  });

  it('multiple people in same slot no conflict', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's1', personId: 'p2' });
    expect(detectConflicts([a1, a2])).toEqual([]);
  });

  it('same person in different meetings no conflict', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', meetingId: 'm1' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', meetingId: 'm2' });
    expect(detectConflicts([a1, a2])).toEqual([]);
  });

  it('same person different dates no conflict', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', meetingDate: '2026-01-15' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', meetingDate: '2026-01-22' });
    expect(detectConflicts([a1, a2])).toEqual([]);
  });

  it('same person adjacent non-overlapping slots no conflict', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:00' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', startTime: '10:00', endTime: '11:00' });
    expect(detectConflicts([a1, a2])).toEqual([]);
  });

  it('no conflicts with empty unavailable periods', () => {
    const a = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1' });
    expect(detectConflicts([a], [])).toEqual([]);
  });

  it('no conflicts with empty options', () => {
    const a = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1' });
    expect(detectConflicts([a], [], {})).toEqual([]);
  });
});

// ─── 2. Duplicate detection ──────────────────────────────────────────────────

describe('duplicate assignment detection', () => {
  it('detects exact duplicate (same person + slot + meeting)', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's1', personId: 'p1' });
    const conflicts = detectConflicts([a1, a2]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.type).toBe('duplicate-assignment');
    expect(conflicts[0]!.assignmentIds).toEqual(['a1', 'a2']);
  });

  it('detects triple duplicate', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's1', personId: 'p1' });
    const a3 = makeAssignment({ id: 'a3', slotId: 's1', personId: 'p1' });
    const conflicts = detectConflicts([a1, a2, a3]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.assignmentIds).toEqual(['a1', 'a2', 'a3']);
  });

  it('no duplicate for different people same slot', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's1', personId: 'p2' });
    const conflicts = detectConflicts([a1, a2]);
    expect(conflicts.filter((c) => c.type === 'duplicate-assignment')).toHaveLength(0);
  });

  it('no duplicate for different slots same person', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1' });
    const conflicts = detectConflicts([a1, a2]);
    expect(conflicts.filter((c) => c.type === 'duplicate-assignment')).toHaveLength(0);
  });

  it('duplicate description contains meeting and slot info', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's1', personId: 'p1' });
    const conflicts = detectConflicts([a1, a2]);
    expect(conflicts[0]!.description).toContain('meeting-1');
    expect(conflicts[0]!.description).toContain('s1');
  });
});

// ─── 3. Time overlap detection ───────────────────────────────────────────────

describe('time overlap detection', () => {
  it('detects partial time overlap', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:30' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', startTime: '10:00', endTime: '11:00' });
    const conflicts = detectConflicts([a1, a2]);
    expect(conflicts.some((c) => c.type === 'same-person-time-overlap')).toBe(true);
  });

  it('detects contained time range', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '12:00' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', startTime: '10:00', endTime: '11:00' });
    const conflicts = detectConflicts([a1, a2]);
    expect(conflicts.some((c) => c.type === 'same-person-time-overlap')).toBe(true);
  });

  it('detects exact time overlap', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:00' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', startTime: '09:00', endTime: '10:00' });
    const conflicts = detectConflicts([a1, a2]);
    expect(conflicts.some((c) => c.type === 'same-person-time-overlap')).toBe(true);
  });

  it('adjacent slots (back-to-back) are NOT overlapping', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:00' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', startTime: '10:00', endTime: '11:00' });
    const conflicts = detectConflicts([a1, a2]);
    expect(conflicts.some((c) => c.type === 'same-person-time-overlap')).toBe(false);
  });

  it('non-overlapping slots produce no conflict', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:00' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', startTime: '14:00', endTime: '15:00' });
    const conflicts = detectConflicts([a1, a2]);
    expect(conflicts.some((c) => c.type === 'same-person-time-overlap')).toBe(false);
  });

  it('same slot does not produce time overlap (it is a duplicate instead)', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:00' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:00' });
    const conflicts = detectConflicts([a1, a2]);
    expect(conflicts.some((c) => c.type === 'same-person-time-overlap')).toBe(false);
    expect(conflicts.some((c) => c.type === 'duplicate-assignment')).toBe(true);
  });

  it('overlap description contains time ranges and date', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:30' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', startTime: '10:00', endTime: '11:00' });
    const conflicts = detectConflicts([a1, a2]);
    const overlap = conflicts.find((c) => c.type === 'same-person-time-overlap')!;
    expect(overlap.description).toContain('09:00-10:30');
    expect(overlap.description).toContain('10:00-11:00');
    expect(overlap.description).toContain('2026-01-15');
  });

  it('detects multiple overlapping pairs for same person', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '11:00' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', startTime: '10:00', endTime: '12:00' });
    const a3 = makeAssignment({ id: 'a3', slotId: 's3', personId: 'p1', startTime: '10:30', endTime: '11:30' });
    const conflicts = detectConflicts([a1, a2, a3]);
    const overlaps = conflicts.filter((c) => c.type === 'same-person-time-overlap');
    expect(overlaps.length).toBeGreaterThanOrEqual(3); // a1-a2, a1-a3, a2-a3
  });
});

// ─── 4. Incompatible slot detection ──────────────────────────────────────────

describe('incompatible slot detection', () => {
  it('detects exclusive slot pair conflict', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 'chairman', personId: 'p1' });
    const a2 = makeAssignment({ id: 'a2', slotId: 'speaker', personId: 'p1' });
    const conflicts = detectConflicts([a1, a2], [], { exclusiveSlotPairs: [['chairman', 'speaker']] });
    expect(conflicts.some((c) => c.type === 'same-person-incompatible-slots')).toBe(true);
  });

  it('no conflict for non-exclusive slot pair', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', startTime: '14:00', endTime: '15:00' });
    const conflicts = detectConflicts([a1, a2], [], { exclusiveSlotPairs: [['chairman', 'speaker']] });
    expect(conflicts.some((c) => c.type === 'same-person-incompatible-slots')).toBe(false);
  });

  it('exclusive pair works in both directions', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 'speaker', personId: 'p1' });
    const a2 = makeAssignment({ id: 'a2', slotId: 'chairman', personId: 'p1', startTime: '14:00', endTime: '15:00' });
    const conflicts = detectConflicts([a1, a2], [], { exclusiveSlotPairs: [['chairman', 'speaker']] });
    expect(conflicts.some((c) => c.type === 'same-person-incompatible-slots')).toBe(true);
  });

  it('multiple exclusive pairs', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', startTime: '14:00', endTime: '15:00' });
    const a3 = makeAssignment({ id: 'a3', slotId: 's3', personId: 'p1', startTime: '16:00', endTime: '17:00' });
    const conflicts = detectConflicts([a1, a2, a3], [], { exclusiveSlotPairs: [['s1', 's2'], ['s1', 's3']] });
    const incompat = conflicts.filter((c) => c.type === 'same-person-incompatible-slots');
    expect(incompat).toHaveLength(2);
  });

  it('no exclusive pairs in options means no incompatible-slot conflicts', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', startTime: '14:00', endTime: '15:00' });
    const conflicts = detectConflicts([a1, a2], [], {});
    expect(conflicts.some((c) => c.type === 'same-person-incompatible-slots')).toBe(false);
  });

  it('incompatible slots description is informative', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 'chairman', personId: 'p1' });
    const a2 = makeAssignment({ id: 'a2', slotId: 'speaker', personId: 'p1', startTime: '14:00', endTime: '15:00' });
    const conflicts = detectConflicts([a1, a2], [], { exclusiveSlotPairs: [['chairman', 'speaker']] });
    const inc = conflicts.find((c) => c.type === 'same-person-incompatible-slots')!;
    expect(inc.description).toContain('chairman');
    expect(inc.description).toContain('speaker');
  });
});

// ─── 5. Simultaneous class detection ─────────────────────────────────────────

describe('simultaneous class detection', () => {
  it('detects two different classes for same person at same meeting', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', classId: 'class-A' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', classId: 'class-B' });
    const conflicts = detectConflicts([a1, a2]);
    expect(conflicts.some((c) => c.type === 'same-person-simultaneous-classes')).toBe(true);
  });

  it('no conflict for same class (same class ID)', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', classId: 'class-A' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', classId: 'class-A', startTime: '14:00', endTime: '15:00' });
    const conflicts = detectConflicts([a1, a2]);
    expect(conflicts.some((c) => c.type === 'same-person-simultaneous-classes')).toBe(false);
  });

  it('no conflict when no classId assigned', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', startTime: '14:00', endTime: '15:00' });
    const conflicts = detectConflicts([a1, a2]);
    expect(conflicts.some((c) => c.type === 'same-person-simultaneous-classes')).toBe(false);
  });

  it('no conflict when only one assignment has a classId', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', classId: 'class-A' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', startTime: '14:00', endTime: '15:00' });
    const conflicts = detectConflicts([a1, a2]);
    expect(conflicts.some((c) => c.type === 'same-person-simultaneous-classes')).toBe(false);
  });

  it('detects three different classes (3 conflicts for C(3,2) pairs)', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', classId: 'class-A' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', classId: 'class-B' });
    const a3 = makeAssignment({ id: 'a3', slotId: 's3', personId: 'p1', classId: 'class-C' });
    const conflicts = detectConflicts([a1, a2, a3]);
    const classConflicts = conflicts.filter((c) => c.type === 'same-person-simultaneous-classes');
    expect(classConflicts).toHaveLength(3);
  });

  it('class conflict description contains class IDs and date', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', classId: 'class-A' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', classId: 'class-B' });
    const conflicts = detectConflicts([a1, a2]);
    const cc = conflicts.find((c) => c.type === 'same-person-simultaneous-classes')!;
    expect(cc.description).toContain('class-A');
    expect(cc.description).toContain('class-B');
    expect(cc.description).toContain('2026-01-15');
  });
});

// ─── 6. Person unavailability detection ──────────────────────────────────────

describe('person unavailability detection', () => {
  it('detects person unavailable during assignment', () => {
    const a = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:00' });
    const unavail: UnavailablePeriod[] = [
      { personId: 'p1', startsAt: '2026-01-15T08:00:00Z', endsAt: '2026-01-15T11:00:00Z' },
    ];
    const conflicts = detectConflicts([a], unavail);
    expect(conflicts.some((c) => c.type === 'person-unavailable')).toBe(true);
  });

  it('no conflict when unavailability is outside meeting time', () => {
    const a = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:00' });
    const unavail: UnavailablePeriod[] = [
      { personId: 'p1', startsAt: '2026-01-15T12:00:00Z', endsAt: '2026-01-15T18:00:00Z' },
    ];
    const conflicts = detectConflicts([a], unavail);
    expect(conflicts.some((c) => c.type === 'person-unavailable')).toBe(false);
  });

  it('no conflict when unavailability is for a different person', () => {
    const a = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:00' });
    const unavail: UnavailablePeriod[] = [
      { personId: 'p2', startsAt: '2026-01-15T08:00:00Z', endsAt: '2026-01-15T11:00:00Z' },
    ];
    const conflicts = detectConflicts([a], unavail);
    expect(conflicts.some((c) => c.type === 'person-unavailable')).toBe(false);
  });

  it('detects edge overlap (unavail starts at meeting end boundary — no overlap)', () => {
    // Meeting 09:00-10:00 UTC, unavail starts exactly at 10:00 UTC
    const a = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:00' });
    const unavail: UnavailablePeriod[] = [
      { personId: 'p1', startsAt: '2026-01-15T10:00:00Z', endsAt: '2026-01-15T12:00:00Z' },
    ];
    const conflicts = detectConflicts([a], unavail);
    expect(conflicts.some((c) => c.type === 'person-unavailable')).toBe(false);
  });

  it('detects edge overlap (unavail ends at meeting start — no overlap)', () => {
    const a = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:00' });
    const unavail: UnavailablePeriod[] = [
      { personId: 'p1', startsAt: '2026-01-15T07:00:00Z', endsAt: '2026-01-15T09:00:00Z' },
    ];
    const conflicts = detectConflicts([a], unavail);
    expect(conflicts.some((c) => c.type === 'person-unavailable')).toBe(false);
  });

  it('overlaps when unavail starts one second before meeting end', () => {
    const a = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:00' });
    const unavail: UnavailablePeriod[] = [
      { personId: 'p1', startsAt: '2026-01-15T09:59:59Z', endsAt: '2026-01-15T11:00:00Z' },
    ];
    const conflicts = detectConflicts([a], unavail);
    expect(conflicts.some((c) => c.type === 'person-unavailable')).toBe(true);
  });

  it('unavailability description contains date and time', () => {
    const a = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:00' });
    const unavail: UnavailablePeriod[] = [
      { personId: 'p1', startsAt: '2026-01-15T08:00:00Z', endsAt: '2026-01-15T11:00:00Z' },
    ];
    const conflicts = detectConflicts([a], unavail);
    const uc = conflicts.find((c) => c.type === 'person-unavailable')!;
    expect(uc.description).toContain('2026-01-15');
    expect(uc.description).toContain('09:00-10:00');
  });
});

// ─── 7. Tenant isolation ─────────────────────────────────────────────────────

describe('tenant isolation', () => {
  it('conflicts only detected within same tenant', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', tenantId: T });
    const a2 = makeAssignment({ id: 'a2', slotId: 's1', personId: 'p1', tenantId: T2 });
    const conflicts = detectConflicts([a1, a2]);
    expect(conflicts).toHaveLength(0);
  });

  it('time overlap not detected across tenants', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', tenantId: T, startTime: '09:00', endTime: '10:30' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', tenantId: T2, startTime: '10:00', endTime: '11:00' });
    const conflicts = detectConflicts([a1, a2]);
    expect(conflicts).toHaveLength(0);
  });

  it('class conflict not detected across tenants', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', tenantId: T, classId: 'class-A' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', tenantId: T2, classId: 'class-B' });
    const conflicts = detectConflicts([a1, a2]);
    expect(conflicts).toHaveLength(0);
  });

  it('conflicts detected within same tenant', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', tenantId: T });
    const a2 = makeAssignment({ id: 'a2', slotId: 's1', personId: 'p1', tenantId: T });
    const conflicts = detectConflicts([a1, a2]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.type).toBe('duplicate-assignment');
  });

  it('three tenants: conflicts only in same tenant', () => {
    const T3 = 'tenant-3';
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', tenantId: T });
    const a2 = makeAssignment({ id: 'a2', slotId: 's1', personId: 'p1', tenantId: T }); // duplicate with a1
    const a3 = makeAssignment({ id: 'a3', slotId: 's1', personId: 'p1', tenantId: T2 });
    const a4 = makeAssignment({ id: 'a4', slotId: 's1', personId: 'p1', tenantId: T3 });
    const conflicts = detectConflicts([a1, a2, a3, a4]);
    expect(conflicts).toHaveLength(1); // only a1-a2
  });
});

// ─── 8. Multiple conflict types in one check ─────────────────────────────────

describe('multiple conflicts in one check', () => {
  it('detects duplicate + time overlap + incompatible slots simultaneously', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:30' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:30' }); // duplicate
    const a3 = makeAssignment({ id: 'a3', slotId: 's2', personId: 'p1', startTime: '10:00', endTime: '11:00' }); // time overlap + incompatible
    const unavail: UnavailablePeriod[] = [
      { personId: 'p1', startsAt: '2026-01-15T08:00:00Z', endsAt: '2026-01-15T11:00:00Z' },
    ];
    const conflicts = detectConflicts([a1, a2, a3], unavail, { exclusiveSlotPairs: [['s1', 's2']] });
    const types = new Set(conflicts.map((c) => c.type));
    expect(types.has('duplicate-assignment')).toBe(true);
    expect(types.has('same-person-time-overlap')).toBe(true);
    expect(types.has('same-person-incompatible-slots')).toBe(true);
    expect(types.has('person-unavailable')).toBe(true);
  });

  it('different people produce independent conflicts', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's1', personId: 'p1' }); // duplicate for p1
    const a3 = makeAssignment({ id: 'a3', slotId: 's2', personId: 'p2', classId: 'class-A' });
    const a4 = makeAssignment({ id: 'a4', slotId: 's3', personId: 'p2', classId: 'class-B' }); // class conflict for p2
    const conflicts = detectConflicts([a1, a2, a3, a4]);
    expect(conflicts.length).toBeGreaterThanOrEqual(2);
    const p1Conflict = conflicts.find((c) => c.personId === 'p1');
    const p2Conflict = conflicts.find((c) => c.personId === 'p2');
    expect(p1Conflict).toBeDefined();
    expect(p2Conflict).toBeDefined();
  });
});

// ─── 9. hasConflict ──────────────────────────────────────────────────────────

describe('hasConflict', () => {
  it('returns false when no conflict exists', () => {
    const existing = [makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1' })];
    expect(hasConflict(existing, 'p2', MEETING, DATE, '10:00', '11:00')).toBe(false);
  });

  it('returns true when duplicate would be created', () => {
    const existing = [makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1' })];
    expect(hasConflict(existing, 'p1', MEETING, DATE, '09:00', '10:00')).toBe(true);
  });

  it('returns true when time overlap would occur', () => {
    const existing = [makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:30' })];
    expect(hasConflict(existing, 'p1', MEETING, DATE, '10:00', '11:00')).toBe(true);
  });

  it('returns false for non-overlapping time', () => {
    const existing = [makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:00' })];
    expect(hasConflict(existing, 'p1', MEETING, DATE, '10:00', '11:00')).toBe(false);
  });

  it('returns true for incompatible slot', () => {
    const existing = [makeAssignment({ id: 'a1', slotId: 'chairman', personId: 'p1' })];
    expect(hasConflict(
      existing, 'p1', MEETING, DATE, '14:00', '15:00',
      'speaker', undefined, { exclusiveSlotPairs: [['chairman', 'speaker']] },
    )).toBe(true);
  });

  it('returns true when person is unavailable', () => {
    const existing: SchedulingAssignment[] = [];
    const unavail: UnavailablePeriod[] = [
      { personId: 'p1', startsAt: '2026-01-15T00:00:00Z', endsAt: '2026-01-15T23:59:59Z' },
    ];
    expect(hasConflict(existing, 'p1', MEETING, DATE, '09:00', '10:00', undefined, undefined, {}, unavail)).toBe(true);
  });
});

// ─── 10. Determinism ─────────────────────────────────────────────────────────

describe('determinism', () => {
  it('same inputs produce identical output (reference equality of frozen result)', () => {
    const assignments: SchedulingAssignment[] = [
      makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:30' }),
      makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', startTime: '10:00', endTime: '11:00' }),
    ];
    const unavail: UnavailablePeriod[] = [
      { personId: 'p1', startsAt: '2026-01-15T08:00:00Z', endsAt: '2026-01-15T11:00:00Z' },
    ];
    const options: ConflictDetectionOptions = { exclusiveSlotPairs: [['s1', 's2']] };
    const r1 = detectConflicts(assignments, unavail, options);
    const r2 = detectConflicts(assignments, unavail, options);
    // Pure function: same inputs produce structurally identical outputs
    expect(r1).toStrictEqual(r2);
    // Both results are frozen
    expect(Object.isFrozen(r1)).toBe(true);
    expect(Object.isFrozen(r2)).toBe(true);
  });

  it('detectConflicts returns frozen array', () => {
    const conflicts = detectConflicts([]);
    expect(Object.isFrozen(conflicts)).toBe(true);
  });

  it('each conflict object is frozen', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's1', personId: 'p1' });
    const conflicts = detectConflicts([a1, a2]);
    for (const c of conflicts) {
      expect(Object.isFrozen(c)).toBe(true);
    }
  });

  it('hasConflict is deterministic', () => {
    const assignments = [
      makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1' }),
    ];
    const r1 = hasConflict(assignments, 'p1', MEETING, DATE, '09:00', '10:00');
    const r2 = hasConflict(assignments, 'p1', MEETING, DATE, '09:00', '10:00');
    expect(r1).toBe(r2);
  });
});

// ─── 11. Adversarial / malformed inputs ──────────────────────────────────────

describe('adversarial and malformed inputs', () => {
  it('handles empty strings in time fields gracefully', () => {
    const a = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: '', endTime: '' });
    expect(() => detectConflicts([a])).not.toThrow();
    // Invalid times should not produce false time overlaps
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', startTime: '10:00', endTime: '11:00' });
    const conflicts = detectConflicts([a, a2]);
    expect(conflicts.some((c) => c.type === 'same-person-time-overlap')).toBe(false);
  });

  it('handles NaN-like time values gracefully', () => {
    const a = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', startTime: 'abc', endTime: 'def' });
    expect(() => detectConflicts([a])).not.toThrow();
  });

  it('handles malformed dates gracefully', () => {
    const a = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1', meetingDate: 'not-a-date' });
    expect(() => detectConflicts([a])).not.toThrow();
  });

  it('handles undefined optional fields', () => {
    const a: SchedulingAssignment = Object.freeze({
      id: 'a1', tenantId: T, meetingId: MEETING, meetingDate: DATE,
      slotId: 's1', personId: 'p1', startTime: '09:00', endTime: '10:00',
    });
    expect(() => detectConflicts([a])).not.toThrow();
  });

  it('handles null/undefined in exclusiveSlotPairs entries', () => {
    const a1 = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1' });
    const a2 = makeAssignment({ id: 'a2', slotId: 's2', personId: 'p1', startTime: '14:00', endTime: '15:00' });
    expect(() => detectConflicts([a1, a2], [], { exclusiveSlotPairs: [[null as any, 's2']] })).not.toThrow();
  });

  it('handles invalid ISO dates in unavailability gracefully', () => {
    const a = makeAssignment({ id: 'a1', slotId: 's1', personId: 'p1' });
    const unavail: UnavailablePeriod[] = [
      { personId: 'p1', startsAt: 'not-a-date', endsAt: 'also-not' },
    ];
    expect(() => detectConflicts([a], unavail)).not.toThrow();
  });

  it('empty conflict types are consistent', () => {
    const conflicts = detectConflicts([], [], {});
    expect(conflicts).toEqual([]);
    expect(Object.isFrozen(conflicts)).toBe(true);
  });

  it('assignment with missing tenantId is skipped', () => {
    const a = { id: 'a1', slotId: 's1', personId: 'p1', meetingId: 'm1', meetingDate: DATE, startTime: '09:00', endTime: '10:00' } as SchedulingAssignment;
    expect(() => detectConflicts([a])).not.toThrow();
  });
});

// ─── 12. Property-based tests ────────────────────────────────────────────────

describe('property-based tests', () => {
  it('no false positives: random non-conflicting assignments produce no conflicts', () => {
    const rng = makeRng(42);
    // Generate assignments with unique (tenant, meeting, date, person, slot) tuples
    const seen = new Set<string>();
    const assignments: SchedulingAssignment[] = [];
    for (let i = 0; i < 200; i++) {
      const tenant = `t-${randomInt(rng, 1, 20)}`;
      const meeting = `m-${randomInt(rng, 1, 20)}`;
      const date = randomDate(rng);
      const person = `p-${randomInt(rng, 1, 50)}`;
      const slot = `s-${randomInt(rng, 1, 30)}`;
      const key = `${tenant}|${meeting}|${date}|${person}|${slot}`;
      if (seen.has(key)) continue; // skip potential duplicates
      seen.add(key);
      const startMins = randomInt(rng, 0, 20) * 60;
      const endMins = startMins + randomInt(rng, 30, 120);
      const sh = Math.floor(startMins / 60);
      const sm = startMins % 60;
      const eh = Math.floor(endMins / 60);
      const em = endMins % 60;
      assignments.push(Object.freeze({
        id: `a-${i}`,
        tenantId: tenant,
        meetingId: meeting,
        slotId: slot,
        personId: person,
        meetingDate: date,
        startTime: `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`,
        endTime: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`,
      }));
    }
    const conflicts = detectConflicts(assignments);
    expect(conflicts).toHaveLength(0);
  });

  it('known-conflicting pairs: duplicates always detected', () => {
    const rng = makeRng(123);
    for (let trial = 0; trial < 50; trial++) {
      const person = `p-${randomInt(rng, 1, 20)}`;
      const slot = `s-${randomInt(rng, 1, 10)}`;
      const meeting = `m-${randomInt(rng, 1, 10)}`;
      const date = randomDate(rng);
      const a1 = makeAssignment({ id: `dup-a1-${trial}`, slotId: slot, personId: person, meetingId: meeting, meetingDate: date });
      const a2 = makeAssignment({ id: `dup-a2-${trial}`, slotId: slot, personId: person, meetingId: meeting, meetingDate: date });
      const conflicts = detectConflicts([a1, a2]);
      expect(conflicts.some((c) => c.type === 'duplicate-assignment')).toBe(true);
    }
  });

  it('known-conflicting pairs: overlapping times always detected', () => {
    const rng = makeRng(456);
    for (let trial = 0; trial < 50; trial++) {
      const start1 = randomInt(rng, 0, 18) * 60;
      const end1 = start1 + randomInt(rng, 60, 180);
      // Make second overlap by starting before end1 and ending after start1
      const start2 = start1 + randomInt(rng, 0, end1 - start1 - 1);
      const end2 = start2 + randomInt(rng, 60, 180);
      const fmt = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
      const a1 = makeAssignment({ id: `ov-a1-${trial}`, slotId: `s1-${trial}`, personId: 'p-ov', startTime: fmt(start1), endTime: fmt(end1) });
      const a2 = makeAssignment({ id: `ov-a2-${trial}`, slotId: `s2-${trial}`, personId: 'p-ov', startTime: fmt(start2), endTime: fmt(end2) });
      const conflicts = detectConflicts([a1, a2]);
      expect(conflicts.some((c) => c.type === 'same-person-time-overlap')).toBe(true);
    }
  });

  it('random assignments: results are deterministic across two runs', () => {
    const rng1 = makeRng(789);
    const rng2 = makeRng(789);
    const arr1 = generateRandomAssignments(rng1, 100);
    const arr2 = generateRandomAssignments(rng2, 100);
    const c1 = detectConflicts(arr1);
    const c2 = detectConflicts(arr2);
    expect(c1.length).toBe(c2.length);
    for (let i = 0; i < c1.length; i++) {
      expect(c1[i]!.type).toBe(c2[i]!.type);
      expect(c1[i]!.personId).toBe(c2[i]!.personId);
    }
  });

  it('conflict count is stable for same seed across multiple detectConflicts calls', () => {
    const rng = makeRng(321);
    const assignments = generateRandomAssignments(rng, 150);
    // Include some known duplicates
    assignments.push(
      makeAssignment({ id: 'forced-dup-a', slotId: 's-force', personId: 'p-force' }),
      makeAssignment({ id: 'forced-dup-b', slotId: 's-force', personId: 'p-force' }),
    );
    const c1 = detectConflicts(assignments);
    const c2 = detectConflicts(assignments);
    const c3 = detectConflicts(assignments);
    expect(c1.length).toBe(c2.length);
    expect(c2.length).toBe(c3.length);
  });

  it('adding a conflicting assignment increases conflict count', () => {
    const rng = makeRng(654);
    const assignments = generateRandomAssignments(rng, 80);
    const before = detectConflicts(assignments);
    // Add a duplicate of the first assignment
    if (assignments.length > 0) {
      const orig = assignments[0]!;
      const dup = { ...orig, id: 'injected-dup' } as SchedulingAssignment;
      const after = detectConflicts([...assignments, Object.freeze(dup)]);
      expect(after.length).toBeGreaterThan(before.length);
    }
  });

  it('exclusive slot pair property: any exclusive pair assignment always detected', () => {
    const rng = makeRng(999);
    const slotPairs: [string, string][] = [
      ['chairman', 'speaker'],
      ['reader-1', 'reader-2'],
      ['host-1', 'host-2'],
    ];
    for (let trial = 0; trial < 30; trial++) {
      const pair = randomItem(rng, slotPairs);
      const person = `p-${randomInt(rng, 1, 20)}`;
      const a1 = makeAssignment({ id: `exc-a1-${trial}`, slotId: pair[0], personId: person });
      const a2 = makeAssignment({ id: `exc-a2-${trial}`, slotId: pair[1], personId: person, startTime: '14:00', endTime: '15:00' });
      const conflicts = detectConflicts([a1, a2], [], { exclusiveSlotPairs: [pair] });
      expect(conflicts.some((c) => c.type === 'same-person-incompatible-slots')).toBe(true);
    }
  });
});
