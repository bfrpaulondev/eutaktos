import type { AssignmentTypeId, CongregationPerson, PersonId, TenantId } from './people';

export interface EligibilityIndex {
  readonly tenantId: TenantId;
  readonly decisions: Readonly<Record<string, boolean>>;
}

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function instant(value: string, field: string): number {
  if (typeof value !== 'string') throw new Error(`${field} must be an ISO instant`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be an ISO instant`);
  return parsed;
}

function key(personId: PersonId, assignmentTypeId: AssignmentTypeId): string {
  return JSON.stringify([required(personId, 'personId'), required(assignmentTypeId, 'assignmentTypeId')]);
}

export function buildEligibilityIndex(
  people: readonly CongregationPerson[],
  tenantIdInput: TenantId,
): Readonly<EligibilityIndex> {
  if (!Array.isArray(people)) throw new Error('people must be an array');
  const tenantId = required(tenantIdInput, 'tenantId');
  const latest = new Map<string, { enabled: boolean; decidedAt: number; tieBreaker: string }>();

  for (const person of people) {
    if (!person || typeof person !== 'object') throw new Error('person must be an object');
    if (person.tenantId !== tenantId) continue;
    const personId = required(person.id, 'personId');
    if (!Array.isArray(person.eligibility)) throw new Error('eligibility must be an array');

    for (const grant of person.eligibility) {
      if (!grant || typeof grant !== 'object') throw new Error('eligibility grant must be an object');
      const assignmentTypeId = required(grant.assignmentTypeId, 'assignmentTypeId');
      if (typeof grant.enabled !== 'boolean') throw new Error('eligibility enabled must be a boolean');
      const decidedAt = instant(grant.decidedAt, 'decidedAt');
      const decidedBy = required(grant.decidedBy, 'decidedBy');
      const lookupKey = key(personId, assignmentTypeId);
      const current = latest.get(lookupKey);
      if (!current || decidedAt > current.decidedAt || (decidedAt === current.decidedAt && decidedBy > current.tieBreaker)) {
        latest.set(lookupKey, { enabled: grant.enabled, decidedAt, tieBreaker: decidedBy });
      }
    }
  }

  const decisions: Record<string, boolean> = Object.create(null) as Record<string, boolean>;
  for (const [lookupKey, decision] of [...latest.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    decisions[lookupKey] = decision.enabled;
  }
  Object.freeze(decisions);
  return Object.freeze({ tenantId, decisions });
}

export function checkEligibility(
  index: Readonly<EligibilityIndex>,
  tenantIdInput: TenantId,
  personId: PersonId,
  assignmentTypeId: AssignmentTypeId,
): boolean {
  const tenantId = required(tenantIdInput, 'tenantId');
  if (index.tenantId !== tenantId) throw new Error('Cross-tenant eligibility index access denied');
  return index.decisions[key(personId, assignmentTypeId)] === true;
}

export function assertExplicitEligibility(
  index: Readonly<EligibilityIndex>,
  tenantId: TenantId,
  personId: PersonId,
  assignmentTypeId: AssignmentTypeId,
): void {
  if (!checkEligibility(index, tenantId, personId, assignmentTypeId)) {
    throw new Error('Person is not explicitly eligible for this assignment type');
  }
}
