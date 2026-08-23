import type { PersonId, TenantId } from './people';

export type HouseholdId = string;
export type ServiceGroupId = string;
export type ResponsibilityId = string;

export interface TenantScopedEntity {
  tenantId: TenantId;
}

export interface Household extends TenantScopedEntity {
  id: HouseholdId;
  name: string;
  memberIds: readonly PersonId[];
}

export interface ServiceGroup extends TenantScopedEntity {
  id: ServiceGroupId;
  name: string;
  memberIds: readonly PersonId[];
  overseerId?: PersonId;
  assistantId?: PersonId;
}

export interface ResponsibilityAssignment extends TenantScopedEntity {
  id: ResponsibilityId;
  personId: PersonId;
  responsibilityKey: string;
  startsAt: string;
  endsAt?: string;
  assignedBy: PersonId;
  assignedAt: string;
}

function required(value: string, field: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function parseInstant(value: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid ISO date: ${value}`);
  return timestamp;
}

function uniquePersonIds(memberIds: readonly PersonId[]): readonly PersonId[] {
  const normalized = memberIds.map(id => required(id, 'personId'));
  if (new Set(normalized).size !== normalized.length) throw new Error('Duplicate person membership is not allowed');
  return normalized;
}

export function createHousehold(input: Household): Household {
  required(input.id, 'householdId');
  required(input.tenantId, 'tenantId');
  const name = required(input.name, 'household name');
  return { ...input, name, memberIds: uniquePersonIds(input.memberIds) };
}

export function createServiceGroup(input: ServiceGroup): ServiceGroup {
  required(input.id, 'serviceGroupId');
  required(input.tenantId, 'tenantId');
  const name = required(input.name, 'service group name');
  const memberIds = uniquePersonIds(input.memberIds);

  for (const leaderId of [input.overseerId, input.assistantId]) {
    if (leaderId && !memberIds.includes(leaderId)) {
      throw new Error('Service group leaders must also be group members');
    }
  }

  if (input.overseerId && input.assistantId && input.overseerId === input.assistantId) {
    throw new Error('Service group overseer and assistant must be different people');
  }

  return { ...input, name, memberIds };
}

export function validateResponsibilityAssignment(input: ResponsibilityAssignment): ResponsibilityAssignment {
  required(input.id, 'responsibilityId');
  required(input.tenantId, 'tenantId');
  required(input.personId, 'personId');
  required(input.responsibilityKey, 'responsibilityKey');
  required(input.assignedBy, 'assignedBy');

  const startsAt = parseInstant(input.startsAt);
  parseInstant(input.assignedAt);
  if (input.endsAt && parseInstant(input.endsAt) <= startsAt) {
    throw new Error('Responsibility assignment must end after it starts');
  }

  return input;
}

export function isResponsibilityActiveAt(input: ResponsibilityAssignment, instant: string): boolean {
  validateResponsibilityAssignment(input);
  const target = parseInstant(instant);
  const startsAt = parseInstant(input.startsAt);
  const endsAt = input.endsAt ? parseInstant(input.endsAt) : Number.POSITIVE_INFINITY;
  return target >= startsAt && target < endsAt;
}

export function assertSameTenant(tenantId: TenantId, ...entities: readonly TenantScopedEntity[]): void {
  if (entities.some(entity => entity.tenantId !== tenantId)) {
    throw new Error('Cross-tenant organization access denied');
  }
}