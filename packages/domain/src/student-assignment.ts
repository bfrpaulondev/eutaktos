import type { TenantId, PersonId } from './people';

// ── Types ──────────────────────────────────────────────────────────────────

export type StudentAssignmentId = string;
export type MeetingId = string;
export type SlotId = string;

export type StudentAssignmentState = 'assigned' | 'cancelled' | 'completed';

export const STUDENT_ASSIGNMENT_STATES: readonly StudentAssignmentState[] = Object.freeze([
  'assigned', 'cancelled', 'completed',
] as const);

export interface StudentAssignment {
  readonly id: StudentAssignmentId;
  readonly tenantId: TenantId;
  readonly meetingId: MeetingId;
  readonly slotId: SlotId;
  readonly studentId: PersonId;
  readonly assistantId: PersonId | null;
  readonly assistantIsRequired: boolean;
  readonly state: StudentAssignmentState;
  readonly assignedAt: string;
  readonly cancelledAt: string | null;
  readonly completedAt: string | null;
}

// ── Valid transitions ──────────────────────────────────────────────────────

const VALID_TRANSITIONS: Readonly<Record<StudentAssignmentState, readonly StudentAssignmentState[]>> = {
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

function assertValidState(state: string): StudentAssignmentState {
  if (!STUDENT_ASSIGNMENT_STATES.includes(state as StudentAssignmentState)) {
    throw new Error(`Invalid student assignment state: ${state}`);
  }
  return state as StudentAssignmentState;
}

function normalizeAssistantId(value: PersonId | null | undefined): PersonId | null {
  if (value === null || value === undefined) return null;
  return required(value, 'assistantId');
}

// ── Construction ───────────────────────────────────────────────────────────

export function createStudentAssignment(input: {
  id: StudentAssignmentId;
  tenantId: TenantId;
  meetingId: MeetingId;
  slotId: SlotId;
  studentId: PersonId;
  assistantId?: PersonId | null;
  assistantIsRequired: boolean;
  now: string;
}): Readonly<StudentAssignment> {
  validateInstant(input.now);
  const id = required(input.id, 'assignmentId');
  const tenantId = required(input.tenantId, 'tenantId');
  const meetingId = required(input.meetingId, 'meetingId');
  const slotId = required(input.slotId, 'slotId');
  const studentId = required(input.studentId, 'studentId');
  const assistantId = normalizeAssistantId(input.assistantId);

  if (typeof input.assistantIsRequired !== 'boolean') {
    throw new Error('assistantIsRequired must be a boolean');
  }
  const assistantIsRequired = input.assistantIsRequired;

  if (assistantIsRequired && assistantId === null) {
    throw new Error('Assistant is required but none was provided');
  }

  return Object.freeze({
    id, tenantId, meetingId, slotId, studentId, assistantId,
    assistantIsRequired,
    state: 'assigned',
    assignedAt: input.now,
    cancelledAt: null,
    completedAt: null,
  });
}

// ── State transitions ──────────────────────────────────────────────────────

export function transitionStudentAssignment(
  assignment: Readonly<StudentAssignment>,
  newState: StudentAssignmentState,
  now: string,
): Readonly<StudentAssignment> {
  validateInstant(now);
  assertValidState(newState);

  if (!VALID_TRANSITIONS[assignment.state]?.includes(newState)) {
    throw new Error(`Invalid transition: ${assignment.state} → ${newState}`);
  }

  if (Date.parse(now) < Date.parse(assignment.assignedAt)) {
    throw new Error('Transition timestamp cannot be before assignedAt');
  }

  const cancelledAt = newState === 'cancelled' ? now : (assignment.state === 'cancelled' ? null : assignment.cancelledAt);
  const completedAt = newState === 'completed' ? now : (assignment.state === 'completed' ? now : null);

  return Object.freeze({
    ...assignment,
    state: newState,
    cancelledAt,
    completedAt,
  });
}

/**
 * Reassigns a deliberately cancelled student assignment to a new student and,
 * when applicable, assistant. The original assignment identity is retained so
 * replacement remains one audited lifecycle rather than a second aggregate.
 */
export function reassignStudentAssignment(
  assignment: Readonly<StudentAssignment>,
  studentId: PersonId,
  assistantId: PersonId | null | undefined,
  now: string,
): Readonly<StudentAssignment> {
  validateInstant(now);
  if (assignment.state !== 'cancelled') throw new Error('Only a cancelled student assignment can be reassigned');
  const nextStudentId = required(studentId, 'studentId');
  const nextAssistantId = normalizeAssistantId(assistantId);
  if (assignment.assistantIsRequired && nextAssistantId === null) throw new Error('Assistant is required but none was provided');
  if (nextAssistantId !== null && nextAssistantId === nextStudentId) throw new Error('Student and assistant must be different people');
  const reassigned = transitionStudentAssignment(assignment, 'assigned', now);
  return Object.freeze({
    ...reassigned,
    studentId: nextStudentId,
    assistantId: nextAssistantId,
    assignedAt: now,
    cancelledAt: null,
    completedAt: null,
  });
}

// ── Tenant isolation ───────────────────────────────────────────────────────

export function assertStudentAssignmentTenant(
  assignment: Readonly<StudentAssignment>,
  tenantId: TenantId,
): void {
  required(tenantId, 'tenantId');
  if (assignment.tenantId !== tenantId) {
    throw new Error('Cross-tenant student assignment access denied');
  }
}

// ── Normalization (re-hydration) ───────────────────────────────────────────

export function normalizeStudentAssignment(
  input: StudentAssignment,
): Readonly<StudentAssignment> {
  const id = required(input.id, 'assignmentId');
  const tenantId = required(input.tenantId, 'tenantId');
  const meetingId = required(input.meetingId, 'meetingId');
  const slotId = required(input.slotId, 'slotId');
  const studentId = required(input.studentId, 'studentId');
  const assistantId = normalizeAssistantId(input.assistantId);

  if (typeof input.assistantIsRequired !== 'boolean') {
    throw new Error('assistantIsRequired must be a boolean');
  }

  assertValidState(input.state);
  validateInstant(input.assignedAt);

  if (input.cancelledAt !== null) validateInstant(input.cancelledAt);
  if (input.completedAt !== null) validateInstant(input.completedAt);

  // Consistency checks
  if (input.state === 'assigned' && (input.cancelledAt !== null || input.completedAt !== null)) {
    throw new Error('assigned state must not have cancelledAt or completedAt');
  }
  if (input.state === 'cancelled' && input.cancelledAt === null) {
    throw new Error('cancelled state requires cancelledAt');
  }
  if (input.state === 'completed' && input.completedAt === null) {
    throw new Error('completed state requires completedAt');
  }
  if (input.cancelledAt !== null && Date.parse(input.cancelledAt) < Date.parse(input.assignedAt)) {
    throw new Error('cancelledAt cannot be before assignedAt');
  }
  if (input.completedAt !== null && Date.parse(input.completedAt) < Date.parse(input.assignedAt)) {
    throw new Error('completedAt cannot be before assignedAt');
  }

  if (input.assistantIsRequired && assistantId === null) {
    throw new Error('Assistant is required but none was provided');
  }

  return Object.freeze({
    ...input,
    id, tenantId, meetingId, slotId, studentId, assistantId,
  });
}
