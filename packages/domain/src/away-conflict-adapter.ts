import {
  assertTenantScope,
  validateAvailability,
  type CongregationPerson,
  type TenantId,
} from './people';
import type { UnavailableInterval } from './conflict-engine';

export function unavailableIntervalsForPerson(
  person: CongregationPerson,
  tenantId: TenantId,
): readonly UnavailableInterval[] {
  if (!Array.isArray(person.availability)) throw new Error('availability must be an array');
  assertTenantScope(person, tenantId);

  const periods = person.availability.map((period, index) => {
    validateAvailability(period);
    const sourceId = period.id?.trim() || `legacy:${person.id}:${index}`;
    return Object.freeze({
      tenantId: person.tenantId,
      personId: person.id,
      sourceId,
      startsAt: period.startsAt,
      endsAt: period.endsAt,
    });
  });

  return Object.freeze(periods);
}

export function unavailableIntervalsForPeople(
  people: readonly CongregationPerson[],
  tenantId: TenantId,
): readonly UnavailableInterval[] {
  if (!Array.isArray(people)) throw new Error('people must be an array');
  const result: UnavailableInterval[] = [];
  for (const person of people) {
    if (person.tenantId !== tenantId) continue;
    result.push(...unavailableIntervalsForPerson(person, tenantId));
  }
  return Object.freeze(result);
}
