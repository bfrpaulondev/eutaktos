import type { TenantId, PersonId } from './people';

export type AssignmentResponseId = string;
export type AssignmentResponseStatus = 'pending' | 'confirmed' | 'declined' | 'acknowledged';
export const ASSIGNMENT_RESPONSE_STATUSES: readonly AssignmentResponseStatus[] = Object.freeze(['pending', 'confirmed', 'declined', 'acknowledged'] as const);
export interface StructuredReason { readonly code: string; readonly detail?: string; }
export interface AssignmentResponse {
  readonly id: AssignmentResponseId; readonly tenantId: TenantId; readonly assignmentId: string;
  readonly personId: PersonId; readonly status: AssignmentResponseStatus; readonly reason: StructuredReason | null;
  readonly respondedAt: string | null; readonly acknowledgedAt: string | null; readonly createdAt: string;
}
function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim(); if (!normalized) throw new Error(`${field} is required`); return normalized;
}
function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${String(value)}`);
}
function normalizeReason(reason: StructuredReason | null | undefined): Readonly<StructuredReason> | null {
  if (reason === null || reason === undefined) return null;
  const code = required(reason.code, 'reason.code');
  if (code.length > 100) throw new Error('reason.code is too long (max 100)');
  const detail = reason.detail?.trim();
  if (detail && detail.length > 500) throw new Error('reason.detail is too long (max 500)');
  return Object.freeze(detail ? { code, detail } : { code });
}
const VALID_TRANSITIONS: Readonly<Record<AssignmentResponseStatus, readonly AssignmentResponseStatus[]>> = {
  pending: ['confirmed', 'declined', 'acknowledged'], confirmed: ['acknowledged'], declined: ['acknowledged'], acknowledged: [],
};
export function createAssignmentResponse(input: {
  id: AssignmentResponseId; tenantId: TenantId; assignmentId: string; personId: PersonId; now: string;
}): Readonly<AssignmentResponse> {
  validateInstant(input.now);
  return Object.freeze({
    id: required(input.id, 'responseId'), tenantId: required(input.tenantId, 'tenantId'),
    assignmentId: required(input.assignmentId, 'assignmentId'), personId: required(input.personId, 'personId'),
    status: 'pending', reason: null, respondedAt: null, acknowledgedAt: null, createdAt: input.now,
  });
}
export function transitionAssignmentResponse(
  response: Readonly<AssignmentResponse>, newStatus: AssignmentResponseStatus, now: string, reason?: StructuredReason,
): Readonly<AssignmentResponse> {
  validateInstant(now);
  if (Date.parse(now) < Date.parse(response.createdAt)) throw new Error('response timestamp cannot be before createdAt');
  if (!ASSIGNMENT_RESPONSE_STATUSES.includes(newStatus) || !VALID_TRANSITIONS[response.status]?.includes(newStatus)) {
    throw new Error(`Invalid transition: ${response.status} → ${newStatus}`);
  }
  let respondedAt = response.respondedAt; let acknowledgedAt = response.acknowledgedAt; let reasonOut = response.reason;
  if (newStatus === 'confirmed' || newStatus === 'declined') {
    respondedAt = now; reasonOut = normalizeReason(reason);
  }
  if (newStatus === 'acknowledged') {
    if (reason !== undefined) throw new Error('reason is only accepted when confirming or declining');
    if (respondedAt !== null && Date.parse(now) < Date.parse(respondedAt)) throw new Error('acknowledgedAt cannot be before respondedAt');
    acknowledgedAt = now;
  }
  return Object.freeze({ ...response, status: newStatus, reason: reasonOut, respondedAt, acknowledgedAt });
}
export function transitionAssignmentResponseIdempotent(
  response: Readonly<AssignmentResponse>, targetStatus: AssignmentResponseStatus, now: string, reason?: StructuredReason,
): Readonly<AssignmentResponse> {
  return response.status === targetStatus ? response : transitionAssignmentResponse(response, targetStatus, now, reason);
}
export function assertResponseTenant(response: Readonly<AssignmentResponse>, tenantId: TenantId): void {
  if (response.tenantId !== tenantId) throw new Error('Cross-tenant assignment response access denied');
}
export function normalizeAssignmentResponse(input: AssignmentResponse): Readonly<AssignmentResponse> {
  const id = required(input.id, 'responseId'); const tenantId = required(input.tenantId, 'tenantId');
  const assignmentId = required(input.assignmentId, 'assignmentId'); const personId = required(input.personId, 'personId');
  validateInstant(input.createdAt);
  if (!ASSIGNMENT_RESPONSE_STATUSES.includes(input.status)) throw new Error(`Invalid assignment response status: ${input.status}`);
  if (input.respondedAt !== null) { validateInstant(input.respondedAt); if (Date.parse(input.respondedAt) < Date.parse(input.createdAt)) throw new Error('respondedAt cannot be before createdAt'); }
  if (input.acknowledgedAt !== null) { validateInstant(input.acknowledgedAt); if (Date.parse(input.acknowledgedAt) < Date.parse(input.createdAt)) throw new Error('acknowledgedAt cannot be before createdAt'); }
  if (input.status === 'pending' && (input.respondedAt !== null || input.acknowledgedAt !== null || input.reason !== null)) throw new Error('pending response cannot contain response metadata');
  if ((input.status === 'confirmed' || input.status === 'declined') && input.respondedAt === null) throw new Error(`${input.status} response requires respondedAt`);
  if ((input.status === 'confirmed' || input.status === 'declined') && input.acknowledgedAt !== null) throw new Error(`${input.status} response cannot contain acknowledgedAt`);
  if (input.status === 'acknowledged') {
    if (input.acknowledgedAt === null) throw new Error('acknowledged response requires acknowledgedAt');
    if (input.respondedAt !== null && Date.parse(input.acknowledgedAt) < Date.parse(input.respondedAt)) throw new Error('acknowledgedAt cannot be before respondedAt');
  }
  return Object.freeze({ ...input, id, tenantId, assignmentId, personId, reason: normalizeReason(input.reason) });
}
