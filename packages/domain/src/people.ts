export type TenantId = string;
export type PersonId = string;
export type AssignmentTypeId = string;

export interface AvailabilityPeriod {
  startsAt: string;
  endsAt: string;
  reasonCode?: 'away' | 'unavailable' | 'other';
}

export interface EligibilityGrant {
  assignmentTypeId: AssignmentTypeId;
  enabled: boolean;
  decidedBy: PersonId;
  decidedAt: string;
}

export interface CongregationPerson {
  id: PersonId;
  tenantId: TenantId;
  displayName: string;
  preferredLocale?: string;
  active: boolean;
  availability: readonly AvailabilityPeriod[];
  eligibility: readonly EligibilityGrant[];
}

export interface EligibilityDecisionInput {
  assignmentTypeId: AssignmentTypeId;
  enabled: boolean;
  decidedBy: PersonId;
  decidedAt: string;
}

function parseInstant(value: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid ISO date: ${value}`);
  return timestamp;
}

export function validateAvailability(period: AvailabilityPeriod): AvailabilityPeriod {
  const startsAt = parseInstant(period.startsAt);
  const endsAt = parseInstant(period.endsAt);
  if (endsAt <= startsAt) throw new Error('Availability period must end after it starts');
  return period;
}

export function isPersonAvailableAt(person: CongregationPerson, instant: string): boolean {
  if (!person.active) return false;
  const target = parseInstant(instant);

  return !person.availability.some(period => {
    validateAvailability(period);
    return target >= parseInstant(period.startsAt) && target < parseInstant(period.endsAt);
  });
}

/**
 * Eligibility is deliberately explicit. The domain layer never infers suitability
 * from gender, age, service history, attendance, comments, roles, AI output or any
 * other proxy. Authorized humans configure this value and the scheduler consumes it.
 */
export function isExplicitlyEligible(person: CongregationPerson, assignmentTypeId: AssignmentTypeId): boolean {
  const latest = [...person.eligibility]
    .filter(grant => grant.assignmentTypeId === assignmentTypeId)
    .sort((left, right) => parseInstant(right.decidedAt) - parseInstant(left.decidedAt))[0];

  return latest?.enabled === true;
}

export function recordEligibilityDecision(
  person: CongregationPerson,
  input: EligibilityDecisionInput,
): CongregationPerson {
  parseInstant(input.decidedAt);
  if (!input.assignmentTypeId.trim()) throw new Error('assignmentTypeId is required');
  if (!input.decidedBy.trim()) throw new Error('decidedBy is required');

  return {
    ...person,
    eligibility: [...person.eligibility, { ...input }],
  };
}

export function assertTenantScope(person: CongregationPerson, tenantId: TenantId): void {
  if (person.tenantId !== tenantId) throw new Error('Cross-tenant person access denied');
}

export function normalizeDisplayName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2) throw new Error('displayName is required');
  if (normalized.length > 120) throw new Error('displayName is too long');
  return normalized;
}
