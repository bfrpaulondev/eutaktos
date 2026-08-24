import { describe, expect, it } from 'vitest';
import { createAccessContext, type AccessContext, type CongregationPerson } from '@eutaktos/domain';
import { AvailabilityService } from './availability-service';
import { EligibilityService } from './eligibility-service';
import type { ApplicationRuntime, PeopleUnitOfWork, PersonChange } from './people-service';

class TrackingPeopleUow implements PeopleUnitOfWork {
  person: CongregationPerson;
  readonly updates: PersonChange[] = [];

  constructor(person: CongregationPerson) {
    this.person = structuredClone(person);
  }

  list(context: AccessContext): readonly CongregationPerson[] {
    return this.person.tenantId === context.tenantId ? [structuredClone(this.person)] : [];
  }

  findById(context: AccessContext, personId: string): CongregationPerson | undefined {
    return this.person.tenantId === context.tenantId && this.person.id === personId
      ? structuredClone(this.person)
      : undefined;
  }

  commitCreate(_context: AccessContext, _change: PersonChange): CongregationPerson {
    throw new Error('not used');
  }

  commitUpdate(_context: AccessContext, change: PersonChange): CongregationPerson {
    this.person = structuredClone(change.person);
    this.updates.push(change);
    return structuredClone(change.person);
  }
}

function runtime(): ApplicationRuntime {
  const counters: Record<string, number> = {};
  return {
    now: () => '2026-08-24T12:00:00.000Z',
    nextId: scope => `${scope}-${(counters[scope] = (counters[scope] ?? 0) + 1)}`,
  };
}

function context(tenantId = 'tenant-a', capabilities: AccessContext['capabilities'] = ['people.read', 'availability.write', 'eligibility.write']): Readonly<AccessContext> {
  return createAccessContext({ tenantId, actorId: 'authorized-actor', capabilities });
}

function person(overrides: Partial<CongregationPerson> = {}): CongregationPerson {
  return {
    id: 'person-1',
    tenantId: 'tenant-a',
    displayName: 'Test Person',
    active: true,
    availability: [],
    eligibility: [],
    ...overrides,
  };
}

describe('KP2 availability and eligibility invariants', () => {
  it('does not infer eligibility from person properties and requires an explicit decision', () => {
    const uow = new TrackingPeopleUow(person({ active: true }));
    const service = new EligibilityService(uow, runtime());

    expect(() => service.setEligibility(
      context('tenant-a', ['people.read', 'eligibility.write']),
      { personId: 'person-1', assignmentTypeId: 'builtin:apply-yourself-to-the-ministry', enabled: false },
    )).not.toThrow();
    expect(uow.person.eligibility.at(-1)?.enabled).toBe(false);
    expect(uow.person.eligibility.at(-1)?.decidedBy).toBe('authorized-actor');

    const readOnly = uow.person;
    expect(readOnly.active).toBe(true);
    expect(readOnly.eligibility.at(-1)?.enabled).toBe(false);
  });

  it('makes an exact explicit false eligibility retry idempotent', () => {
    const uow = new TrackingPeopleUow(person());
    const service = new EligibilityService(uow, runtime());
    const input = {
      personId: 'person-1',
      assignmentTypeId: 'builtin:apply-yourself-to-the-ministry',
      enabled: false,
    };

    const first = service.setEligibility(
      context('tenant-a', ['people.read', 'eligibility.write']),
      input,
    );
    const firstEffects = uow.updates.length;
    const second = service.setEligibility(
      context('tenant-a', ['people.read', 'eligibility.write']),
      input,
    );

    expect(second).toEqual(first);
    expect(uow.updates).toHaveLength(firstEffects);
    expect(uow.person.eligibility).toHaveLength(1);
    expect(uow.person.eligibility[0]?.enabled).toBe(false);
  });

  it('accepts an explicit enabled decision and trims the canonical assignment type id', () => {
    const uow = new TrackingPeopleUow(person());
    const service = new EligibilityService(uow, runtime());

    service.setEligibility(
      context(),
      { personId: 'person-1', assignmentTypeId: '  builtin:apply-yourself-to-the-ministry  ', enabled: true },
    );

    expect(uow.person.eligibility).toHaveLength(1);
    expect(uow.person.eligibility[0]).toMatchObject({
      assignmentTypeId: 'builtin:apply-yourself-to-the-ministry',
      enabled: true,
      decidedBy: 'authorized-actor',
    });
  });

  it('rejects foreign-tenant person access without mutation or audit/event effects', () => {
    const uow = new TrackingPeopleUow(person());
    const service = new EligibilityService(uow, runtime());

    expect(() => service.setEligibility(
      context('tenant-b', ['people.read', 'eligibility.write']),
      { personId: 'person-1', assignmentTypeId: 'reading', enabled: true },
    )).toThrow('Person not found');
    expect(uow.updates).toHaveLength(0);
    expect(uow.person.eligibility).toHaveLength(0);
  });

  it('rejects an unknown person without mutation or side effects', () => {
    const uow = new TrackingPeopleUow(person());
    const service = new EligibilityService(uow, runtime());

    expect(() => service.setEligibility(
      context(),
      { personId: 'missing-person', assignmentTypeId: 'reading', enabled: true },
    )).toThrow('Person not found');
    expect(uow.updates).toHaveLength(0);
  });

  it('rejects invalid availability windows before any commit', () => {
    const uow = new TrackingPeopleUow(person());
    const service = new AvailabilityService(uow, runtime());

    expect(() => service.addUnavailability(
      context(),
      { personId: 'person-1', startsAt: '2026-09-10T10:00:00Z', endsAt: '2026-09-10T10:00:00Z' },
    )).toThrow('Availability period must end after it starts');
    expect(uow.updates).toHaveLength(0);
    expect(uow.person.availability).toHaveLength(0);
  });

  it('uses deterministic [start,end) availability boundaries', () => {
    const p = person({ availability: [{ id: 'away-1', startsAt: '2026-09-10T10:00:00Z', endsAt: '2026-09-10T11:00:00Z' }] });
    const uow = new TrackingPeopleUow(p);
    const service = new AvailabilityService(uow, runtime());

    const result = service.list(context('tenant-a', ['people.read', 'availability.read']), 'person-1');
    expect(result[0]?.startsAt).toBe('2026-09-10T10:00:00Z');
    expect(result[0]?.endsAt).toBe('2026-09-10T11:00:00Z');
  });

  it('makes an exact availability retry idempotent with zero additional effects', () => {
    const uow = new TrackingPeopleUow(person());
    const service = new AvailabilityService(uow, runtime());
    const input = { personId: 'person-1', startsAt: '2026-09-10T10:00:00Z', endsAt: '2026-09-10T11:00:00Z', reasonCode: 'away' as const };

    const first = service.addUnavailability(context(), input);
    const firstEffects = uow.updates.length;
    const second = service.addUnavailability(context(), input);

    expect(second).toEqual(first);
    expect(uow.updates).toHaveLength(firstEffects);
    expect(uow.person.availability).toHaveLength(1);
  });

  it('keeps actor and tenant provenance in application-generated eligibility effects', () => {
    const uow = new TrackingPeopleUow(person());
    const service = new EligibilityService(uow, runtime());

    service.setEligibility(context(), { personId: 'person-1', assignmentTypeId: 'reading', enabled: true });

    expect(uow.updates[0]?.auditEvent).toMatchObject({ tenantId: 'tenant-a', actorId: 'authorized-actor' });
    expect(uow.updates[0]?.domainEvent).toMatchObject({ tenantId: 'tenant-a', actorId: 'authorized-actor' });
    expect(JSON.stringify(uow.updates[0]?.auditEvent)).not.toContain('Test Person');
    expect(JSON.stringify(uow.updates[0]?.domainEvent)).not.toContain('Test Person');
  });
});
