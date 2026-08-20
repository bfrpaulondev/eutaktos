import type { TenantId, PersonId } from './people';

// ── Types ──────────────────────────────────────────────────────────────────

export type AssignmentResponseId = string;

export type AssignmentResponseStatus =
  | 'pending'
  | 'confirmed'
  | 'declined'
  | 'acknowledged';

export const ASSIGNMENT_RESPONSE_STATUSES: readonly AssignmentResponseStatus[] = Object.freeze([
  'pending',
  'confirmed',
  'declined',
  'acknowledged',
] as const);

export interface StructuredReason {
  readonly code: string;
  readonly detail?: string;
}

export interface AssignmentResponse {
  readonly id: AssignmentResponseId;
  readonly tenantId: TenantId;
  readonly assignmentId: string;
  readonly personId: PersonId;
  readonly status: AssignmentResponseStatus;
  readonly reason: StructuredReason | null;
  readonly respondedAt: string | null;
  readonly acknowledgedAt: string | null;
  readonly createdAt: string;
}

// ── Internal helpers ───────────────────────────────────────────────────────

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function validateInstant(value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${value}`);
}

// ── Valid transitions ─────────────────────────────────────────────────────

const VALID_TRANSITIONS: Readonly<Record<AssignmentResponseStatus, readonly AssignmentResponseStatus[]>> = {
  pending: ['confirmed', 'declined', 'acknowledged'],
  confirmed: ['acknowledged'],
  declined: ['acknowledged'],
  acknowledged: [],
};

// ── Construction ───────────────────────────────────────────────────────────

export function createAssignmentResponse(input: {
  id: AssignmentResponseId;
  tenantId: TenantId;
  assignmentId: string;
  personId: PersonId;
  now: string;
}): Readonly<AssignmentResponse> {
 validateInstant(input.now);
 return Object.freeze({
    id: required(input.id, 'responseId'),
    tenantId: required(input.tenantId, 'tenantId'),
    assignmentId: required(input.assignmentId, 'assignmentId'),
    personId: required(input.personId, 'personId'),
    status: 'pending',
    reason: null,
    respondedAt: null,
    acknowledgedAt: null,
    createdAt: input.now,
  });
}

// ── Transitions ────────────────────────────────────────────────────────────

export function transitionAssignmentResponse(
  response: Readonly<AssignmentResponse>,
  newStatus: AssignmentResponseStatus,
  now: string,
  reason?: StructuredReason,
): Readonly<AssignmentResponse> {
  validateInstant(now);

  const allowed = VALID_TRANSITIONS[response.status];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Invalid transition: ${response.status} → ${newStatus}`);
  }

  let respondedAt = response.respondedAt;
  let acknowledgedAt = response.acknowledgedAt;
  let reasonOut = response.reason;

  if (newStatus === 'confirmed' || newStatus === 'declined') {
    respondedAt = now;
    reasonOut = reason ?? null;
    if (reason) {
      const code = reason.code.trim();
      if (!code) throw new Error('reason.code is required when reason is provided');
      if (code.length > 100) throw new Error('reason.code is too long (max 100)');
      if (reason.detail && reason.detail.length > 500) throw new Error('reason.detail is too long (max 500)');
      reasonOut = Object.freeze({ code, detail: reason.detail?.trim() });
    }
  }

  if (newStatus === 'acknowledged') {
    acknowledgedAt = now;
  }

  return Object.freeze({
    ...response,
    status: newStatus,
    reason: reasonOut,
    respondedAt,
    acknowledgedAt,
  });
}

// ── Idempotency ────────────────────────────────────────────────────────────

export function transitionAssignmentResponseIdempotent(
  response: Readonly<AssignmentResponse>,
  targetStatus: AssignmentResponseStatus,
  now: string,
  reason?: StructuredReason,
): Readonly<AssignmentResponse> {
  if (response.status === targetStatus) return response;
  return transitionAssignmentResponse(response, targetStatus, now, reason);
}

// ── Tenant isolation ───────────────────────────────────────────────────────

export function assertResponseTenant(
  response: Readonly<AssignmentResponse>,
  tenantId: TenantId,
): void {
  if (response.tenantId !== tenantId) throw new Error('Cross-tenant assignment response access denied');
}

// ── Normalization ──────────────────────────────────────────────────────────

export function normalizeAssignmentResponse(
  input: AssignmentResponse,
): Readonly<AssignmentResponse> {
  required(input.id, 'responseId');
  required(input.tenantId, 'tenantId');
  required(input.assignmentId, 'assignmentId');
  required(input.personId, 'personId');
  validateInstant(input.createdAt);
  if (input.respondedAt !== null) validateInstant(input.respondedAt);
  if (input.acknowledgedAt !== null) validateInstant(input.acknowledgedAt);
  if (!ASSIGNMENT_RESPONSE_STATUSES.includes(input.status)) {
    throw new Error(`Invalid assignment response status: ${input.status}`);
  }
  return Object.freeze({ ...input });
}
