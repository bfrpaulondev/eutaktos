import { HOURGLASS_EXTERNAL_ID_PREFIX, HOURGLASS_PRIVILEGE_PREFIX } from '@eutaktos/application';
import { latestEligibilityDecision, type CongregationPerson } from '@eutaktos/domain';

export interface AuthorizedHourglassIndexPerson {
  readonly externalId: string;
  readonly personId: string;
  readonly displayName: string;
  readonly active: boolean;
  readonly explicitAssignmentTypeIds: readonly string[];
}

function enabledHourglassEligibility(person: CongregationPerson): readonly string[] {
  const ids = [...new Set(person.eligibility.map(decision => decision.assignmentTypeId))]
    .filter(id => id.startsWith(HOURGLASS_PRIVILEGE_PREFIX))
    .filter(id => latestEligibilityDecision(person.eligibility, id)?.enabled === true)
    .sort();
  return Object.freeze(ids);
}

/**
 * Projects only migration identity and explicit Hourglass eligibility. Ordinary and
 * emergency contact data, availability, tenant id and unrelated eligibility never
 * leave the server through this index.
 */
export function buildAuthorizedHourglassIndex(people: readonly CongregationPerson[]): readonly Readonly<AuthorizedHourglassIndexPerson>[] {
  const index: AuthorizedHourglassIndexPerson[] = [];
  const seen = new Set<string>();
  for (const person of people) {
    const explicitAssignmentTypeIds = enabledHourglassEligibility(person);
    for (const externalId of person.externalIds ?? []) {
      if (!externalId.startsWith(HOURGLASS_EXTERNAL_ID_PREFIX)) continue;
      if (seen.has(externalId)) throw new Error('Duplicate existing Hourglass external id');
      seen.add(externalId);
      index.push({ externalId, personId: person.id, displayName: person.displayName, active: person.active, explicitAssignmentTypeIds });
    }
  }
  index.sort((left, right) => left.externalId.localeCompare(right.externalId));
  return Object.freeze(index.map(item => Object.freeze({ ...item, explicitAssignmentTypeIds: Object.freeze([...item.explicitAssignmentTypeIds]) })));
}
