import { describe, it, expect } from 'vitest';
import {
  createStudentAssignment,
  transitionStudentAssignment,
  assertStudentAssignmentTenant,
  normalizeStudentAssignment,
  STUDENT_ASSIGNMENT_STATES,
} from './student-assignment';

const NOW = '2026-08-21T12:00:00.000Z';
const TENANT_A = 'tenant-aaa';
const TENANT_B = 'tenant-bbb';

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sa-1',
    tenantId: TENANT_A,
    meetingId: 'meeting-1',
    slotId: 'slot-1',
    studentId: 'person-1',
    assistantIsRequired: false,
    now: NOW,
    ...overrides,
  };
}

// ── STUDENT_ASSIGNMENT_STATES constant ─────────────────────────────────────

describe('STUDENT_ASSIGNMENT_STATES', () => {
  it('is frozen and contains expected values', () => {
    expect(Object.isFrozen(STUDENT_ASSIGNMENT_STATES)).toBe(true);
    expect(STUDENT_ASSIGNMENT_STATES).toEqual(['assigned', 'cancelled', 'completed']);
  });
});

// ── Creation and validation ────────────────────────────────────────────────

describe('createStudentAssignment', () => {
  it('creates assignment with required fields', () => {
    const a = createStudentAssignment(makeInput());
    expect(a.id).toBe('sa-1');
    expect(a.tenantId).toBe(TENANT_A);
    expect(a.meetingId).toBe('meeting-1');
    expect(a.slotId).toBe('slot-1');
    expect(a.studentId).toBe('person-1');
    expect(a.assistantId).toBeNull();
    expect(a.assistantIsRequired).toBe(false);
    expect(a.state).toBe('assigned');
    expect(a.assignedAt).toBe(NOW);
    expect(a.cancelledAt).toBeNull();
    expect(a.completedAt).toBeNull();
  });

  it('creates assignment with assistant', () => {
    const a = createStudentAssignment(makeInput({ assistantId: 'person-2' }));
    expect(a.assistantId).toBe('person-2');
  });

  it('creates assignment with assistantId null explicitly', () => {
    const a = createStudentAssignment(makeInput({ assistantId: null }));
    expect(a.assistantId).toBeNull();
  });

  it('creates assignment with assistantIsRequired true and assistant provided', () => {
    const a = createStudentAssignment(makeInput({ assistantIsRequired: true, assistantId: 'person-2' }));
    expect(a.assistantIsRequired).toBe(true);
    expect(a.assistantId).toBe('person-2');
  });

  it('object is frozen (immutable)', () => {
    const a = createStudentAssignment(makeInput());
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('trims whitespace on IDs', () => {
    const a = createStudentAssignment(makeInput({ id: '  sa-1  ', tenantId: '  ' + TENANT_A + '  ' }));
    expect(a.id).toBe('sa-1');
    expect(a.tenantId).toBe(TENANT_A);
  });
});

// ── Assistant required vs optional ────────────────────────────────────────

describe('assistant required logic', () => {
  it('throws when assistantIsRequired true but no assistant provided', () => {
    expect(() =>
      createStudentAssignment(makeInput({ assistantIsRequired: true, assistantId: undefined })),
    ).toThrow('Assistant is required but none was provided');
  });

  it('throws when assistantIsRequired true and assistantId is null', () => {
    expect(() =>
      createStudentAssignment(makeInput({ assistantIsRequired: true, assistantId: null })),
    ).toThrow('Assistant is required but none was provided');
  });

  it('allows assistant even when not required (graceful)', () => {
    const a = createStudentAssignment(makeInput({ assistantIsRequired: false, assistantId: 'person-2' }));
    expect(a.assistantId).toBe('person-2');
  });
});

// ── Missing/empty required fields ──────────────────────────────────────────

describe('missing required fields', () => {
  it('throws on empty id', () => {
    expect(() => createStudentAssignment(makeInput({ id: '' }))).toThrow('assignmentId is required');
  });

  it('throws on whitespace-only id', () => {
    expect(() => createStudentAssignment(makeInput({ id: '   ' }))).toThrow('assignmentId is required');
  });

  it('throws on empty tenantId', () => {
    expect(() => createStudentAssignment(makeInput({ tenantId: '' }))).toThrow('tenantId is required');
  });

  it('throws on empty meetingId', () => {
    expect(() => createStudentAssignment(makeInput({ meetingId: '' }))).toThrow('meetingId is required');
  });

  it('throws on empty slotId', () => {
    expect(() => createStudentAssignment(makeInput({ slotId: '' }))).toThrow('slotId is required');
  });

  it('throws on empty studentId', () => {
    expect(() => createStudentAssignment(makeInput({ studentId: '' }))).toThrow('studentId is required');
  });

  it('throws on empty assistantId (when provided as string)', () => {
    expect(() => createStudentAssignment(makeInput({ assistantId: '  ' }))).toThrow('assistantId is required');
  });
});

// ── Malformed / adversarial inputs ─────────────────────────────────────────

describe('adversarial inputs', () => {
  it('throws on non-string id (number)', () => {
    expect(() => createStudentAssignment(makeInput({ id: 42 as any }))).toThrow('assignmentId must be a string');
  });

  it('throws on non-string tenantId (object)', () => {
    expect(() => createStudentAssignment(makeInput({ tenantId: {} as any }))).toThrow('tenantId must be a string');
  });

  it('throws on non-string meetingId (boolean)', () => {
    expect(() => createStudentAssignment(makeInput({ meetingId: true as any }))).toThrow('meetingId must be a string');
  });

  it('throws on non-string slotId (number)', () => {
    expect(() => createStudentAssignment(makeInput({ slotId: 123 as any }))).toThrow('slotId must be a string');
  });

  it('throws on non-string studentId (null)', () => {
    expect(() => createStudentAssignment(makeInput({ studentId: null as any }))).toThrow('studentId must be a string');
  });

  it('throws on non-boolean assistantIsRequired (string)', () => {
    expect(() => createStudentAssignment(makeInput({ assistantIsRequired: 'yes' as any }))).toThrow('assistantIsRequired must be a boolean');
  });

  it('throws on non-boolean assistantIsRequired (number)', () => {
    expect(() => createStudentAssignment(makeInput({ assistantIsRequired: 1 as any }))).toThrow('assistantIsRequired must be a boolean');
  });

  it('throws on invalid ISO date', () => {
    expect(() => createStudentAssignment(makeInput({ now: 'not-a-date' }))).toThrow('Invalid ISO date');
  });

  it('throws on empty string now', () => {
    expect(() => createStudentAssignment(makeInput({ now: '' }))).toThrow('Invalid ISO date');
  });
});

// ── State machine transitions ──────────────────────────────────────────────

describe('state transitions', () => {
  it('assigned → cancelled', () => {
    const a = createStudentAssignment(makeInput());
    const b = transitionStudentAssignment(a, 'cancelled', '2026-08-21T14:00:00.000Z');
    expect(b.state).toBe('cancelled');
    expect(b.cancelledAt).toBe('2026-08-21T14:00:00.000Z');
    expect(b.completedAt).toBeNull();
  });

  it('assigned → completed', () => {
    const a = createStudentAssignment(makeInput());
    const b = transitionStudentAssignment(a, 'completed', '2026-08-21T15:00:00.000Z');
    expect(b.state).toBe('completed');
    expect(b.completedAt).toBe('2026-08-21T15:00:00.000Z');
    expect(b.cancelledAt).toBeNull();
  });

  it('cancelled → assigned (reassignment)', () => {
    const a = createStudentAssignment(makeInput());
    const b = transitionStudentAssignment(a, 'cancelled', '2026-08-21T14:00:00.000Z');
    const c = transitionStudentAssignment(b, 'assigned', '2026-08-21T16:00:00.000Z');
    expect(c.state).toBe('assigned');
    expect(c.cancelledAt).toBeNull();
  });

  it('completed is terminal — no transitions out', () => {
    const a = createStudentAssignment(makeInput());
    const b = transitionStudentAssignment(a, 'completed', '2026-08-21T15:00:00.000Z');
    expect(() => transitionStudentAssignment(b, 'cancelled', '2026-08-21T16:00:00.000Z')).toThrow('Invalid transition');
    expect(() => transitionStudentAssignment(b, 'assigned', '2026-08-21T16:00:00.000Z')).toThrow('Invalid transition');
  });

  it('cancelled → completed is invalid', () => {
    const a = createStudentAssignment(makeInput());
    const b = transitionStudentAssignment(a, 'cancelled', '2026-08-21T14:00:00.000Z');
    expect(() => transitionStudentAssignment(b, 'completed', '2026-08-21T15:00:00.000Z')).toThrow('Invalid transition');
  });

  it('assigned → assigned is invalid', () => {
    const a = createStudentAssignment(makeInput());
    expect(() => transitionStudentAssignment(a, 'assigned', '2026-08-21T13:00:00.000Z')).toThrow('Invalid transition');
  });

  it('rejects invalid state string', () => {
    const a = createStudentAssignment(makeInput());
    expect(() => transitionStudentAssignment(a, 'unknown' as any, '2026-08-21T13:00:00.000Z')).toThrow('Invalid student assignment state');
  });

  it('rejects transition timestamp before assignedAt', () => {
    const a = createStudentAssignment(makeInput({ now: '2026-08-21T12:00:00.000Z' }));
    expect(() => transitionStudentAssignment(a, 'cancelled', '2026-08-20T12:00:00.000Z')).toThrow('Transition timestamp cannot be before assignedAt');
  });

  it('transitioned object is frozen', () => {
    const a = createStudentAssignment(makeInput());
    const b = transitionStudentAssignment(a, 'completed', '2026-08-21T15:00:00.000Z');
    expect(Object.isFrozen(b)).toBe(true);
  });

  it('original object is unchanged after transition', () => {
    const a = createStudentAssignment(makeInput());
    transitionStudentAssignment(a, 'completed', '2026-08-21T15:00:00.000Z');
    expect(a.state).toBe('assigned');
    expect(a.completedAt).toBeNull();
  });
});

// ── Tenant isolation ───────────────────────────────────────────────────────

describe('tenant isolation', () => {
  it('allows same tenant', () => {
    const a = createStudentAssignment(makeInput());
    expect(() => assertStudentAssignmentTenant(a, TENANT_A)).not.toThrow();
  });

  it('rejects cross-tenant access', () => {
    const a = createStudentAssignment(makeInput());
    expect(() => assertStudentAssignmentTenant(a, TENANT_B)).toThrow('Cross-tenant student assignment access denied');
  });

  it('rejects empty tenant check', () => {
    const a = createStudentAssignment(makeInput());
    expect(() => assertStudentAssignmentTenant(a, '' as any)).toThrow('tenantId is required');
  });
});

// ── normalizeStudentAssignment ─────────────────────────────────────────────

describe('normalizeStudentAssignment', () => {
  it('normalizes a valid assignment', () => {
    const a = createStudentAssignment(makeInput());
    const n = normalizeStudentAssignment(a);
    expect(n.id).toBe('sa-1');
    expect(Object.isFrozen(n)).toBe(true);
  });

  it('throws on invalid state during normalization', () => {
    const a = createStudentAssignment(makeInput());
    const bad = { ...a, state: 'bogus' } as any;
    expect(() => normalizeStudentAssignment(bad)).toThrow('Invalid student assignment state');
  });

  it('throws on assigned state with cancelledAt', () => {
    const a = createStudentAssignment(makeInput());
    const bad = { ...a, cancelledAt: NOW } as any;
    expect(() => normalizeStudentAssignment(bad)).toThrow('assigned state must not have cancelledAt or completedAt');
  });

  it('throws on assigned state with completedAt', () => {
    const a = createStudentAssignment(makeInput());
    const bad = { ...a, completedAt: NOW } as any;
    expect(() => normalizeStudentAssignment(bad)).toThrow('assigned state must not have cancelledAt or completedAt');
  });

  it('throws on cancelled state without cancelledAt', () => {
    const a = createStudentAssignment(makeInput());
    const bad = { ...a, state: 'cancelled', cancelledAt: null } as any;
    expect(() => normalizeStudentAssignment(bad)).toThrow('cancelled state requires cancelledAt');
  });

  it('throws on completed state without completedAt', () => {
    const a = createStudentAssignment(makeInput());
    const bad = { ...a, state: 'completed', completedAt: null } as any;
    expect(() => normalizeStudentAssignment(bad)).toThrow('completed state requires completedAt');
  });

  it('throws on cancelledAt before assignedAt', () => {
    const a = createStudentAssignment(makeInput());
    const bad = { ...a, state: 'cancelled', cancelledAt: '2026-08-20T12:00:00.000Z' } as any;
    expect(() => normalizeStudentAssignment(bad)).toThrow('cancelledAt cannot be before assignedAt');
  });

  it('throws on completedAt before assignedAt', () => {
    const a = createStudentAssignment(makeInput());
    const bad = { ...a, state: 'completed', completedAt: '2026-08-20T12:00:00.000Z' } as any;
    expect(() => normalizeStudentAssignment(bad)).toThrow('completedAt cannot be before assignedAt');
  });

  it('throws on non-string ID during normalization', () => {
    const a = createStudentAssignment(makeInput());
    const bad = { ...a, id: 99 } as any;
    expect(() => normalizeStudentAssignment(bad)).toThrow('assignmentId must be a string');
  });

  it('throws when assistantIsRequired true but no assistant during normalization', () => {
    const a = createStudentAssignment(makeInput({ assistantIsRequired: true, assistantId: 'person-2' }));
    const bad = { ...a, assistantId: null } as any;
    expect(() => normalizeStudentAssignment(bad)).toThrow('Assistant is required but none was provided');
  });

  it('throws on invalid cancelledAt ISO date', () => {
    const a = createStudentAssignment(makeInput());
    const bad = { ...a, state: 'cancelled', cancelledAt: 'bad-date' } as any;
    expect(() => normalizeStudentAssignment(bad)).toThrow('Invalid ISO date');
  });

  it('throws on invalid completedAt ISO date', () => {
    const a = createStudentAssignment(makeInput());
    const bad = { ...a, state: 'completed', completedAt: 'bad-date' } as any;
    expect(() => normalizeStudentAssignment(bad)).toThrow('Invalid ISO date');
  });
});

// ── Null injection / prototype safety ─────────────────────────────────────

describe('null injection safety', () => {
  it('rejects null id', () => {
    expect(() => createStudentAssignment(makeInput({ id: null as any }))).toThrow('assignmentId must be a string');
  });

  it('rejects undefined id', () => {
    expect(() => createStudentAssignment(makeInput({ id: undefined as any }))).toThrow('assignmentId must be a string');
  });

  it('rejects null tenantId', () => {
    expect(() => createStudentAssignment(makeInput({ tenantId: null as any }))).toThrow('tenantId must be a string');
  });

  it('rejects null studentId', () => {
    expect(() => createStudentAssignment(makeInput({ studentId: null as any }))).toThrow('studentId must be a string');
  });

  it('rejects null now', () => {
    expect(() => createStudentAssignment(makeInput({ now: null as any }))).toThrow('Invalid ISO date');
  });
});
