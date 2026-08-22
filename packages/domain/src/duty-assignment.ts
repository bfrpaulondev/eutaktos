import type { PersonId, TenantId } from './people';

export type DutyAssignmentState = 'assigned' | 'cancelled' | 'completed';

export interface DutyDefinition {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly key: string;
  readonly label: string;
}

export interface DutyAssignment {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly definitionId: string;
  readonly personId: PersonId;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly state: DutyAssignmentState;
  readonly assignedAt: string;
  readonly cancelledAt: string | null;
  readonly completedAt: string | null;
}

function required(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}
function instant(value: unknown, field: string): string {
  const normalized = required(value, field);
  if (!Number.isFinite(Date.parse(normalized))) throw new Error(`${field} must be an ISO instant`);
  return normalized;
}
function window(startsAt: string, endsAt: string): void {
  if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error('Duty must end after it starts');
}

export function createDutyDefinition(input: DutyDefinition): Readonly<DutyDefinition> {
  return Object.freeze({ id: required(input.id, 'dutyDefinitionId'), tenantId: required(input.tenantId, 'tenantId'), key: required(input.key, 'dutyKey'), label: required(input.label, 'dutyLabel') });
}

export function createDutyAssignment(input: Omit<DutyAssignment, 'state' | 'cancelledAt' | 'completedAt'>): Readonly<DutyAssignment> {
  const startsAt = instant(input.startsAt, 'startsAt'); const endsAt = instant(input.endsAt, 'endsAt'); const assignedAt = instant(input.assignedAt, 'assignedAt');
  window(startsAt, endsAt);
  if (Date.parse(assignedAt) > Date.parse(startsAt)) throw new Error('Duty cannot be recorded as assigned after it starts');
  return Object.freeze({ id: required(input.id, 'dutyAssignmentId'), tenantId: required(input.tenantId, 'tenantId'), definitionId: required(input.definitionId, 'dutyDefinitionId'), personId: required(input.personId, 'personId'), startsAt, endsAt, assignedAt, state: 'assigned', cancelledAt: null, completedAt: null });
}

export function cancelDutyAssignment(assignment: Readonly<DutyAssignment>, now: string): Readonly<DutyAssignment> {
  const occurredAt = instant(now, 'now');
  if (assignment.state !== 'assigned') throw new Error(`Invalid duty transition: ${assignment.state} -> cancelled`);
  if (Date.parse(occurredAt) < Date.parse(assignment.assignedAt)) throw new Error('Duty cancellation cannot precede assignment');
  return Object.freeze({ ...assignment, state: 'cancelled', cancelledAt: occurredAt, completedAt: null });
}

export function completeDutyAssignment(assignment: Readonly<DutyAssignment>, now: string): Readonly<DutyAssignment> {
  const occurredAt = instant(now, 'now');
  if (assignment.state !== 'assigned') throw new Error(`Invalid duty transition: ${assignment.state} -> completed`);
  if (Date.parse(occurredAt) < Date.parse(assignment.startsAt)) throw new Error('Duty cannot be completed before it starts');
  return Object.freeze({ ...assignment, state: 'completed', completedAt: occurredAt, cancelledAt: null });
}

export function replaceDutyAssignment(assignment: Readonly<DutyAssignment>, personId: PersonId, now: string): Readonly<DutyAssignment> {
  const occurredAt = instant(now, 'now');
  const cancelled = cancelDutyAssignment(assignment, occurredAt);
  return Object.freeze({ ...cancelled, personId: required(personId, 'personId'), state: 'assigned', assignedAt: occurredAt, cancelledAt: null, completedAt: null });
}

export function assertDutyAssignmentTenant(assignment: Readonly<DutyAssignment>, tenantId: TenantId): void {
  if (assignment.tenantId !== required(tenantId, 'tenantId')) throw new Error('Cross-tenant duty assignment access denied');
}

export function dutyAssignmentsForTenant(assignments: readonly Readonly<DutyAssignment>[], tenantId: TenantId): readonly Readonly<DutyAssignment>[] {
  const tenant = required(tenantId, 'tenantId');
  return Object.freeze(assignments.filter(assignment => assignment.tenantId === tenant));
}
