import type { TenantId, PersonId } from './people';

// ── Types ──────────────────────────────────────────────────────────────────

export type NonStudentAssignmentId = string;
export type MeetingId = string;
export type SlotId = string;
export type NonStudentRole = string;

export type NonStudentAssignmentState = 'assigned' | 'cancelled' | 'completed';

export const NON_STUDENT_ASSIGNMENT_STATES: readonly NonStudentAssignmentState[] = Object.freeze([
  'assigned', 'cancelled', 'completed',
] as const);

export interface NonStudentAssignment {
  readonly id: NonStudentAssignmentId;
  readonly tenantId: TenantId;
  readonly meetingId: MeetingId;
  readonly slotId: SlotId;
  readonly personId: PersonId;
  readonly role: NonStudentRole;
  readonly state: NonStudentAssignmentState;
  readonly assignedAt: string;
  readonly cancelledAt: string | null;
  readonly completedAt: string | null;
}

// ── Valid transitions ──────────────────────────────────────────────────────

const VALID_TRANSITIONS: Readonly<Record<NonStudentAssignmentState, readonly NonStudentAssignmentState[]>> = {
  assigned: ['cancelled', 'completed'],
  cancelled: ['assigned'],
  completed: [],
};

// ── Internal helpers ───────────────────────────────────────────────────────

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid ISO date: ${String(value)}`);
  }
}

function assertValidState(state: string): NonStudentAssignmentState {
  if (!NON_STUDENT_ASSIGNMENT_STATES.includes(state as NonStudentAssignmentState)) {
    throw new Error(`Invalid non-student assignment state: ${state}`);
  }
  return state as NonStudentAssignmentState;
}

// ── Construction ───────────────────────────────────────────────────────────

export function createNonStudentAssignment(input: {
  id: NonStudentAssignmentId;
  tenantId: TenantId;
  meetingId: MeetingId;
  slotId: SlotId;
  personId: PersonId;
  role: NonStudentRole;
  now: string;
}): Readonly<NonStudentAssignment> {
  validateInstant(input.now);
  const id = required(input.id, 'assignmentId');
  const tenantId = required(input.tenantId, 'tenantId');
  const meetingId = required(input.meetingId, 'meetingId');
  const slotId = required(input.slotId, 'slotId');
  const personId = required(input.personId, 'personId');
  const role = required(input.role, 'role');

  return Object.freeze({
    id, tenantId, meetingId, slotId, personId, role,
    state: 'assigned',
    assignedAt: input.now,
    cancelledAt: null,
    completedAt: null,
  });
}

// ── State transitions ──────────────────────────────────────────────────────

export function cancelNonStudentAssignment(
  assignment: Readonly<NonStudentAssignment>,
  now: string,
): Readonly<NonStudentAssignment> {
  validateInstant(now);
  if (!VALID_TRANSITIONS[assignment.state]?.includes('cancelled')) {
    throw new Error(`Invalid transition: ${assignment.state} → cancelled`);
  }
  if (Date.parse(now) < Date.parse(assignment.assignedAt)) {
    throw new Error('Transition timestamp cannot be before assignedAt');
  }
  return Object.freeze({
    ...assignment,
    state: 'cancelled',
    cancelledAt: now,
    completedAt: null,
  });
}

export function completeNonStudentAssignment(
  assignment: Readonly<NonStudentAssignment>,
  now: string,
): Readonly<NonStudentAssignment> {
  validateInstant(now);
  if (!VALID_TRANSITIONS[assignment.state]?.includes('completed')) {
    throw new Error(`Invalid transition: ${assignment.state} → completed`);
  }
  if (Date.parse(now) < Date.parse(assignment.assignedAt)) {
    throw new Error('Transition timestamp cannot be before assignedAt');
  }
  return Object.freeze({
    ...assignment,
    state: 'completed',
    completedAt: now,
    cancelledAt: null,
  });
}

export function reassignNonStudentAssignment(
  assignment: Readonly<NonStudentAssignment>,
  personId: PersonId,
  now: string,
): Readonly<NonStudentAssignment> {
  validateInstant(now);
  const newPersonId = required(personId, 'personId');
  if (!VALID_TRANSITIONS[assignment.state]?.includes('assigned')) {
    throw new Error(`Invalid transition: ${assignment.state} → assigned`);
  }
  if (Date.parse(now) < Date.parse(assignment.assignedAt)) {
    throw new Error('Transition timestamp cannot be before assignedAt');
  }
  return Object.freeze({
    ...assignment,
    personId: newPersonId,
    state: 'assigned',
    assignedAt: now,
    cancelledAt: null,
    completedAt: null,
  });
}

// ── Tenant isolation ───────────────────────────────────────────────────────

export function assertNonStudentAssignmentTenant(
  assignment: Readonly<NonStudentAssignment>,
  tenantId: TenantId,
): void {
  required(tenantId, 'tenantId');
  if (assignment.tenantId !== tenantId) {
    throw new Error('Cross-tenant non-student assignment access denied');
  }
}

// ── Query helpers ──────────────────────────────────────────────────────────

export function filterByTenant(
  assignments: readonly Readonly<NonStudentAssignment>[],
  tenantId: TenantId,
): readonly Readonly<NonStudentAssignment>[] {
  return assignments.filter(a => a.tenantId === tenantId);
}

export function filterByMeeting(
  assignments: readonly Readonly<NonStudentAssignment>[],
  meetingId: MeetingId,
): readonly Readonly<NonStudentAssignment>[] {
  return assignments.filter(a => a.meetingId === meetingId);
}

export function filterByRole(
  assignments: readonly Readonly<NonStudentAssignment>[],
  role: NonStudentRole,
): readonly Readonly<NonStudentAssignment>[] {
  return assignments.filter(a => a.role === role);
}
