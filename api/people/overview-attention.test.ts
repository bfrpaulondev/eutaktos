import { describe, expect, it } from 'vitest';
import type { CongregationPerson } from '@eutaktos/domain';
import {
  OPERATIONAL_PROFILE_REQUIREMENT_CODES,
  profileCompletenessEvidence,
  recentAvailabilityChangesEvidence,
} from './overview-attention';
import type { DomainEventProjectionRow } from '../_domain-event-reader';

function person(id: string, preferredLocale?: string, active = true, tenantId = 'tenant-a'): CongregationPerson {
  return {
    id,
    tenantId,
    displayName: `Person ${id}`,
    ...(preferredLocale === undefined ? {} : { preferredLocale }),
    active,
    availability: [],
    eligibility: [],
  };
}

function event(id: string, personId: string, occurredAt: string, overrides: Partial<DomainEventProjectionRow> = {}): DomainEventProjectionRow {
  return {
    tenant_id: 'tenant-a',
    id,
    event_type: 'AvailabilityChanged',
    aggregate_id: personId,
    occurred_at: occurredAt,
    schema_version: 1,
    ...overrides,
  };
}

describe('People Overview authoritative attention contracts', () => {
  it('uses the explicit v1 operational profile requirement without making PII mandatory', () => {
    const evidence = profileCompletenessEvidence([
      person('complete', 'pt-PT'),
      person('missing'),
      person('blank', '   '),
      person('inactive-missing', undefined, false),
    ]);

    expect(OPERATIONAL_PROFILE_REQUIREMENT_CODES).toEqual(['PREFERRED_LOCALE']);
    expect(evidence).toEqual({
      status: 'ready',
      contractVersion: 'operational-profile-requirements-v1',
      scope: 'active-people',
      requirementCodes: ['PREFERRED_LOCALE'],
      evaluatedPersonCount: 3,
      incompletePersonCount: 2,
    });
  });

  it('counts each active current person at most once from canonical availability events in the 14-day window', () => {
    const now = new Date('2026-08-26T08:00:00.000Z');
    const evidence = recentAvailabilityChangesEvidence('tenant-a', [
      person('changed', 'pt-PT'),
      person('also-changed', 'en'),
      person('inactive', 'pt-PT', false),
      person('foreign-current', 'pt-PT', true, 'tenant-b'),
    ], [
      event('e1', 'changed', '2026-08-25T10:00:00.000Z'),
      event('e2', 'changed', '2026-08-24T10:00:00.000Z'),
      event('e3', 'also-changed', '2026-08-20T11:00:00.000Z'),
      event('old', 'changed', '2026-08-01T10:00:00.000Z'),
      event('future', 'changed', '2026-08-27T10:00:00.000Z'),
      event('inactive', 'inactive', '2026-08-25T10:00:00.000Z'),
      event('deleted', 'deleted-person', '2026-08-25T10:00:00.000Z'),
      event('foreign', 'changed', '2026-08-25T10:00:00.000Z', { tenant_id: 'tenant-b' }),
      event('wrong-type', 'changed', '2026-08-25T10:00:00.000Z', { event_type: 'PersonUpdated' }),
    ], now);

    expect(evidence).toEqual({
      status: 'ready',
      contractVersion: 'recent-availability-changes-v1',
      scope: 'active-people',
      windowDays: 14,
      changedPersonCount: 2,
      latestChangedAt: '2026-08-25T10:00:00.000Z',
    });
  });

  it('returns factual zero rather than unknown when the canonical event window is empty', () => {
    expect(recentAvailabilityChangesEvidence('tenant-a', [person('a', 'pt-PT')], [], new Date('2026-08-26T08:00:00.000Z'))).toEqual({
      status: 'ready',
      contractVersion: 'recent-availability-changes-v1',
      scope: 'active-people',
      windowDays: 14,
      changedPersonCount: 0,
    });
  });
});
