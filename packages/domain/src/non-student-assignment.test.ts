import { describe, it, expect } from 'vitest';
import {
  createNonStudentAssignment,
  cancelNonStudentAssignment,
  completeNonStudentAssignment,
  reassignNonStudentAssignment,
  assertNonStudentAssignmentTenant,
  filterByTenant,
  filterByMeeting,
  filterByRole,
  NON_STUDENT_ASSIGNMENT_STATES,
} from './non-student-assignment';

const NOW = '2026-08-21T12:00:00.000Z';
const TENANT_A = 'tenant-aaa';
const TENANT_B = 'tenant-bbb';
const MEETING_1 = 'meeting-1';
const MEETING_2 = 'meeting-2';
const SLOT_1 = 'slot-1';
const SLOT_2 = 'slot-2';
const PERSON_1 = 'person-1';
const PERSON_2 = 'person-2';

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nsa-1',
    tenantId: TENANT_A,
    meetingId: MEETING_1,
    slotId: SLOT_1,
    personId: PERSON_1,
    role: 'chairman',
    now: NOW,
    ...overrides,
  };
}

// ── NON_STUDENT_ASSIGNMENT_STATES constant ─────────────────────────────────

describe('NON_STUDENT_ASSIGNMENT_STATES', () => {
  it('is frozen and contains expected values', () => {
    expect(Object.isFrozen(NON_STUDENT_ASSIGNMENT_STATES)).toBe(true);
    expect(NON_STUDENT_ASSIGNMENT_STATES).toEqual(['assigned', 'cancelled', 'completed']);
  });
});

// ── Creation and validation ────────────────────────────────────────────────

describe('createNonStudentAssignment', () => {
  it('creates assignment with required fields for chairman', () => {
    const a = createNonStudentAssignment(makeInput());
    expect(a.id).toBe('nsa-1');
    expect(a.tenantId).toBe(TENANT_A);
    expect(a.meetingId).toBe(MEETING_1);
    expect(a.slotId).toBe(SLOT_1);
    expect(a.personId).toBe(PERSON_1);
    expect(a.role).toBe('chairman');
    expect(a.state).toBe('assigned');
    expect(a.assignedAt).toBe(NOW);
    expect(a.cancelledAt).toBeNull();
    expect(a.completedAt).toBeNull();
  });

  it('creates assignment for opening-prayer role', () => {
    const a = createNonStudentAssignment(makeInput({ role: 'opening-prayer' }));
    expect(a.role).toBe('opening-prayer');
  });

  it('creates assignment for closing-prayer role', () => {
    const a = createNonStudentAssignment(makeInput({ role: 'closing-prayer' }));
    expect(a.role).toBe('closing-prayer');
  });

  it('creates assignment for bible-reading role', () => {
    const a = createNonStudentAssignment(makeInput({ role: 'bible-reading' }));
    expect(a.role).toBe('bible-reading');
  });

  it('creates assignment for custom role', () => {
    const a = createNonStudentAssignment(makeInput({ role: 'custom-greeter' }));
    expect(a.role).toBe('custom-greeter');
  });

  it('object is frozen (immutable)', () => {
    const a = createNonStudentAssignment(makeInput());
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('trims whitespace on IDs', () => {
    const a = createNonStudentAssignment(makeInput({ id: '  nsa-1  ', tenantId: '  ' + TENANT_A + '  ' }));
    expect(a.id).toBe('nsa-1');
    expect(a.tenantId).toBe(TENANT_A);
  });

  it('trims whitespace on role', () => {
    const a = createNonStudentAssignment(makeInput({ role: '  chairman  ' }));
    expect(a.role).toBe('chairman');
  });

  it('trims whitespace on personId', () => {
    const a = createNonStudentAssignment(makeInput({ personId: '  ' + PERSON_1 + '  ' }));
    expect(a.personId).toBe(PERSON_1);
  });
});

// ── Missing/empty required fields ──────────────────────────────────────────

describe('missing required fields', () => {
  it('throws on empty id', () => {
    expect(() => createNonStudentAssignment(makeInput({ id: '' }))).toThrow('assignmentId is required');
  });

  it('throws on whitespace-only id', () => {
    expect(() => createNonStudentAssignment(makeInput({ id: '   ' }))).toThrow('assignmentId is required');
  });

  it('throws on empty tenantId', () => {
    expect(() => createNonStudentAssignment(makeInput({ tenantId: '' }))).toThrow('tenantId is required');
  });

  it('throws on empty meetingId', () => {
    expect(() => createNonStudentAssignment(makeInput({ meetingId: '' }))).toThrow('meetingId is required');
  });

  it('throws on empty slotId', () => {
    expect(() => createNonStudentAssignment(makeInput({ slotId: '' }))).toThrow('slotId is required');
  });

  it('throws on empty personId', () => {
    expect(() => createNonStudentAssignment(makeInput({ personId: '' }))).toThrow('personId is required');
  });

  it('throws on empty role', () => {
    expect(() => createNonStudentAssignment(makeInput({ role: '' }))).toThrow('role is required');
  });

  it('throws on whitespace-only role', () => {
    expect(() => createNonStudentAssignment(makeInput({ role: '   ' }))).toThrow('role is required');
  });
});

// ── Malformed / adversarial inputs ─────────────────────────────────────────

describe('adversarial inputs', () => {
  it('throws on non-string id (number)', () => {
    expect(() => createNonStudentAssignment(makeInput({ id: 42 as any }))).toThrow('assignmentId must be a string');
  });

  it('throws on non-string tenantId (object)', () => {
    expect(() => createNonStudentAssignment(makeInput({ tenantId: {} as any }))).toThrow('tenantId must be a string');
  });

  it('throws on non-string meetingId (boolean)', () => {
    expect(() => createNonStudentAssignment(makeInput({ meetingId: true as any }))).toThrow('meetingId must be a string');
  });

  it('throws on non-string slotId (number)', () => {
    expect(() => createNonStudentAssignment(makeInput({ slotId: 123 as any }))).toThrow('slotId must be a string');
  });

  it('throws on non-string personId (null)', () => {
    expect(() => createNonStudentAssignment(makeInput({ personId: null as any }))).toThrow('personId must be a string');
  });

  it('throws on non-string role (number)', () => {
    expect(() => createNonStudentAssignment(makeInput({ role: 99 as any }))).toThrow('role must be a string');
  });

  it('throws on invalid ISO date', () => {
    expect(() => createNonStudentAssignment(makeInput({ now: 'not-a-date' }))).toThrow('Invalid ISO date');
  });

  it('throws on empty string now', () => {
    expect(() => createNonStudentAssignment(makeInput({ now: '' }))).toThrow('Invalid ISO date');
  });
});

// ── Null injection / prototype safety ─────────────────────────────────────

describe('null injection safety', () => {
  it('rejects null id', () => {
    expect(() => createNonStudentAssignment(makeInput({ id: null as any }))).toThrow('assignmentId must be a string');
  });

  it('rejects undefined id', () => {
    expect(() => createNonStudentAssignment(makeInput({ id: undefined as any }))).toThrow('assignmentId must be a string');
  });

  it('rejects null tenantId', () => {
    expect(() => createNonStudentAssignment(makeInput({ tenantId: null as any }))).toThrow('tenantId must be a string');
  });

  it('rejects null personId', () => {
    expect(() => createNonStudentAssignment(makeInput({ personId: null as any }))).toThrow('personId must be a string');
  });

  it('rejects null role', () => {
    expect(() => createNonStudentAssignment(makeInput({ role: null as any }))).toThrow('role must be a string');
  });

  it('rejects null now', () => {
    expect(() => createNonStudentAssignment(makeInput({ now: null as any }))).toThrow('Invalid ISO date');
  });

  it('rejects undefined tenantId', () => {
    expect(() => createNonStudentAssignment(makeInput({ tenantId: undefined as any }))).toThrow('tenantId must be a string');
  });

  it('rejects undefined meetingId', () => {
    expect(() => createNonStudentAssignment(makeInput({ meetingId: undefined as any }))).toThrow('meetingId must be a string');
  });
});

// ── State machine — cancelNonStudentAssignment ─────────────────────────────

describe('cancelNonStudentAssignment', () => {
  it('assigned → cancelled', () => {
    const a = createNonStudentAssignment(makeInput());
    const b = cancelNonStudentAssignment(a, '2026-08-21T14:00:00.000Z');
    expect(b.state).toBe('cancelled');
    expect(b.cancelledAt).toBe('2026-08-21T14:00:00.000Z');
    expect(b.completedAt).toBeNull();
  });

  it('cancelled → cancelled is invalid', () => {
    const a = createNonStudentAssignment(makeInput());
    const b = cancelNonStudentAssignment(a, '2026-08-21T14:00:00.000Z');
    expect(() => cancelNonStudentAssignment(b, '2026-08-21T15:00:00.000Z')).toThrow('Invalid transition');
  });

  it('completed → cancelled is invalid', () => {
    const a = createNonStudentAssignment(makeInput());
    const b = completeNonStudentAssignment(a, '2026-08-21T14:00:00.000Z');
    expect(() => cancelNonStudentAssignment(b, '2026-08-21T15:00:00.000Z')).toThrow('Invalid transition');
  });

  it('rejects transition timestamp before assignedAt', () => {
    const a = createNonStudentAssignment(makeInput({ now: '2026-08-21T12:00:00.000Z' }));
    expect(() => cancelNonStudentAssignment(a, '2026-08-20T12:00:00.000Z')).toThrow('Transition timestamp cannot be before assignedAt');
  });

  it('rejects invalid ISO date for now', () => {
    const a = createNonStudentAssignment(makeInput());
    expect(() => cancelNonStudentAssignment(a, 'bad-date')).toThrow('Invalid ISO date');
  });

  it('result is frozen', () => {
    const a = createNonStudentAssignment(makeInput());
    const b = cancelNonStudentAssignment(a, '2026-08-21T14:00:00.000Z');
    expect(Object.isFrozen(b)).toBe(true);
  });

  it('original is unchanged', () => {
    const a = createNonStudentAssignment(makeInput());
    cancelNonStudentAssignment(a, '2026-08-21T14:00:00.000Z');
    expect(a.state).toBe('assigned');
    expect(a.cancelledAt).toBeNull();
  });
});

// ── State machine — completeNonStudentAssignment ───────────────────────────

describe('completeNonStudentAssignment', () => {
  it('assigned → completed', () => {
    const a = createNonStudentAssignment(makeInput());
    const b = completeNonStudentAssignment(a, '2026-08-21T15:00:00.000Z');
    expect(b.state).toBe('completed');
    expect(b.completedAt).toBe('2026-08-21T15:00:00.000Z');
    expect(b.cancelledAt).toBeNull();
  });

  it('completed is terminal — no further transitions', () => {
    const a = createNonStudentAssignment(makeInput());
    const b = completeNonStudentAssignment(a, '2026-08-21T15:00:00.000Z');
    expect(() => cancelNonStudentAssignment(b, '2026-08-21T16:00:00.000Z')).toThrow('Invalid transition');
    expect(() => completeNonStudentAssignment(b, '2026-08-21T16:00:00.000Z')).toThrow('Invalid transition');
  });

  it('cancelled → completed is invalid', () => {
    const a = createNonStudentAssignment(makeInput());
    const b = cancelNonStudentAssignment(a, '2026-08-21T14:00:00.000Z');
    expect(() => completeNonStudentAssignment(b, '2026-08-21T15:00:00.000Z')).toThrow('Invalid transition');
  });

  it('rejects transition timestamp before assignedAt', () => {
    const a = createNonStudentAssignment(makeInput({ now: '2026-08-21T12:00:00.000Z' }));
    expect(() => completeNonStudentAssignment(a, '2026-08-20T12:00:00.000Z')).toThrow('Transition timestamp cannot be before assignedAt');
  });

  it('rejects invalid ISO date for now', () => {
    const a = createNonStudentAssignment(makeInput());
    expect(() => completeNonStudentAssignment(a, 'x')).toThrow('Invalid ISO date');
  });

  it('result is frozen', () => {
    const a = createNonStudentAssignment(makeInput());
    const b = completeNonStudentAssignment(a, '2026-08-21T15:00:00.000Z');
    expect(Object.isFrozen(b)).toBe(true);
  });

  it('original is unchanged', () => {
    const a = createNonStudentAssignment(makeInput());
    completeNonStudentAssignment(a, '2026-08-21T15:00:00.000Z');
    expect(a.state).toBe('assigned');
    expect(a.completedAt).toBeNull();
  });
});

// ── State machine — reassignNonStudentAssignment ───────────────────────────

describe('reassignNonStudentAssignment', () => {
  it('cancelled → assigned with new person', () => {
    const a = createNonStudentAssignment(makeInput());
    const b = cancelNonStudentAssignment(a, '2026-08-21T14:00:00.000Z');
    const c = reassignNonStudentAssignment(b, PERSON_2, '2026-08-21T16:00:00.000Z');
    expect(c.state).toBe('assigned');
    expect(c.personId).toBe(PERSON_2);
    expect(c.assignedAt).toBe('2026-08-21T16:00:00.000Z');
    expect(c.cancelledAt).toBeNull();
    expect(c.completedAt).toBeNull();
  });

  it('assigned → assigned is invalid', () => {
    const a = createNonStudentAssignment(makeInput());
    expect(() => reassignNonStudentAssignment(a, PERSON_2, '2026-08-21T13:00:00.000Z')).toThrow('Invalid transition');
  });

  it('completed → assigned is invalid', () => {
    const a = createNonStudentAssignment(makeInput());
    const b = completeNonStudentAssignment(a, '2026-08-21T15:00:00.000Z');
    expect(() => reassignNonStudentAssignment(b, PERSON_2, '2026-08-21T16:00:00.000Z')).toThrow('Invalid transition');
  });

  it('rejects empty personId', () => {
    const a = createNonStudentAssignment(makeInput());
    const b = cancelNonStudentAssignment(a, '2026-08-21T14:00:00.000Z');
    expect(() => reassignNonStudentAssignment(b, '', '2026-08-21T16:00:00.000Z')).toThrow('personId is required');
  });

  it('rejects non-string personId', () => {
    const a = createNonStudentAssignment(makeInput());
    const b = cancelNonStudentAssignment(a, '2026-08-21T14:00:00.000Z');
    expect(() => reassignNonStudentAssignment(b, 42 as any, '2026-08-21T16:00:00.000Z')).toThrow('personId must be a string');
  });

  it('rejects null personId', () => {
    const a = createNonStudentAssignment(makeInput());
    const b = cancelNonStudentAssignment(a, '2026-08-21T14:00:00.000Z');
    expect(() => reassignNonStudentAssignment(b, null as any, '2026-08-21T16:00:00.000Z')).toThrow('personId must be a string');
  });

  it('rejects transition timestamp before assignedAt', () => {
    const a = createNonStudentAssignment(makeInput({ now: '2026-08-21T12:00:00.000Z' }));
    const b = cancelNonStudentAssignment(a, '2026-08-21T14:00:00.000Z');
    expect(() => reassignNonStudentAssignment(b, PERSON_2, '2026-08-20T12:00:00.000Z')).toThrow('Transition timestamp cannot be before assignedAt');
  });

  it('trims whitespace on personId', () => {
    const a = createNonStudentAssignment(makeInput());
    const b = cancelNonStudentAssignment(a, '2026-08-21T14:00:00.000Z');
    const c = reassignNonStudentAssignment(b, '  ' + PERSON_2 + '  ', '2026-08-21T16:00:00.000Z');
    expect(c.personId).toBe(PERSON_2);
  });

  it('result is frozen', () => {
    const a = createNonStudentAssignment(makeInput());
    const b = cancelNonStudentAssignment(a, '2026-08-21T14:00:00.000Z');
    const c = reassignNonStudentAssignment(b, PERSON_2, '2026-08-21T16:00:00.000Z');
    expect(Object.isFrozen(c)).toBe(true);
  });

  it('original is unchanged after reassign', () => {
    const a = createNonStudentAssignment(makeInput());
    const b = cancelNonStudentAssignment(a, '2026-08-21T14:00:00.000Z');
    reassignNonStudentAssignment(b, PERSON_2, '2026-08-21T16:00:00.000Z');
    expect(b.state).toBe('cancelled');
    expect(b.personId).toBe(PERSON_1);
  });
});

// ── Tenant isolation ───────────────────────────────────────────────────────

describe('tenant isolation', () => {
  it('allows same tenant', () => {
    const a = createNonStudentAssignment(makeInput());
    expect(() => assertNonStudentAssignmentTenant(a, TENANT_A)).not.toThrow();
  });

  it('rejects cross-tenant access', () => {
    const a = createNonStudentAssignment(makeInput());
    expect(() => assertNonStudentAssignmentTenant(a, TENANT_B)).toThrow('Cross-tenant non-student assignment access denied');
  });

  it('rejects empty tenant check', () => {
    const a = createNonStudentAssignment(makeInput());
    expect(() => assertNonStudentAssignmentTenant(a, '' as any)).toThrow('tenantId is required');
  });

  it('rejects null tenant check', () => {
    const a = createNonStudentAssignment(makeInput());
    expect(() => assertNonStudentAssignmentTenant(a, null as any)).toThrow('tenantId must be a string');
  });
});

// ── filterByTenant ─────────────────────────────────────────────────────────

describe('filterByTenant', () => {
  it('returns assignments for the given tenant', () => {
    const a1 = createNonStudentAssignment(makeInput({ id: 'nsa-1', tenantId: TENANT_A }));
    const a2 = createNonStudentAssignment(makeInput({ id: 'nsa-2', tenantId: TENANT_B }));
    const result = filterByTenant([a1, a2], TENANT_A);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('nsa-1');
  });

  it('returns empty array when no matches', () => {
    const a = createNonStudentAssignment(makeInput({ tenantId: TENANT_A }));
    const result = filterByTenant([a], TENANT_B);
    expect(result).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(filterByTenant([], TENANT_A)).toHaveLength(0);
  });
});

// ── filterByMeeting ────────────────────────────────────────────────────────

describe('filterByMeeting', () => {
  it('returns assignments for the given meeting', () => {
    const a1 = createNonStudentAssignment(makeInput({ id: 'nsa-1', meetingId: MEETING_1 }));
    const a2 = createNonStudentAssignment(makeInput({ id: 'nsa-2', meetingId: MEETING_2 }));
    const result = filterByMeeting([a1, a2], MEETING_1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('nsa-1');
  });

  it('returns empty array when no matches', () => {
    const a = createNonStudentAssignment(makeInput({ meetingId: MEETING_1 }));
    const result = filterByMeeting([a], MEETING_2);
    expect(result).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(filterByMeeting([], MEETING_1)).toHaveLength(0);
  });
});

// ── filterByRole ───────────────────────────────────────────────────────────

describe('filterByRole', () => {
  it('returns assignments for the given role', () => {
    const a1 = createNonStudentAssignment(makeInput({ id: 'nsa-1', role: 'chairman' }));
    const a2 = createNonStudentAssignment(makeInput({ id: 'nsa-2', role: 'opening-prayer' }));
    const result = filterByRole([a1, a2], 'chairman');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('nsa-1');
  });

  it('returns empty array when no matches', () => {
    const a = createNonStudentAssignment(makeInput({ role: 'chairman' }));
    const result = filterByRole([a], 'closing-prayer');
    expect(result).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(filterByRole([], 'chairman')).toHaveLength(0);
  });
});

// ── Same person in multiple roles (no conflict prevention) ─────────────────

describe('same person multiple roles', () => {
  it('allows same person as chairman and reader in same meeting', () => {
    const chairman = createNonStudentAssignment(makeInput({
      id: 'nsa-1',
      slotId: SLOT_1,
      role: 'chairman',
      personId: PERSON_1,
    }));
    const reader = createNonStudentAssignment(makeInput({
      id: 'nsa-2',
      slotId: SLOT_2,
      role: 'bible-reading',
      personId: PERSON_1,
    }));
    expect(chairman.personId).toBe(PERSON_1);
    expect(reader.personId).toBe(PERSON_1);
    expect(chairman.meetingId).toBe(reader.meetingId);
  });
});

// ── Full lifecycle ─────────────────────────────────────────────────────────

describe('full lifecycle', () => {
  it('create → cancel → reassign → complete', () => {
    const created = createNonStudentAssignment(makeInput());
    expect(created.state).toBe('assigned');

    const cancelled = cancelNonStudentAssignment(created, '2026-08-21T14:00:00.000Z');
    expect(cancelled.state).toBe('cancelled');

    const reassigned = reassignNonStudentAssignment(cancelled, PERSON_2, '2026-08-21T16:00:00.000Z');
    expect(reassigned.state).toBe('assigned');
    expect(reassigned.personId).toBe(PERSON_2);

    const completed = completeNonStudentAssignment(reassigned, '2026-08-21T17:00:00.000Z');
    expect(completed.state).toBe('completed');
    expect(completed.completedAt).toBe('2026-08-21T17:00:00.000Z');
  });
});
