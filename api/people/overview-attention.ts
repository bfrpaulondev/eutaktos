import type { CongregationPerson } from '@eutaktos/domain';
import type { DomainEventProjectionRow } from '../_domain-event-reader';

export const OPERATIONAL_PROFILE_REQUIREMENTS_VERSION = 'operational-profile-requirements-v1' as const;
export const OPERATIONAL_PROFILE_REQUIREMENT_CODES = Object.freeze(['PREFERRED_LOCALE'] as const);
export const RECENT_AVAILABILITY_CHANGES_VERSION = 'recent-availability-changes-v1' as const;
export const RECENT_AVAILABILITY_WINDOW_DAYS = 14;

export type OperationalProfileRequirementCode = typeof OPERATIONAL_PROFILE_REQUIREMENT_CODES[number];

export interface ReadyProfileCompletenessEvidence {
  readonly status: 'ready';
  readonly contractVersion: typeof OPERATIONAL_PROFILE_REQUIREMENTS_VERSION;
  readonly scope: 'active-people';
  readonly requirementCodes: readonly OperationalProfileRequirementCode[];
  readonly evaluatedPersonCount: number;
  readonly incompletePersonCount: number;
}

export interface ReadyRecentAvailabilityChangesEvidence {
  readonly status: 'ready';
  readonly contractVersion: typeof RECENT_AVAILABILITY_CHANGES_VERSION;
  readonly scope: 'active-people';
  readonly windowDays: typeof RECENT_AVAILABILITY_WINDOW_DAYS;
  readonly changedPersonCount: number;
  readonly latestChangedAt?: string;
}

/**
 * Product-level operational completeness contract v1.
 *
 * `displayName` is already a domain invariant on every valid Person and therefore
 * is not useful as an attention condition. Phone/address/emergency contacts are
 * intentionally NOT requirements: making them mandatory would create unnecessary
 * PII pressure. Preferred locale is the sole v1 operational requirement because
 * person-directed localized communication/workflows cannot be reliably tailored
 * without an explicit locale. This contract does not change create/update
 * validation; it only identifies active profiles that deserve human review.
 */
export function profileCompletenessEvidence(
  people: readonly Readonly<CongregationPerson>[],
): ReadyProfileCompletenessEvidence {
  const active = people.filter(person => person.active);
  const incompletePersonCount = active.filter(person => !person.preferredLocale?.trim()).length;
  return Object.freeze({
    status: 'ready',
    contractVersion: OPERATIONAL_PROFILE_REQUIREMENTS_VERSION,
    scope: 'active-people',
    requirementCodes: OPERATIONAL_PROFILE_REQUIREMENT_CODES,
    evaluatedPersonCount: active.length,
    incompletePersonCount,
  });
}

function validInstant(value: string): number | undefined {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

/**
 * Builds minimized recent-availability evidence from canonical AvailabilityChanged
 * domain events. Only current active People in the authenticated tenant count;
 * deleted/foreign/inactive aggregates cannot inflate the card. Event actor/payload
 * data is not accepted by this contract at all.
 */
export function recentAvailabilityChangesEvidence(
  tenantId: string,
  people: readonly Readonly<CongregationPerson>[],
  events: readonly Readonly<DomainEventProjectionRow>[],
  now: Date = new Date(),
): ReadyRecentAvailabilityChangesEvidence {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error('Invalid recent-availability reference time');
  const cutoffMs = nowMs - RECENT_AVAILABILITY_WINDOW_DAYS * 86_400_000;
  const activeIds = new Set(people.filter(person => person.tenantId === tenantId && person.active).map(person => person.id));
  const latestByPerson = new Map<string, number>();

  for (const event of events) {
    if (event.tenant_id !== tenantId || event.event_type !== 'AvailabilityChanged' || event.schema_version < 1) continue;
    if (!activeIds.has(event.aggregate_id)) continue;
    const occurredAt = validInstant(event.occurred_at);
    if (occurredAt === undefined || occurredAt < cutoffMs || occurredAt > nowMs) continue;
    const previous = latestByPerson.get(event.aggregate_id);
    if (previous === undefined || occurredAt > previous) latestByPerson.set(event.aggregate_id, occurredAt);
  }

  const latest = latestByPerson.size > 0 ? Math.max(...latestByPerson.values()) : undefined;
  return Object.freeze({
    status: 'ready',
    contractVersion: RECENT_AVAILABILITY_CHANGES_VERSION,
    scope: 'active-people',
    windowDays: RECENT_AVAILABILITY_WINDOW_DAYS,
    changedPersonCount: latestByPerson.size,
    ...(latest === undefined ? {} : { latestChangedAt: new Date(latest).toISOString() }),
  });
}
