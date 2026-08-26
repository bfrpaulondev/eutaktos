import type { AssignmentTypeId, PersonId, TenantId } from './people';

export type AssignmentExclusionId = string;

/**
 * Explicit, human-authored scheduling constraint. It is deliberately separate
 * from eligibility: eligibility answers whether a person is generally eligible
 * for an assignment type; an exclusion says not to consider that otherwise
 * eligible person for this type during an optional operational time window.
 */
export interface AssignmentExclusion {
  readonly id: AssignmentExclusionId;
  readonly tenantId: TenantId;
  readonly personId: PersonId;
  readonly assignmentTypeId: AssignmentTypeId;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly createdAt: string;
  readonly revokedAt?: string;
}

export interface CreateAssignmentExclusionInput {
  readonly id: AssignmentExclusionId;
  readonly tenantId: TenantId;
  readonly personId: PersonId;
  readonly assignmentTypeId: AssignmentTypeId;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly createdAt: string;
}

function required(value: string, field: string, maxLength = 200): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  if (normalized.length > maxLength) throw new Error(`${field} is too long`);
  return normalized;
}

function instant(value: string, field: string): string {
  const normalized = required(value, field, 80);
  if (!/T/.test(normalized) || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized) || !Number.isFinite(Date.parse(normalized))) {
    throw new Error(`${field} must be a timezone-aware ISO instant`);
  }
  return normalized;
}

export function createAssignmentExclusion(input: CreateAssignmentExclusionInput): Readonly<AssignmentExclusion> {
  const startsAt = input.startsAt === undefined ? undefined : instant(input.startsAt, 'startsAt');
  const endsAt = input.endsAt === undefined ? undefined : instant(input.endsAt, 'endsAt');
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new Error('Assignment exclusion must end after it starts');
  }
  return Object.freeze({
    id: required(input.id, 'assignmentExclusionId'),
    tenantId: required(input.tenantId, 'tenantId'),
    personId: required(input.personId, 'personId'),
    assignmentTypeId: required(input.assignmentTypeId, 'assignmentTypeId'),
    ...(startsAt ? { startsAt } : {}),
    ...(endsAt ? { endsAt } : {}),
    createdAt: instant(input.createdAt, 'createdAt'),
  });
}

export function normalizeAssignmentExclusion(input: AssignmentExclusion): Readonly<AssignmentExclusion> {
  const created = createAssignmentExclusion(input);
  const revokedAt = input.revokedAt === undefined ? undefined : instant(input.revokedAt, 'revokedAt');
  if (revokedAt && Date.parse(revokedAt) < Date.parse(created.createdAt)) {
    throw new Error('Assignment exclusion cannot be revoked before it was created');
  }
  return Object.freeze({ ...created, ...(revokedAt ? { revokedAt } : {}) });
}

export function revokeAssignmentExclusion(input: AssignmentExclusion, revokedAtInput: string): Readonly<AssignmentExclusion> {
  const current = normalizeAssignmentExclusion(input);
  if (current.revokedAt) return current;
  const revokedAt = instant(revokedAtInput, 'revokedAt');
  if (Date.parse(revokedAt) < Date.parse(current.createdAt)) throw new Error('Assignment exclusion cannot be revoked before it was created');
  return Object.freeze({ ...current, revokedAt });
}

/** True when an active exclusion overlaps the target scheduling window. */
export function assignmentExclusionApplies(
  input: AssignmentExclusion,
  tenantId: TenantId,
  personId: PersonId,
  assignmentTypeId: AssignmentTypeId,
  startsAtInput: string,
  endsAtInput: string,
): boolean {
  const exclusion = normalizeAssignmentExclusion(input);
  if (exclusion.tenantId !== tenantId || exclusion.personId !== personId || exclusion.assignmentTypeId !== assignmentTypeId || exclusion.revokedAt) return false;
  const startsAt = instant(startsAtInput, 'startsAt');
  const endsAt = instant(endsAtInput, 'endsAt');
  if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error('Target interval must end after it starts');
  const exclusionStart = exclusion.startsAt ? Date.parse(exclusion.startsAt) : Number.NEGATIVE_INFINITY;
  const exclusionEnd = exclusion.endsAt ? Date.parse(exclusion.endsAt) : Number.POSITIVE_INFINITY;
  return Date.parse(startsAt) < exclusionEnd && exclusionStart < Date.parse(endsAt);
}
