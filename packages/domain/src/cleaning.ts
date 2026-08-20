import type { TenantId } from './people';

export type CleaningId = string;

export type CleaningType = 'weekly' | 'after-meeting' | 'custom';

export const CLEANING_TYPES: readonly CleaningType[] = Object.freeze([
  'weekly', 'after-meeting', 'custom',] as const);

export interface CleaningArrangement {
  readonly id: CleaningId;
  readonly tenantId: TenantId;
  readonly scheduleReference: string;
  readonly assigneeReferences: readonly string[];
  readonly type: CleaningType;
  readonly active: boolean;
  readonly createdAt: string;
}

function required(value: string, field: string): string {
  const n = value.trim();
  if (!n) throw new Error(`${field} is required`);
  return n;
}

function validateInstant(value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${value}`);
}

function assertValidType(type: string): CleaningType {
  if (!CLEANING_TYPES.includes(type as CleaningType)) throw new Error(`Invalid cleaning type: ${type}`);
  return type as CleaningType;
}

export function createCleaningArrangement(input: {
  id: CleaningId;
  tenantId: TenantId;
  scheduleReference: string;
  assigneeReferences: readonly string[];
  type: CleaningType;
  now: string;
}): Readonly<CleaningArrangement> {
  validateInstant(input.now);
  if (input.assigneeReferences.length === 0) throw new Error('At least one assignee is required');
  if (input.assigneeReferences.length > 50) throw new Error('Too many assignees (max 50)');

  return Object.freeze({
    id: required(input.id, 'cleaningId'),
    tenantId: required(input.tenantId, 'tenantId'),
    scheduleReference: required(input.scheduleReference, 'scheduleReference'),
    assigneeReferences: Object.freeze(input.assigneeReferences.map((a, i) => required(a, `assigneeReference[${i}]`))),
    type: assertValidType(input.type),
    active: true,
    createdAt: input.now,
  });
}

export function setCleaningActive(
  cleaning: Readonly<CleaningArrangement>,
  active: boolean,
): Readonly<CleaningArrangement> {
  return Object.freeze({ ...cleaning, active });
}

export function updateCleaningAssignees(
  cleaning: Readonly<CleaningArrangement>,
  assigneeReferences: readonly string[],
): Readonly<CleaningArrangement> {
  if (assigneeReferences.length === 0) throw new Error('At least one assignee is required');
  if (assigneeReferences.length > 50) throw new Error('Too many assignees (max 50)');
  return Object.freeze({
    ...cleaning,
    assigneeReferences: Object.freeze(assigneeReferences.map((a, i) => required(a, `assigneeReference[${i}]`))),
  });
}

export function assertCleaningTenant(cleaning: Readonly<CleaningArrangement>, tenantId: TenantId): void {
  if (cleaning.tenantId !== tenantId) throw new Error('Cross-tenant cleaning access denied');
}

export function normalizeCleaningArrangement(input: CleaningArrangement): Readonly<CleaningArrangement> {
  required(input.id, 'cleaningId');
  required(input.tenantId, 'tenantId');
  required(input.scheduleReference, 'scheduleReference');
  validateInstant(input.createdAt);
  assertValidType(input.type);
  if (input.assigneeReferences.length === 0) throw new Error('At least one assignee is required');
  return Object.freeze({ ...input, assigneeReferences: Object.freeze([...input.assigneeReferences]) });
}
